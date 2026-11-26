/**
 * KAZVORA Technologies — Configuración Pública de Entorno v2.3 (js/config.js)
 *
 * REGLA DE SEGURIDAD:
 * - Este archivo es público en el navegador.
 * - NUNCA colocar contraseñas, claves API privadas, tokens, datos bancarios ni secretos aquí.
 * - Contiene únicamente datos de contacto comercial autorizados por el propietario
 *   y parámetros públicos de operación del frontend.
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

    // Las demostraciones comerciales conservan su canal vacío "" para evitar
    // que visitantes envíen pedidos ficticios de pasteles o citas médicas al WhatsApp real.
    // Sus botones de "Cotizar un sitio así" dirigen a contacto.html con el canal oficial activo.
    demoBakeryWhatsappNumber: "",
    demoClinicWhatsappNumber: "",

    // Parámetros operativos del frontend
    contactCooldownMs: 2500,
    demoMaxQuantityPerProduct: 10,

    // Endpoint base para futura API backend (vacío mientras opere en GitHub Pages)
    apiBaseUrl: ""
  });

  if (typeof window !== "undefined") {
    window.KAZVORA_ENV = envConfig;
  }
})();