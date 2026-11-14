# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Documento Maestro de Contexto Técnico, Auditoría y Trazabilidad de Ingeniería**  
> **Versión del documento:** v1.3.1 (Fase 4 — Revisión 2: Corrección Asíncrona `T-MAIN-002.5` y Paquete Completo)  
> **Fecha de intervención:** 14 de noviembre de 2026  
> **Repositorio oficial:** `Santana282/kazvora-portfolio` (rama de referencia: `main`)  
> **Responsable del proyecto:** Kevin Santana Ramírez  
> **Auditor independiente:** ChatGPT (Arquitectura, seguridad y control de calidad)  
> **Ingeniero ejecutor:** Gemini 4 Argon  
> **Estado general:** Fase 4 en corrección controlada (Etapa A completada; pendiente Etapa B de re-ejecución independiente de las 40 pruebas dinámicas y pruebas manuales en navegador real, y Etapa C de autorización del fundador).

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

## 2. Línea Base de la Auditoría y Registro de Hashes (Fase 4)

### 2.1 Archivos de la Línea Base Original Auditada

| Archivo | SHA Original Abreviado (Línea Base) | Git Blob SHA-1 Abreviado (Fase 4) | SHA-256 en Fase 4 | Estado en Revisión 2 |
| :--- | :--- | :--- | :--- | :--- |
| `js/main.js` | `39c8905c157e` | `c37752e24aee` | `01c69d0642b665a89643bd1703980540931c56ad1aab97cff231be2e6a9bf17a` | Preservado sin cambios (superó auditoría) |
| `js/projects.js` | `f842d5dac918` | `b52d4a841713` | `e72c8c6e77eed99786844e2a03a651cf15d0dc881be73fee80bdd411506ac2d5` | Preservado sin cambios (superó auditoría) |
| `demos/reposteria/app.js` | `94733cd2d25b` | `2d6d7b965875` | `cddefe7128e442cf63d02f2f14158a2f7300c936953318ef4ecd073170c5d4be` | Preservado sin cambios (superó auditoría) |
| `PROJECT_CONTEXT.md` | `55c2c1e0617b` | `9d8c1408b214` (v1.3.0) | Actualizado en v1.3.1 | Modificado en Revisión 2 (`DOC-001`, `DOC-002`) |

### 2.2 Archivos Complementarios y de Pruebas en el Paquete Completo

| Archivo | Propósito | SHA-256 Anterior (Entrega Fase 4 v1) | Estado en Revisión 2 |
| :--- | :--- | :--- | :--- |
| `index.html` | Página institucional principal | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `portafolio.html` | Catálogo filtrable de proyectos | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `servicios.html` | Servicios institucionales | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `nosotros.html` | Presentación y principios de KAZVORA | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `contacto.html` | Formulario con límites de longitud | `3e24527853f0afa7d8fa808724f8ce77d46bb9f52d281794843c0f3d276e695e` | Preservado sin cambios |
| `README.md` | Documentación principal del repositorio | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `assets/icons/favicon.svg` | Identidad gráfica vectorial | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `css/styles.css` | Estilos institucionales | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `demos/reposteria/index.html` | Estructura HTML de Dulce Atelier | `b0fc70cb35a614624c10f34c683a2309123631be44d9a050bfb4e9961e96a551` | Preservado sin cambios |
| `demos/reposteria/styles.css` | Estilos de la demostración comercial | `N/A` (No incluido en ZIP v1) | Incorporado al paquete completo |
| `tests/run-fase4-audit-tests.js` | Suite de 40 pruebas dinámicas | `8489c5a971f0e819a2d5a760b91878e9185086a074b2c79d152a16750217b722` | Modificado (corrección asíncrona `T-MAIN-002.5`) |
| `tests/STATIC_VERIFICATION_EVIDENCE.json` | Evidencia de 6 pruebas estáticas (Python 3) | Presente en ZIP v1 | Preservado y separado de pruebas dinámicas |
| `tests/DYNAMIC_VERIFICATION_EVIDENCE.json` | Evidencia de 40 pruebas dinámicas (Node.js) | No generado en v1 | Generado automáticamente por `run-fase4-audit-tests.js` |

---

## 3. Arquitectura y Estructura Completa del Repositorio

El sistema mantiene una arquitectura **Static Multi-Page Application (MPA)** en HTML5, CSS3 y JavaScript Vanilla (ES6+), sin frameworks ni dependencias externas, 100 % compatible con GitHub Pages.

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
├── demos/
│   └── reposteria/
│       ├── index.html
│       ├── styles.css
│       └── app.js
│
└── tests/
    ├── run-fase4-audit-tests.js
    ├── STATIC_VERIFICATION_EVIDENCE.json
    └── DYNAMIC_VERIFICATION_EVIDENCE.json