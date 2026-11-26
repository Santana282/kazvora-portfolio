# Guía de Migración a Producción, Registro de Clientes y Transferencias SPEI

> **Proyecto:** KAZVORA Technologies (Propietario: Kevin Santana Ramírez)  
> **Fecha:** 26 de noviembre de 2026  
> **Propósito:** Plan técnico paso a paso para escalar de GitHub Pages a una plataforma con dominio propio, cuentas de clientes y cobros/transferencias verificadas en México.

---

## 1. Comparativa de Pasarelas de Pago y Transferencias SPEI en México

Antes de contratar o integrar un procesador de pagos, se evalúan tres opciones formales en México (sin exponer nunca cuentas bancarias personales en el HTML):

| Criterio | Opción A: Stripe México (Tarjetas + SPEI / Customer Balance) | Opción B: Mercado Pago México | Opción C: Conekta México |
| :--- | :--- | :--- | :--- |
| **Transferencias SPEI automáticas** | Sí: genera una CLABE SPEI dedicada por cliente y dispara un webhook firmado al acreditarse el pago. | Sí: mediante Checkout Pro / API con acreditación inmediata y links de pago listos para WhatsApp. | Sí: SPEI y efectivo OXXO Pay con webhook de confirmación. |
| **Seguridad y API** | Estándar industrial (PCI-DSS Nivel 1, webhooks firmados con HMAC-SHA256, excelente documentación). | Muy buena (PCI-DSS, amplia confianza de compradores en México, SDKs oficiales). | Buena (PCI-DSS, orientada a comercio electrónico mexicano). |
| **Costo Fijo Mensual** | `$0 MXN/mes` (solo comisión por transacción cobrada). | `$0 MXN/mes` (solo comisión por cobro acreditado). | `$0 MXN/mes` en planes estándar por transacción. |
| **Mejor Uso para KAZVORA** | **Óptima para el Portal de Clientes + Webhooks en Cloudflare Workers + Supabase.** | **Óptima para cobrar HOY por WhatsApp mediante Links de Pago oficiales** mientras construyes el portal. | Alternativa sólida si más adelante necesitas pagos en efectivo en OXXO. |

### Recomendación Práctica (Sin Gastos Fijos)
1. **Hoy (Inmediato, $0 fijos):** Usa tu sitio actual vinculado a tu WhatsApp (`+52 272 183 2762`) y, cuando un cliente acepte una cotización, envíale un **Link de Pago oficial** de **Mercado Pago** o **Stripe Payment Links**.
2. **Siguiente Etapa (Portal con Registro y Transferencias Automáticas):** Migra el frontend a **Cloudflare Pages** (donde `_headers` activará automáticamente HSTS, `X-Frame-Options` y CSP de servidor) y despliega `supabase/001_portal_clientes_pagos.sql` en **Supabase** + una función serverless para los webhooks firmados de Stripe/Mercado Pago.

---

## 2. Cómo Migrar el Sitio a Cloudflare Pages (Sin Costo Mensual)

1. Crea una cuenta gratuita en **Cloudflare** y entra a **Workers & Pages → Create → Pages → Connect to Git**.
2. Selecciona el repositorio `Santana282/kazvora-portfolio`, rama `main`, sin comando de build (*Framework preset: None*, *Build output directory: `/`*).
3. Al desplegar, Cloudflare detectará automáticamente el archivo `_headers` en la raíz del repositorio y activará las cabeceras HTTP de seguridad en todos los bordes globales (CDN + protección DDoS).
4. Cuando compres tu dominio propio (ej. `kazvora.mx` o `kazvora.com`), vincúlalo en **Custom domains**, actualiza `sitemap.xml`, las etiquetas `og:image` y `js/config.js` (`environment: "production"`).

---

## 3. Cómo Inicializar la Base de Datos del Portal de Clientes (Supabase)

1. Crea un proyecto gratuito en **Supabase** (región recomendada: `us-east-1` o `us-west-1` por menor latencia desde México).
2. Abre **SQL Editor** en el panel de Supabase, pega el contenido íntegro de `supabase/001_portal_clientes_pagos.sql` y ejecútalo.
3. En **Authentication → Settings**, activa confirmación de correo y protección contra contraseñas filtradas; nunca publiques la clave `service_role` en el frontend (solo va en variables de entorno secretas del servidor/Cloudflare Workers).
4. Antes de habilitar pagos reales en producción, ejecuta pruebas de aislamiento RLS con dos usuarios de prueba distintos confirmando que el Usuario A **no puede leer** proyectos ni pagos del Usuario B y **no puede ejecutar `UPDATE` sobre `payment_orders`**.
