/**
 * KAZVORA Technologies — Pruebas Dinámicas de Backend Serverless v2.6 (Node.js 22/24 ESM)
 * Archivo: tests/test-backend-functions.mjs
 *
 * Ejecuta 14 pruebas dinámicas con Web Crypto API nativo:
 * - Webhook HMAC-SHA256: firma válida, payload alterado, anti-replay > 300s, formato inválido, HTTP 400.
 * - Ciclo SPEI / Idempotencia: pago acreditado (paid + audit log), expiración (expired), fallo (failed).
 * - Checkout: 503 sin entorno, 401 sin Bearer, 400 UUID inválido, 404 anti-IDOR,
 *   409 prevención de doble cobro y 200 con monto leído exclusivamente de BD + Idempotency-Key.
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

  const testSecret = 'whsec_test_kazvora_local_only_not_real';
  const nowSec = Math.floor(Date.now() / 1000);
  const sampleBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: 450000,
        metadata: { client_id: 'user-uuid-1' }
      }
    }
  });

  // --- BLOQUE A: Firma HMAC-SHA256 y Anti-Replay ---
  const validSig = await signTestPayload(sampleBody, testSecret, nowSec);
  const v1 = await verifyStripeSignature(sampleBody, validSig, testSecret, nowSec);
  record('BE-WH-01', 'Webhook HMAC', 'Acepta firma HMAC-SHA256 válida dentro de la ventana de tiempo', v1.valid === true);

  const vTampered = await verifyStripeSignature(sampleBody.replace('450000', '100'), validSig, testSecret, nowSec);
  record('BE-WH-02', 'Webhook HMAC', 'Rechaza payload modificado con firma original (integridad)', vTampered.valid === false);

  const expiredSig = await signTestPayload(sampleBody, testSecret, nowSec - 400);
  const vExpired = await verifyStripeSignature(sampleBody, expiredSig, testSecret, nowSec);
  record('BE-WH-03', 'Anti-Replay', 'Rechaza firma válida con antigüedad > 300 segundos', vExpired.valid === false);

  const vMalformed = await verifyStripeSignature(sampleBody, 'invalid-header', testSecret, nowSec);
  record('BE-WH-04', 'Webhook HMAC', 'Rechaza encabezado Stripe-Signature malformado', vMalformed.valid === false);

  const webhookEnv = {
    STRIPE_WEBHOOK_SECRET: testSecret,
    SUPABASE_URL: 'https://demo.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'srv_mock_key'
  };

  const badRes = await webhookPost({
    request: new Request('https://kazvora.example/api/stripe-webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': 't=123,v1=deadbeef' },
      body: sampleBody
    }),
    env: webhookEnv
  });
  record('BE-WH-05', 'Webhook HTTP', 'Endpoint /api/stripe-webhook devuelve HTTP 400 ante firma inválida', badRes.status === 400);

  // --- BLOQUE B: Ciclo Completo SPEI / Idempotencia en Webhook ---
  const originalFetch = globalThis.fetch;
  let webhookCalls = [];

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    webhookCalls.push({ url: u, method: opts.method || 'GET', body: opts.body || '' });
    if (u.includes('/rest/v1/payment_orders') && opts.method === 'PATCH') {
      return new Response(JSON.stringify([{ id: 'order-1' }]), { status: 200 });
    }
    if (u.includes('/rest/v1/security_audit_logs') && opts.method === 'POST') {
      return new Response('', { status: 201 });
    }
    return new Response('', { status: 200 });
  };

  try {
    webhookCalls = [];
    const paidRes = await webhookPost({
      request: new Request('https://kazvora.example/api/stripe-webhook', {
        method: 'POST',
        headers: { 'Stripe-Signature': validSig },
        body: sampleBody
      }),
      env: webhookEnv
    });
    const patchedPaid = webhookCalls.some(c => c.method === 'PATCH' && c.url.includes('status=eq.pending') && c.body.includes('"status":"paid"'));
    const loggedAudit = webhookCalls.some(c => c.method === 'POST' && c.url.includes('security_audit_logs') && c.body.includes('payment_status_paid'));
    record('BE-WH-06', 'Webhook SPEI', 'Acredita pago confirmado filtrando status=eq.pending y registra auditoría', paidRes.status === 200 && patchedPaid && loggedAudit);

    webhookCalls = [];
    const expBody = JSON.stringify({ type: 'checkout.session.expired', data: { object: { id: 'cs_exp_1' } } });
    const expSig = await signTestPayload(expBody, testSecret, nowSec);
    const expRes = await webhookPost({
      request: new Request('https://kazvora.example/api/stripe-webhook', {
        method: 'POST',
        headers: { 'Stripe-Signature': expSig },
        body: expBody
      }),
      env: webhookEnv
    });
    const patchedExp = webhookCalls.some(c => c.method === 'PATCH' && c.body.includes('"status":"expired"'));
    record('BE-WH-07', 'Webhook SPEI', 'Transiciona sesiones SPEI expiradas a estado expired', expRes.status === 200 && patchedExp);

    webhookCalls = [];
    const failBody = JSON.stringify({ type: 'checkout.session.async_payment_failed', data: { object: { id: 'cs_fail_1' } } });
    const failSig = await signTestPayload(failBody, testSecret, nowSec);
    const failRes = await webhookPost({
      request: new Request('https://kazvora.example/api/stripe-webhook', {
        method: 'POST',
        headers: { 'Stripe-Signature': failSig },
        body: failBody
      }),
      env: webhookEnv
    });
    const patchedFail = webhookCalls.some(c => c.method === 'PATCH' && c.body.includes('"status":"failed"'));
    record('BE-WH-08', 'Webhook SPEI', 'Transiciona transferencias SPEI fallidas a estado failed', failRes.status === 200 && patchedFail);
  } finally {
    globalThis.fetch = originalFetch;
  }

  // --- BLOQUE C: Seguridad de Checkout (create-checkout.js) ---
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
  record('BE-CHK-01', 'Config', 'Devuelve HTTP 503 si faltan variables de entorno en servidor', r503.status === 503);

  const r401 = await checkoutPost({
    request: new Request('https://kazvora.example/api/create-checkout', { method: 'POST', body: '{}' }),
    env: baseEnv
  });
  record('BE-CHK-02', 'Auth', 'Rechaza solicitudes sin token Bearer con HTTP 401', r401.status === 401);

  const r400 = await checkoutPost({
    request: new Request('https://kazvora.example/api/create-checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid_jwt_mock', 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: '../etc/passwd' })
    }),
    env: baseEnv
  });
  record('BE-CHK-03', 'Input', 'Rechaza projectId que no es UUID válido con HTTP 400', r400.status === 400);

  let stripeSentBody = '';
  let stripeSentHeaders = {};
  let simulateAlreadyPaid = false;
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
    if (u.includes('/rest/v1/payment_orders') && (!opts.method || opts.method === 'GET')) {
      return new Response(JSON.stringify(simulateAlreadyPaid ? [{ id: 'paid-order-1' }] : []), { status: 200 });
    }
    if (u === 'https://api.stripe.com/v1/checkout/sessions') {
      stripeSentBody = String(opts.body || '');
      stripeSentHeaders = opts.headers || {};
      return new Response(JSON.stringify({ id: 'cs_test_ok', url: 'https://checkout.stripe.com/c/pay/cs_test_ok' }), { status: 200 });
    }
    if (u.includes('/rest/v1/payment_orders') && opts.method === 'POST') {
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
    record('BE-CHK-04', 'Anti-IDOR', 'Bloquea intento IDOR sobre proyecto ajeno devolviendo HTTP 404', rIdor.status === 404);

    simulateAlreadyPaid = true;
    const rDoublePay = await checkoutPost({
      request: new Request('https://kazvora.example/api/create-checkout', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid_jwt_mock', 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: validUuid })
      }),
      env: baseEnv
    });
    simulateAlreadyPaid = false;
    record('BE-CHK-06', 'Anti-Doble-Cobro', 'Rechaza con HTTP 409 si el proyecto ya tiene un pago acreditado', rDoublePay.status === 409, `status=${rDoublePay.status}`);

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
    const hasIdempotencyKey = typeof stripeSentHeaders['Idempotency-Key'] === 'string' && stripeSentHeaders['Idempotency-Key'].startsWith('kazvora-chk-');
    record(
      'BE-CHK-05',
      'Integridad Pago',
      'Crea sesión Stripe (Tarjeta + SPEI) con monto exclusivo de PostgreSQL e Idempotency-Key',
      rOk.status === 200 && okJson.checkoutUrl === 'https://checkout.stripe.com/c/pay/cs_test_ok' && usedDbPrice && includesSpei && hasIdempotencyKey,
      JSON.stringify({ status: rOk.status, usedDbPrice, includesSpei, hasIdempotencyKey })
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