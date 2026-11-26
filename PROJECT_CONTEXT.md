# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Versión:** v2.2.0 (Bloques 1–5: Sitio Corporativo, 2 Demostraciones Comerciales, Brief Inteligente, `404.html` y CI Node.js 22)  
> **Repositorio:** `Santana282/kazvora-portfolio`  
> **Entorno temporal:** GitHub Pages (arquitectura portable preparada para migración a Cloudflare Pages + dominio propio)

---

## 1. Identidad Oficial y Pilares Tecnológicos

- **Marca:** KAZVORA Technologies
- **Eslogan principal:** «Tecnología que convierte ideas en soluciones»
- **Eslogan de lámina oficial:** «Ideas que se convierten en soluciones.»
- **Paleta:** `#0b0d10` (base), `#ff454f` / `#d72e3b` (rojo), `#83ddff` (azul cielo), `#ff9ce8` (rosa)
- **Logotipo vectorial:** `assets/icons/favicon.svg`
- **Cinco verticales de marca:** Desarrollo Web y Software *(disponibles hoy)*; Bases de Datos, Inteligencia Artificial y Cloud Solutions *(hoja de ruta)*.

---

## 2. Arquitectura y Controles de Seguridad Activos (v2.2)

- **Stack:** HTML5, CSS3 y JavaScript Vanilla (ES6+), cero dependencias externas en runtime.
- **Anti-XSS estructural:** `0` usos ejecutables de `.innerHTML` en `js/main.js`, `demos/reposteria/app.js` y `demos/clinica-citas/app.js`.
- **Seguridad en navegador:** `Content-Security-Policy` restrictiva y `Referrer-Policy` en las 8 vistas HTML (incluyendo `404.html`).
- **Validación positiva:** Lista blanca de protocolos en URLs (`http:`, `https:` y rutas relativas), lista blanca cerrada en `?tipo=` (`Object.prototype.hasOwnProperty.call`), validación E.164 y honeypot + cooldown en contacto.
- **Configuración desacoplada:** `js/config.js` (`Object.freeze(window.KAZVORA_ENV)`) sin secretos ni números ficticios.
- **DevSecOps:** `.gitignore`, `SECURITY.md` y `.github/workflows/ci-security.yml` con mínimo privilegio (`contents: read`).

---

## 3. Matriz de Estado

| Área | Estado | Notas |
| :--- | :--- | :--- |
| Sitio corporativo (`index`, `servicios`, `portafolio`, `nosotros`, `contacto`, `404`, `css/styles.css`) | **Implementado** | Alineado a las 5 verticales oficiales, brief estructurado y `404.html`. |
| Demostración Comercial #1 (`demos/reposteria/`) | **Implementado** | Catálogo gourmet oscuro, carrito en 0, tope 10 unidades y respaldo de popups. |
| Demostración Comercial #2 (`demos/clinica-citas/`) | **Implementado** | Estética clínica clara, bloqueo de fechas pasadas y domingos, selector de horarios. |
| Suite CI (`tests/run-fase4-audit-tests.js` v2.2) | **Implementado** | 23 pruebas automatizadas compatibles con Node.js 22 LTS. |
| Número oficial de WhatsApp Business (`js/config.js`) | **Pendiente** | Requiere autorización comercial del fundador. |
| Migración a dominio propio + cabeceras HTTP (`_headers`) + primer backend real | **Propuesto** | Siguiente fase estratégica cuando el fundador autorice dominio e infraestructura. |