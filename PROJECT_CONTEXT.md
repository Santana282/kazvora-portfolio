# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Documento Maestro de Contexto Técnico, Auditoría y Trazabilidad de Ingeniería**  
> **Versión del documento:** v1.3.0 (Fase 4 — Endurecimiento, Corrección y Validación)  
> **Fecha de intervención:** 2026-11-14  
> **Repositorio oficial:** `Santana282/kazvora-portfolio` (rama de referencia: `main`)  
> **Estado general:** Cambios de Fase 4 implementados y probados a nivel lógico; pendientes de verificación independiente en navegador local y autorización de publicación.

---

## 1. Identidad Técnica y Comercial del Proyecto

- **Empresa:** KAZVORA Technologies
- **Eslogan Principal (Sitio Web):** «Tecnología que convierte ideas en soluciones»
- **Eslogan Secundario (Lámina de Marca):** «Ideas que se convierten en soluciones.»
- **Recurso Oficial de Iconografía:** `assets/icons/favicon.svg`
  - Integrado en `<head>` de las 5 páginas institucionales (`href="assets/icons/favicon.svg"`).
  - Integrado en `<head>`, barra superior y pie de página de `demos/reposteria/index.html` (`href="../../assets/icons/favicon.svg"`).
  - Renderizado mediante CSS en `.brand-mark` y `.monogram` dentro de `css/styles.css`.
- **Paleta Corporativa (Design Tokens):**
  - Fondo principal: `#0b0d10`
  - Rojo principal: `#ff454f`
  - Rojo oscuro: `#d72e3b`
  - Azul cielo: `#83ddff`
  - Rosa: `#ff9ce8`

---

## 2. Línea Base de la Auditoría (Fase 4)

La intervención técnica de la Fase 4 tomó como referencia la siguiente línea base auditada en la rama `main`:

| Archivo Auditado | SHA Original Abreviado | Estado en Fase 4 |
| :--- | :--- | :--- |
| `js/main.js` | `39c8905c157e` | Modificado (`MAIN-001`, `MAIN-002`, `MAIN-003`, `PROJECTS-002`) |
| `js/projects.js` | `f842d5dac918` | Modificado (`PROJECTS-001`, `PROJECTS-002`) |
| `demos/reposteria/app.js` | `94733cd2d25b` | Modificado (`DEMO-001` a `DEMO-006`) |
| `PROJECT_CONTEXT.md` | `55c2c1e0617b` | Modificado (`DOC-001`, `DOC-002`) |

Archivos complementarios sincronizados en esta intervención:
- `contacto.html` (atributos `minlength` y `maxlength` para `MAIN-002`).
- `demos/reposteria/index.html` (sincronización de formulario y fecha para `DEMO-004` y `DEMO-005`).

---

## 3. Arquitectura y Estructura Real de Archivos

El sistema mantiene una arquitectura **Static Multi-Page Application (MPA)** en HTML5, CSS3 y JavaScript Vanilla (ES6+), sin frameworks ni dependencias externas, optimizada para GitHub Pages.

```text
kazvora-portfolio/
│
├── index.html
├── portafolio.html
├── servicios.html
├── nosotros.html
├── contacto.html
├── README.md
├── PROJECT_CONTEXT.md
│
├── assets/
│   └── icons/
│       └── favicon.svg
│
├── css/
│   └── styles.css
│
├── js/
│   ├── main.js
│   └── projects.js
│
└── demos/
    └── reposteria/
        ├── index.html
        ├── styles.css
        └── app.js