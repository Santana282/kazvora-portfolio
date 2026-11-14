# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Documento Maestro de Contexto Técnico y Trazabilidad de Ingeniería**  
> **Última actualización:** Fase 1 — Auditoría Inicial y Establecimiento de Gobernanza Técnica  
> **Estado General:** En Auditoría de Código Fuente (`Pendiente` recepción de snapshot del repositorio)

---

## 1. Identidad Técnica y Comercial del Proyecto

- **Empresa:** KAZVORA Technologies
- **Eslogan en Documento Maestro:** «Tecnología que convierte ideas en soluciones»
- **Eslogan en Lámina Oficial:** «Ideas que se convierten en soluciones.»
- **Verticales Oficiales (según identidad visual):**
  1. Desarrollo Web
  2. Software
  3. Bases de Datos
  4. Inteligencia Artificial
  5. Cloud Solutions[cite: 1]
- **Sistema de Diseño (Design Tokens base):**
  - `--bg-primary`: `#0b0d10` (Negro base)
  - `--accent-red`: `#ff454f` (Rojo principal)
  - `--accent-red-dark`: `#d72e3b` (Rojo oscuro / hover)
  - `--accent-sky`: `#83ddff` (Azul cielo complementario)
  - `--accent-pink`: `#ff9ce8` (Rosa complementario)
- **Entorno de Producción:** GitHub Pages (`https://santana282.github.io/kazvora-portafolio/`)
- **Repositorio Oficial:** `https://github.com/santana282/kazvora-portafolio`

---

## 2. Arquitectura del Sistema

El proyecto opera actualmente bajo una arquitectura **Static Multi-Page Application (MPA)** sin dependencias de servidor (Serverless Static Hosting en GitHub Pages), ideal para alto rendimiento, coste operativo cero (`$0 USD/mes`) y máxima seguridad de superficie.

- **Capa de Presentación (HTML5):** Páginas independientes por intención de búsqueda y navegación (`index.html`, `portafolio.html`, `servicios.html`, `nosotros.html`, `contacto.html`).
- **Capa de Estilos (CSS3 Vanilla):** Hoja de estilos centralizada (`css/styles.css`) basada en variables CSS (Custom Properties), diseño adaptativo (Responsive Design) e identidad oscura tecnológica.
- **Capa de Datos Cliente (`js/projects.js`):** Fuente de datos desacoplada expuesta en el objeto global `window.KAZVORA_PROJECTS` para alimentar tanto la vista de proyectos destacados en inicio como el catálogo filtrable en portafolio.
- **Capa de Control e Interacción (`js/main.js`):** Controlador único en cliente encargado de:
  - Navegación móvil (menú hamburguesa y accesibilidad).
  - Renderizado dinámico de tarjetas de proyectos y destacados.
  - Filtrado por categorías en el portafolio.
  - Cálculo automático del año en el pie de página (`footer`).
  - Procesamiento del formulario de contacto (preparación/copiado de mensaje y futura integración directa con WhatsApp Business).
- **Arquitectura Prevista para Demostraciones Comerciales (`/demos/<sector>/`):** Subdirectorios autónomos dentro del mismo repositorio que permiten publicar demostraciones interactivas (ej. `/demos/reposteria/index.html`) con su propia identidad visual sin contaminar el CSS ni el JS corporativo de KAZVORA.

---

## 3. Estructura de Archivos

```text
kazvora-portafolio/
│
├── index.html                  [Pendiente de inspección de código]
├── portafolio.html             [Pendiente de inspección de código]
├── servicios.html              [Pendiente de inspección de código]
├── nosotros.html               [Pendiente de inspección de código]
├── contacto.html               [Pendiente de inspección de código]
├── readme.md                   [Pendiente de inspección de código]
├── PROJECT_CONTEXT.md          [Implementado - v1.0.0]
│
├── assets/
│   └── icons/
│       └── favicon.svg         [Pendiente de inspección de código]
│
├── css/
│   └── styles.css              [Pendiente de inspección de código]
│
└── js/
    ├── main.js                 [Pendiente de inspección de código]
    └── projects.js             [Pendiente verificar nombre exacto y estructura]