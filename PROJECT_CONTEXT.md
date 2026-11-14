# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Documento Maestro de Contexto Técnico y Trazabilidad de Ingeniería**  
> **Última actualización:** Etapa 3 — Blindaje del Favicon Corporativo y Demostración Comercial #1 (`demos/reposteria/`)  
> **Estado General:** Núcleo Corporativo y Primera Demostración Comercial Implementados

---

## 1. Identidad Técnica y Comercial del Proyecto

- **Empresa:** KAZVORA Technologies[cite: 1, 2, 8]
- **Eslogan Principal:** «Tecnología que convierte ideas en soluciones»[cite: 1, 2, 3, 4, 5]
- **Eslogan Secundario (Lámina Oficial):** «Ideas que se convierten en soluciones.»[cite: 8]
- **Recurso Oficial de Marca e Iconografía:** `assets/icons/favicon.svg`[cite: 6, 7]
  - Presente en `<head>` de las 5 vistas raíz (`href="assets/icons/favicon.svg"`)[cite: 1, 2, 3, 4, 5].
  - Presente en `<head>` y barra institucional de `demos/reposteria/index.html` (`href="../../assets/icons/favicon.svg"`).
  - Renderizado automáticamente en `.brand-mark` (header y footer) y `.monogram` mediante `css/styles.css`.
- **Paleta Corporativa:** `#0b0d10` (base), `#ff454f` (rojo principal), `#d72e3b` (rojo oscuro), `#83ddff` (azul cielo), `#ff9ce8` (rosa).

---

## 2. Estructura Actual de Archivos

```text
kazvora-portafolio/
│
├── index.html                  [Verificado y corregido BUG-001]
├── portafolio.html             [Verificado]
├── servicios.html              [Verificado]
├── nosotros.html               [Verificado]
├── contacto.html               [Verificado]
├── README.md                   [Verificado]
├── PROJECT_CONTEXT.md          [Implementado - v1.2.0]
│
├── assets/
│   └── icons/
│       └── favicon.svg         [Verificado e integrado en todas las vistas]
│
├── css/
│   └── styles.css              [Implementado con renderizado de favicon.svg]
│
├── js/
│   ├── main.js                 [Implementado con sanitización XSS y WhatsApp configurable]
│   └── projects.js             [Implementado y sincronizado con demos/reposteria/]
│
└── demos/
    └── reposteria/
        ├── index.html          [Implementado - Demo Comercial #1]
        ├── styles.css          [Implementado - Identidad visual propia]
        └── app.js              [Implementado - Catálogo y armador de pedido]