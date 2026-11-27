/**
 * KAZVORA Technologies — Configuración Pública de Entorno v2.4 (js/config.js)
 *
 * REGLA DE SEGURIDAD OBLIGATORIA:
 * - Este archivo es público en el navegador.
 * - NUNCA colocar contraseñas, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
 *   STRIPE_WEBHOOK_SECRET, tokens privados ni datos bancarios aquí.
 * - supabaseUrl y supabaseAnonKey son parámetros públicos diseñados para operar
 *   junto con Row Level Security (RLS) activado en PostgreSQL.
 */
(function () {
  "use strict";

  const envConfig = Object.freeze({
    // Entorno actual: "development" | "staging-github-pages" | "production"
    environment: "staging-github-pages",

    // Propietario y canales comerciales oficiales (autorizados por el titular)
    ownerName: "Kevin Santana Ramírez",
    contactEmail: "kevinsantanaramirez282@gmail.com",
    whatsappNumber: "522721832762",

    // Demostraciones aisladas en "" para evitar envíos ficticios al WhatsApp real
    demoBakeryWhatsappNumber: "",
    demoClinicWhatsappNumber: "",

    // Parámetros operativos del frontend
    contactCooldownMs: 2500,
    demoMaxQuantityPerProduct: 10,

    // Conexión al Portal de Clientes (completar cuando el proyecto Supabase esté creado
    // y se haya ejecutado supabase/001_portal_clientes_pagos.sql con RLS activo).
    supabaseUrl: "",
    supabaseAnonKey: "",

    // Endpoint base para Cloudflare Pages Functions (en producción usar "/api")
    apiBaseUrl: ""
  });

  if (typeof window !== "undefined") {
    window.KAZVORA_ENV = envConfig;
  }
})();