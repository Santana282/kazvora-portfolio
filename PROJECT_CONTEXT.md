# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Versión:** v2.5.0 (Bloques 1–10: Sitio Corporativo, 3 Demostraciones, Portal de Clientes, Backend Cloudflare/Stripe SPEI, Trigger SQL y CI Full-Stack)  
> **Propietario:** Kevin Santana Ramírez (`kevinsantanaramirez282@gmail.com` · WhatsApp `+52 272 183 2762`)  
> **Repositorio:** `Santana282/kazvora-portfolio`  
> **Entorno temporal:** GitHub Pages · **Entorno objetivo de producción:** Cloudflare Pages + Supabase PostgreSQL + Stripe México (Tarjeta + SPEI)

---

## 1. Identidad Oficial y Pilares Tecnológicos

- **Marca:** KAZVORA Technologies
- **Eslogan principal:** «Tecnología que convierte ideas en soluciones»
- **Eslogan de lámina oficial:** «Ideas que se convierten en soluciones.»
- **Paleta:** `#0b0d10` (base), `#ff454f` / `#d72e3b` (rojo), `#83ddff` (azul cielo), `#ff9ce8` (rosa)
- **Logotipo vectorial:** `assets/icons/favicon.svg` · **Tarjeta Social OG:** `assets/images/og-kazvora.jpg` (1200×630, 79 KB)
- **Cinco verticales de marca:** Desarrollo Web y Software *(disponibles hoy)*; Bases de Datos, Inteligencia Artificial y Cloud Solutions *(en evolución / hoja de ruta)*.

---

## 2. Arquitectura Full-Stack Preparada para Producción

- **Frontend (MPA Nativo):** HTML5, CSS3 y JavaScript Vanilla (ES6+), cero dependencias externas en runtime y `0` usos de `innerHTML` en todos los controladores (`js/main.js`, `js/portal.js`, `demos/reposteria/app.js`, `demos/clinica-citas/app.js`, `demos/panel-operativo/app.js`).
- **Configuración Pública Desacoplada:** `js/config.js` (`Object.freeze(window.KAZVORA_ENV)`) con WhatsApp comercial oficial activo (`522721832762`), demos aisladas en `""` para evitar spam y campos preparados para `supabaseUrl`, `supabaseAnonKey` y `apiBaseUrl`.
- **Backend Serverless (`functions/api/`):**
  - `create-checkout.js`: valida JWT de Supabase, aplica control anti-IDOR (`client_id = eq.<user.id>`), lee el monto únicamente de PostgreSQL e inicia Stripe Checkout (Tarjeta + SPEI MXN).
  - `stripe-webhook.js`: verifica firma `HMAC-SHA256` con Web Crypto API, comparación en tiempo constante y ventana anti-replay de 300 s antes de marcar `payment_orders.status = 'paid'`.
- **Base de Datos (`supabase/`):**
  - `001_portal_clientes_pagos.sql`: tablas `profiles`, `client_projects`, `payment_orders`, `security_audit_logs` con **Row Level Security (RLS)** obligatorio.
  - `002_auth_profile_trigger.sql`: trigger `on_auth_user_created` para crear automáticamente el perfil con `role = 'client'` aunque esté activa la confirmación de correo en Supabase Auth.
- **Despliegue y DevSecOps:** `wrangler.toml`, `.dev.vars.example`, `_headers`, `.gitignore`, `SECURITY.md`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest` y `.github/workflows/ci-security.yml`.

---

## 3. Matriz de Estado

| Área | Estado | Notas |
| :--- | :--- | :--- |
| Sitio corporativo v2.3 (`index`, `servicios`, `portafolio`, `nosotros`, `contacto`, `privacidad`, `404`) | **Implementado** | CSP, `Referrer-Policy`, Open Graph `og-kazvora.jpg`, PWA manifest y WhatsApp comercial activo. |
| 3 Demostraciones comerciales (`reposteria`, `clinica-citas`, `panel-operativo`) | **Implementado** | 0 `innerHTML`, fechas/cantidades validadas y protección contra CSV Formula Injection. |
| Portal de clientes (`portal.html`, `css/portal.css`, `js/portal.js`) | **Implementado** | 0 `innerHTML`, 0 `localStorage`, degradación segura mientras Supabase no esté configurado. |
| Backend serverless (`functions/api/*`) + Migraciones SQL (`supabase/001`, `002`) | **Implementado** | Anti-IDOR, verificación HMAC-SHA256 y creación automática de perfiles con RLS. |
| Suites CI (`run-fase4-audit-tests.js` + `test-backend-functions.mjs`) | **Implementado** | Validadas automáticamente en GitHub Actions con Node.js 22 LTS. |
| Activación de cuentas externas (Cloudflare Pages, Supabase, Stripe México y dominio propio) | **Pendiente** | Requiere acción y autorización expresa del propietario Kevin Santana Ramírez. |