/**
 * KAZVORA Technologies — Cloudflare Pages Function: Crear Sesión de Pago / SPEI v2.6
 * Ruta: functions/api/create-checkout.js (desplegado en /api/create-checkout)
 *
 * VARIABLES DE ENTORNO DE SERVIDOR REQUERIDAS (Cloudflare Pages → Settings → Environment Variables):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (NUNCA exponer en frontend)
 * - STRIPE_SECRET_KEY (NUNCA exponer en frontend)
 * - PUBLIC_SITE_URL (ej. https://kazvora.mx)
 *
 * CONTROLES DE SEGURIDAD TRANSACCIONAL:
 * - Valida el JWT del usuario contra Supabase Auth (/auth/v1/user).
 * - Verifica propiedad del proyecto (client_id === user.id) para prevenir IDOR/BOLA.
 * - Comprueba en payment_orders que el proyecto NO tenga ya un pago acreditado (prevención de doble cobro -> HTTP 409).
 * - El monto se lee EXCLUSIVAMENTE de PostgreSQL (nunca del cuerpo enviado por el navegador).
 * - Envía Idempotency-Key a Stripe para evitar sesiones duplicadas por doble clic accidental.
 */

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_ANON_KEY ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.STRIPE_SECRET_KEY ||
    !env.PUBLIC_SITE_URL
  ) {
    return jsonResponse({ error: "Servicio de pagos no configurado en este entorno." }, 503);
  }

  // 1. Validar Bearer JWT
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Autenticación requerida." }, 401);
  }
  const userToken = authHeader.slice(7).trim();
  if (!userToken || userToken.length > 4096) {
    return jsonResponse({ error: "Token inválido." }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, 400);
  }

  const projectId = typeof payload.projectId === "string" ? payload.projectId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    return jsonResponse({ error: "Identificador de proyecto inválido." }, 400);
  }

  const supabaseBase = env.SUPABASE_URL.replace(/\/+$/, "");
  const srvHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY
  };

  // 2. Validar identidad del usuario autenticado
  const userRes = await fetch(supabaseBase + "/auth/v1/user", {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: "Bearer " + userToken
    }
  });
  if (!userRes.ok) {
    return jsonResponse({ error: "Sesión expirada o inválida." }, 401);
  }
  const user = await userRes.json();
  if (!user || !user.id || !user.email) {
    return jsonResponse({ error: "Usuario no verificado." }, 401);
  }

  // 3. Consultar proyecto verificando propiedad (Anti-IDOR)
  const projUrl =
    supabaseBase +
    "/rest/v1/client_projects?id=eq." +
    encodeURIComponent(projectId) +
    "&client_id=eq." +
    encodeURIComponent(user.id) +
    "&select=id,title,total_amount_cents,currency,status";

  const projRes = await fetch(projUrl, { headers: srvHeaders });
  if (!projRes.ok) {
    return jsonResponse({ error: "No fue posible consultar el proyecto." }, 502);
  }

  const projects = await projRes.json();
  const project = Array.isArray(projects) ? projects[0] : null;
  if (!project) {
    return jsonResponse({ error: "Proyecto no encontrado o sin permisos." }, 404);
  }

  if (project.status !== "quoted" && project.status !== "in_progress") {
    return jsonResponse({ error: "Este proyecto no admite pagos en su estado actual." }, 409);
  }

  // 4. Prevención de doble cobro: verificar que no exista una orden ya acreditada ('paid')
  const paidCheckUrl =
    supabaseBase +
    "/rest/v1/payment_orders?project_id=eq." +
    encodeURIComponent(project.id) +
    "&status=eq.paid&select=id&limit=1";

  const paidCheckRes = await fetch(paidCheckUrl, { headers: srvHeaders });
  if (!paidCheckRes.ok) {
    return jsonResponse({ error: "No fue posible verificar el historial de pagos." }, 502);
  }
  const existingPaid = await paidCheckRes.json();
  if (Array.isArray(existingPaid) && existingPaid.length > 0) {
    return jsonResponse({ error: "Este proyecto ya cuenta con un pago acreditado." }, 409);
  }

  // 5. Crear sesión en Stripe Checkout (Tarjeta + Transferencia bancaria SPEI MXN)
  const siteBase = env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  const formBody = new URLSearchParams();
  formBody.append("mode", "payment");
  formBody.append("customer_email", user.email);
  formBody.append("payment_method_types[0]", "card");
  formBody.append("payment_method_types[1]", "customer_balance");
  formBody.append("payment_method_options[customer_balance][funding_type]", "bank_transfer");
  formBody.append("payment_method_options[customer_balance][bank_transfer][type]", "mx_bank_transfer");
  formBody.append("line_items[0][price_data][currency]", "mxn");
  formBody.append("line_items[0][price_data][unit_amount]", String(project.total_amount_cents));
  formBody.append("line_items[0][price_data][product_data][name]", "KAZVORA — " + project.title);
  formBody.append("line_items[0][quantity]", "1");
  formBody.append("metadata[project_id]", project.id);
  formBody.append("metadata[client_id]", user.id);
  formBody.append("success_url", siteBase + "/portal.html?pago=pendiente_confirmacion");
  formBody.append("cancel_url", siteBase + "/portal.html?pago=cancelado");

  // Clave de idempotencia por ventana de 2 minutos para mitigar doble clic accidental
  const twoMinBucket = Math.floor(Date.now() / 120000);
  const idempotencyKey = "kazvora-chk-" + project.id + "-" + user.id + "-" + twoMinBucket;

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey
    },
    body: formBody.toString()
  });

  if (!stripeRes.ok) {
    return jsonResponse({ error: "Error al iniciar sesión con la pasarela de pago." }, 502);
  }

  const session = await stripeRes.json();

  // 6. Registrar orden pendiente en payment_orders (solo servidor)
  await fetch(supabaseBase + "/rest/v1/payment_orders", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates"
    },
    body: JSON.stringify({
      project_id: project.id,
      client_id: user.id,
      provider: "stripe_spei",
      provider_payment_id: session.id,
      amount_cents: project.total_amount_cents,
      currency: "MXN",
      status: "pending"
    })
  });

  return jsonResponse({ checkoutUrl: session.url }, 200);
}