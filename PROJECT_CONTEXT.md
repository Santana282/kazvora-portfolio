# PROJECT_CONTEXT.md — KAZVORA Technologies

> **Versión:** v2.1.0 (Bloques 1, 2 y 3 completados en código)  
> **Repositorio:** `Santana282/kazvora-portfolio`  
> **Entorno temporal:** GitHub Pages (preparado para migración a dominio propio)

---

## 1. Identidad Oficial y Pilares Tecnológicos

- **Marca:** KAZVORA Technologies
- **Eslogan principal:** «Tecnología que convierte ideas en soluciones»
- **Eslogan de lámina oficial:** «Ideas que se convierten en soluciones.»
- **Paleta:** `#0b0d10` (base), `#ff454f` / `#d72e3b` (rojo), `#83ddff` (azul cielo), `#ff9ce8` (rosa)
- **Logotipo vectorial:** `assets/icons/favicon.svg`
- **Cinco verticales de marca:**
  1. Desarrollo Web *(Disponible hoy)*
  2. Software *(Disponible hoy)*
  3. Bases de Datos *(En evolución)*
  4. Inteligencia Artificial *(Hoja de ruta)*
  5. Cloud Solutions *(Hoja de ruta)*

---

## 2. Arquitectura y Seguridad Implementada (v2.1)

- **Stack:** HTML5, CSS3 y JavaScript Vanilla (ES6+), cero dependencias externas en runtime.
- **Anti-XSS estructural:** Eliminación completa de `.innerHTML` en `js/main.js` y `demos/reposteria/app.js`; toda la interfaz dinámica se construye con nodos DOM nativos y `textContent`.
- **Seguridad en navegador:** `Content-Security-Policy` restrictiva y `Referrer-Policy` en las 6 vistas HTML.
- **Entorno desacoplado:** `js/config.js` expone `window.KAZVORA_ENV` congelado (`Object.freeze`) sin secretos ni números ficticios.
- **DevSecOps:** `.gitignore` anti-secretos, `SECURITY.md` y CI en `.github/workflows/ci-security.yml` con mínimo privilegio (`contents: read`).

---

## 3. Matriz de Estado

| Área | Estado | Notas |
| :--- | :--- | :--- |
| Sitio corporativo v2.1 (`index`, `servicios`, `portafolio`, `nosotros`, `contacto`, `css/styles.css`) | **Implementado** | Alineado a las 5 verticales oficiales y protegido con CSP. |
| Controladores DOM nativos (`js/config.js`, `js/main.js`, `demos/reposteria/app.js`) | **Implementado** | 0 `innerHTML`, honeypot, cooldown, E.164 y fecha mínima local. |
| Demo Comercial #1 (`demos/reposteria/`) | **Implementado** | Estilo gourmet v2.1, carrito inicial en 0, tope 10 unidades y accesibilidad ARIA. |
| Suite automatizada (`tests/run-fase4-audit-tests.js`) y CI (`ci-security.yml`) | **Implementado** | Pendiente ejecución final en tu Node.js local y en GitHub Actions. |
| Número oficial de WhatsApp Business (`js/config.js`) | **Pendiente** | Requiere autorización comercial del fundador. |
| Pruebas manuales en navegador real (escritorio/móvil/teclado) | **Pendiente** | Verificar con Live Server antes de fusionar `dev` → `main`. |
| Migración a dominio propio + cabeceras HTTP (`_headers` en Cloudflare Pages) | **Propuesto** | Siguiente hito de infraestructura cuando se autorice dominio comercial. |
