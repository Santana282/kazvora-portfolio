/**
 * KAZVORA Technologies — Cloudflare Pages Function: Webhook Verificado de Pagos / SPEI v2.6
 * Ruta: functions/api/stripe-webhook.js (desplegado en /api/stripe-webhook)
 *
 * SEGURIDAD CRIPTOGRÁFICA Y TRANSACCIONAL:
 * - Verifica firma HMAC-SHA256 de Stripe usando Web Crypto API (cero dependencias externas).
 * - Ventana anti-replay de 300 segundos y comparación en tiempo constante.
 * - Transiciones idempotentes: solo actualiza órdenes en estado 'pending' para evitar
 *   sobrescribir registros acreditados o duplicar entradas de auditoría ante reintentos de Stripe.
 * - Cubre el ciclo completo de pagos y transferencias SPEI:
 *     * checkout.session.completed / async_payment_succeeded -> 'paid'
 *     * checkout.session.expired -> 'expired'
 *     * checkout.session.async_payment_failed -> 'failed'
 */

const REPLAY_TOLERANCE_SECONDS = 300;

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret, nowSeconds) {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return { valid: false, reason: "Parámetros de firma incompletos." };
  }

  const parts = signatureHeader.split(",");
  let timestamp = null;
  const signatures = [];

  for (const part of parts) {
    const [k, v] = part.trim().split("=");
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }

  if (!Number.isSafeInteger(timestamp) || signatures.length === 0) {
    return { valid: false, reason: "Encabezado Stripe-Signature malformado." };
  }

  const currentSec = Number.isSafeInteger(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000);
  if (Math.abs(currentSec - timestamp) > REPLAY_TOLERANCE_SECONDS) {
    return { valid: false, reason: "Firma expirada (fuera de ventana anti-replay)." };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signedPayload = timestamp + "." + rawBody;
  const macBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(macBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const matched = signatures.some(sig => timingSafeEqualHex(sig.toLowerCase(), expectedHex));
  return matched
    ? { valid: true, reason: "" }
    : { valid: false, reason: "Firma HMAC-SHA256 no coincide." };
}

async function transitionPendingOrder(supabaseBase, srvHeaders, session, nextStatus, eventType) {
  const updateBody =
    nextStatus === "paid"
      ? { status: "paid", paid_at: new Date().toISOString() }
      : { status: nextStatus };

  // Solo actualiza si la orden sigue en 'pending' (idempotencia frente a reintentos)
  const patchRes = await fetch(
    supabaseBase +
      "/rest/v1/payment_orders?provider_payment_id=eq." +
      encodeURIComponent(session.id) +
      "&status=eq.pending",
    {
      method: "PATCH",
      headers: Object.assign({}, srvHeaders, { Prefer: "return=representation" }),
      body: JSON.stringify(updateBody)
    }
  );

  let updatedRows = [];
  if (patchRes.ok) {
    try {
      const parsed = await patchRes.json();
      if (Array.isArray(parsed)) updatedRows = parsed;
    } catch (err) {
      updatedRows = [];
    }
  }

  // Registrar en bitácora solo cuando hubo una transición real de estado
  if (updatedRows.length > 0) {
    await fetch(supabaseBase + "/rest/v1/security_audit_logs", {
      method: "POST",
      headers: Object.assign({}, srvHeaders, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        actor_id: session.metadata && session.metadata.client_id ? session.metadata.client_id : null,
        action: "payment_status_" + nextStatus,
        resource_type: "payment_orders",
        resource_id: session.id,
        metadata: {
          event_type: eventType,
          amount_total: session.amount_total || null
        }
      })
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Webhook no configurado", { status: 503 });
  }

  const rawBody = await request.text();
  const sigHeader = request.headers.get("Stripe-Signature") || "";

  const verification = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!verification.valid) {
    return new Response("Firma inválida", { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return new Response("JSON inválido", { status: 400 });
  }

  const session = event.data && event.data.object ? event.data.object : null;
  if (!session || typeof session.id !== "string" || !session.id) {
    return new Response(JSON.stringify({ received: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabaseBase = env.SUPABASE_URL.replace(/\/+$/, "");
  const srvHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  };

  if (
    (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded") &&
    session.payment_status === "paid"
  ) {
    await transitionPendingOrder(supabaseBase, srvHeaders, session, "paid", event.type);
  } else if (event.type === "checkout.session.expired") {
    await transitionPendingOrder(supabaseBase, srvHeaders, session, "expired", event.type);
  } else if (event.type === "checkout.session.async_payment_failed") {
    await transitionPendingOrder(supabaseBase, srvHeaders, session, "failed", event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}