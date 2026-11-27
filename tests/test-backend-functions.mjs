/**
 * KAZVORA Technologies — Pruebas Dinámicas de Backend Serverless (Node.js 22/24 ESM)
 * Archivo: tests/test-backend-functions.mjs
 *
 * Valida en tiempo de ejecución con Web Crypto API nativo:
 * 1. functions/api/stripe-webhook.js -> Firma HMAC-SHA256 válida, payload alterado,
 *    firma expirada (> 300 s anti-replay), encabezado malformado y rechazo HTTP 400.
 * 2. functions/api/create-checkout.js -> Entorno incompleto (503), falta de Bearer (401),
 *    UUID malformado (400), intento IDOR/proyecto ajeno (404) y flujo válido (200)
 *    verificando que el monto provenga EXCLUSIVAMENTE de la base de datos.
 */

import { webcrypto } from 'node:crypto';
import { verifyStripeSignature, onRequestPost as webhookPost } from '../functions/api/stripe-webhook.js';
import { onRequestPost as checkoutPost } from '../functions/api/create-checkout.js';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

async function signTestPayload(rawBody, secret, timestampSec) {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestampSec}.${rawBody}`)
  );
  const hex = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `t=${timestampSec},v1=${hex}`;
}

async function runBackendTests() {
  const results = [];
  function record(id, group, description, passed, detail = '') {
    results.push({
      id,
      group,
      description,
      status: passed ? 'PASS' : 'FAIL',
      detail: passed ? null : (detail || 'Assertion failed')
    });
  }

  // --- BLOQUE A: Pruebas Criptográficas de Webhook (stripe-webhook.js) ---
  const testSecret = 'whsec_test_kazvora_local_only_not_real';
  const nowSec = Math.floor(Date.now() / 1000);
  const sampleBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_123', payment_status: 'paid', amount_total: 450000 } }
  });

  const validSig = await signTestPayload(sampleBody, testSecret, nowSec);
  const v1 = await verifyStripeSignature(sampleBody, validSig, testSecret, nowSec);
  record('BE-WH-01', 'Webhook HMAC', 'Acepta firma HMAC-SHA256 válida dentro de la ventana de tiempo', v1.valid === true, JSON.stringify(v1));

  const vTampered = await verifyStripeSignature(sampleBody.replace('450000', '100'), validSig, testSecret, nowSec);
  record('BE-WH-02', 'Webhook HMAC', 'Rechaza payload modificado con firma original (integridad)', vTampered.valid === false, JSON.stringify(vTampered));

  const expiredTs = nowSec - 400;
  const expiredSig = await signTestPayload(sampleBody, testSecret, expiredTs);
  const vExpired = await verifyStripeSignature(sampleBody, expiredSig, testSecret, nowSec);
  record('BE-WH-03', 'Anti-Replay', 'Rechaza firma válida con antigüedad > 300 segundos', vExpired.valid === false, JSON.stringify(vExpired));

  const vMalformed = await verifyStripeSignature(sampleBody, 'invalid-header', testSecret, nowSec);
  record('BE-WH-04', 'Webhook HMAC', 'Rechaza encabezado Stripe-Signature malformado', vMalformed.valid === false);

  const badReq = new Request('https://kazvora.example/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': 't=123,v1=deadbeef' },
    body: sampleBody
  });
  const badRes = await webhookPost({
    request: badReq,
    env: {
      STRIPE_WEBHOOK_SECRET: testSecret,
      SUPABASE_URL: 'https://demo.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srv_mock_key'
    }
  });
  record('BE-WH-05', 'Webhook HTTP', 'Endpoint /api/stripe-webhook devuelve HTTP 400 ante firma inválida', badRes.status === 400, `status=${badRes.status}`);

  // --- BLOQUE B: Pruebas de Seguridad de Checkout (create-checkout.js) ---
  const baseEnv = {
    SUPABASE_URL: 'https://demo.supabase.co',
    SUPABASE_ANON_KEY: 'anon_mock_key_1234567890',
    SUPABASE_SERVICE_ROLE_KEY: 'srv_mock_key_1234567890',
    STRIPE_SECRET_KEY: 'sk_test_mock_key_1234567890',
    PUBLIC_SITE_URL: 'https://kazvora.example'
  };

  const r503 = await checkoutPost({
    request: new Request('https://kazvora.example/api/create-checkout', { method: 'POST', body: '{}' }),
    env: {}
  });
  record('BE-CHK-01', 'Config', 'Devuelve HTTP 503 si faltan variables de entorno en servidor', r503.status === 503, `status=${r503.status}`);

  const r401 = await checkoutPost({
    request: new Request('https://kazvora.example/api/create-checkout', { method: 'POST', body: '{}' }),
    env: baseEnv
  });
  record('BE-CHK-02', 'Auth', 'Rechaza solicitudes sin token Bearer con HTTP 401', r401.status === 401, `status=${r401.status}`);

  const r400 = await checkoutPost({
    request: new Request('https://kazvora.example/api/create-checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid_jwt_mock', 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: '../etc/passwd' })
    }),
    env: baseEnv
  });
  record('BE-CHK-03', 'Input', 'Rechaza projectId que no es UUID válido con HTTP 400', r400.status === 400, `status=${r400.status}`);

  const originalFetch = globalThis.fetch;
  let stripeSentBody = '';
  const validUuid = '11111111-2222-3333-4444-555555555555';
  const otherUuid = '99999999-8888-7777-6666-555555555555';

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-uuid-1', email: 'cliente@empresa.mx' }), { status: 200 });
    }
    if (u.includes('/rest/v1/client_projects')) {
      if (u.includes(validUuid) && u.includes('client_id=eq.user-uuid-1')) {
        return new Response(JSON.stringify([{
          id: validUuid,
          title: 'Sitio Web Corporativo',
          total_amount_cents: 450000,
          currency: 'MXN',
          status: 'quoted'
        }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (u === 'https://api.stripe.com/v1/checkout/sessions') {
      stripeSentBody = String(opts.body || '');
      return new Response(JSON.stringify({ id: 'cs_test_ok', url: 'https://checkout.stripe.com/c/pay/cs_test_ok' }), { status: 200 });
    }
    if (u.includes('/rest/v1/payment_orders')) {
      return new Response('', { status: 201 });
    }
    return new Response('Not found', { status: 404 });
  };

  try {
    const rIdor = await checkoutPost({
      request: new Request('https://kazvora.example/api/create-checkout', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid_jwt_mock', 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: otherUuid })
      }),
      env: baseEnv
    });
    record('BE-CHK-04', 'Anti-IDOR', 'Bloquea intento IDOR sobre proyecto ajeno devolviendo HTTP 404', rIdor.status === 404, `status=${rIdor.status}`);

    const rOk = await checkoutPost({
      request: new Request('https://kazvora.example/api/create-checkout', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid_jwt_mock', 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: validUuid, total_amount_cents: 1 })
      }),
      env: baseEnv
    });
    const okJson = await rOk.json();
    const usedDbPrice = stripeSentBody.includes('unit_amount%5D=450000') || stripeSentBody.includes('unit_amount]=450000');
    const includesSpei = stripeSentBody.includes('mx_bank_transfer');
    record(
      'BE-CHK-05',
      'Integridad Pago',
      'Crea sesión Stripe (Tarjeta + SPEI) usando exclusivamente el monto de PostgreSQL e ignorando montos del cliente',
      rOk.status === 200 && okJson.checkoutUrl === 'https://checkout.stripe.com/c/pay/cs_test_ok' && usedDbPrice && includesSpei,
      JSON.stringify({ status: rOk.status, okJson, usedDbPrice, includesSpei })
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    totalTests: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status !== 'PASS').length,
    passRate: ((results.filter(r => r.status === 'PASS').length / results.length) * 100).toFixed(1) + '%',
    results: results
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exitCode = 1;
}

runBackendTests().catch(err => {
  console.error('Error ejecutando pruebas de backend:', err);
  process.exitCode = 1;
});