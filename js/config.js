/**
 * KAZVORA Technologies — Configuración Pública de Entorno (js/config.js)
 *
 * REGLA DE SEGURIDAD:
 * - Este archivo se entrega de forma pública al navegador.
 * - NUNCA colocar contraseñas, claves API privadas, tokens ni secretos aquí.
 * - Centraliza parámetros públicos para desacoplar la lógica de GitHub Pages
 *   y facilitar una futura migración a dominio propio e infraestructura de producción.
 */
(function () {
  "use strict";

  const envConfig = Object.freeze({
    // Entorno actual: "development" | "staging-github-pages" | "production"
    environment: "staging-github-pages",

    // Números comerciales en formato internacional E.164 (ej. "522721234567").
    // Permanecen vacíos "" hasta autorización comercial explícita.
    whatsappNumber: "",
    demoBakeryWhatsappNumber: "",

    // Parámetros operativos del frontend
    contactCooldownMs: 2500,
    demoMaxQuantityPerProduct: 10,

    // Endpoint base para futura API backend (vacío mientras opere en modo estático)
    apiBaseUrl: ""
  });

  if (typeof window !== "undefined") {
    window.KAZVORA_ENV = envConfig;
  }
})();