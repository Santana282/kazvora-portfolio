/**
 * KAZVORA Technologies — Cloudflare Pages Function: Crear Sesión de Pago / SPEI
 * Ruta: functions/api/create-checkout.js (desplegado en /api/create-checkout)
 *
 * VARIABLES DE ENTORNO DE SERVIDOR REQUERIDAS (en Cloudflare Pages → Settings → Environment Variables):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (NUNCA exponer en frontend)
 * - STRIPE_SECRET_KEY (NUNCA exponer en frontend)
 * - PUBLIC_SITE_URL (ej. https://kazvora.mx)
 *
 * SEGURIDAD:
 * - Valida el JWT del usuario contra Supabase Auth (/auth/v1/user).
 * - Consulta el proyecto en PostgreSQL verificando client_id === user.id (prevención IDOR/BOLA).
 * - El monto se obtiene EXCLUSIVAMENTE de la base de datos (nunca del body del navegador).
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

  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY || !env.STRIPE_SECRET_KEY || !env.PUBLIC_SITE_URL) {
    return jsonResponse({ error: "Servicio de pagos no configurado en este entorno." }, 503);
  }

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

  const projUrl =
    supabaseBase +
    "/rest/v1/client_projects?id=eq." +
    encodeURIComponent(projectId) +
    "&client_id=eq." +
    encodeURIComponent(user.id) +
    "&select=id,title,total_amount_cents,currency,status";

  const projRes = await fetch(projUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
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

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formBody.toString()
  });

  if (!stripeRes.ok) {
    return jsonResponse({ error: "Error al iniciar sesión con la pasarela de pago." }, 502);
  }

  const session = await stripeRes.json();

  await fetch(supabaseBase + "/rest/v1/payment_orders", {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
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