# Política de Seguridad — KAZVORA Technologies

## Controles Activos (Arquitectura Estática v2.1)
- `Content-Security-Policy` restrictiva sin scripts ni estilos inline en las 6 vistas HTML.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- Construcción 100 % nativa del DOM (`document.createElement` / `textContent`) con cero usos de `innerHTML` en `js/main.js` y `demos/reposteria/app.js`.
- Lista blanca positiva de URLs (`http:`, `https:` y rutas relativas limpias) y validación de esquema de proyectos.
- Configuración pública aislada en `js/config.js` (`Object.freeze`) sin credenciales ni secretos en el cliente.
- Validación telefónica internacional E.164 y protección `window.opener = null` al abrir enlaces externos.

## Divulgación Responsable
Si detectas una posible vulnerabilidad:
1. No publiques pasos de explotación en Issues públicos.
2. Notifica de forma privada al responsable técnico de KAZVORA Technologies indicando ruta afectada, pasos de reproducción e impacto estimado.

## Protocolo ante Credenciales Expuestas
Si alguna clave o token llegara a exponerse en etapas futuras:
1. Revocar y rotar inmediatamente la credencial en el proveedor externo.
2. Auditar accesos para descartar uso no autorizado.
3. Configurar la nueva credencial únicamente mediante variables de entorno de servidor.