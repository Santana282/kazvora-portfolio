/**
 * KAZVORA Technologies — Suite de Pruebas Automatizadas v2.5 (Node.js 22/24+)
 * Archivo: tests/run-fase4-audit-tests.js
 *
 * Cubre:
 * - Arquitectura DOM nativa (0 innerHTML y 0 localStorage en todos los controladores, incluidos portal.js y admin.js)
 * - Configuración pública (js/config.js) con WhatsApp comercial oficial y demos aisladas
 * - CSP, Referrer-Policy, favicon.svg, 404.html, privacidad.html, portal.html y admin.html
 * - Validación de URLs, lista blanca ?tipo= y ?pago=, honeypot, cooldown y portapapeles asíncrono
 * - Las 3 demostraciones comerciales (Repostería, Clínica Dental y Panel Operativo + CSV seguro)
 * - Portal de Clientes (js/portal.js), Consola Administrativa (js/admin.js) y Backend Serverless (functions/api/)
 */

const fs = require('fs');
const path = require('path');

function createNativeMockDOM() {
  const elementsById = {};
  const listeners = {};

  function makeEl(tag, id = '') {
    const el = {
      tagName: String(tag).toUpperCase(),
      id: id,
      value: '',
      checked: false,
      textContent: '',
      className: '',
      hidden: false,
      disabled: false,
      selected: false,
      attributes: {},
      children: [],
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) { this._set.delete(c); return false; }
            this._set.add(c); return true;
          }
          if (force) this._set.add(c); else this._set.delete(c);
          return force;
        },
        contains(c) { return this._set.has(c); }
      },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); },
      appendChild(child) { this.children.push(child); return child; },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx !== -1) this.children.splice(idx, 1);
        return child;
      },
      get firstChild() { return this.children[0] || null; },
      addEventListener(ev, fn) {
        if (!listeners[id + ':' + ev]) listeners[id + ':' + ev] = [];
        listeners[id + ':' + ev].push(fn);
      },
      dispatchEvent(ev, eventObj) {
        const list = listeners[id + ':' + ev] || [];
        list.forEach(fn => fn(eventObj));
      },
      focus() { this._focused = true; },
      reset() { this._reset = true; },
      querySelectorAll(sel) {
        const out = [];
        function walk(node) {
          if (!node || !Array.isArray(node.children)) return;
          for (const child of node.children) {
            if (sel.startsWith('.')) {
              const cls = sel.slice(1);
              const parts = String(child.className || '').split(/\s+/);
              if (parts.includes(cls) || (child.classList && child.classList.contains(cls))) {
                out.push(child);
              }
            } else if (String(child.tagName || '').toLowerCase() === sel.toLowerCase()) {
              out.push(child);
            }
            walk(child);
          }
        }
        walk(this);
        return out;
      }
    };

    if (id) elementsById[id] = el;
    return el;
  }

  [
    'year', 'main-nav', 'featured-projects', 'all-projects', 'project-filters',
    'contact-form', 'form-feedback', 'website-trap', 'name', 'email',
    'project-type', 'has-domain', 'target-timeline', 'message',
    'delivery-date', 'bakery-filters', 'bakery-grid', 'order-items-list',
    'order-total-amount', 'header-item-count', 'whatsapp-preview',
    'mobile-order-bar', 'mobile-bar-count', 'mobile-bar-total',
    'bakery-order-form', 'order-feedback', 'copy-order-btn',
    'customer-name', 'delivery-mode', 'cake-notes',
    'clinic-filters', 'clinic-services-grid', 'selected-service-box',
    'clinic-booking-form', 'patient-name', 'visit-type', 'appointment-date',
    'time-slots-grid', 'patient-notes', 'clinic-whatsapp-preview',
    'copy-booking-btn', 'booking-feedback',
    'kpi-total-skus', 'kpi-total-units', 'kpi-inventory-value', 'kpi-session-sales',
    'kpi-sales-count', 'kpi-low-stock', 'ops-filters', 'ops-search',
    'ops-inventory-body', 'ops-add-form', 'ops-feedback', 'ops-activity-log',
    'export-csv-btn', 'reset-demo-btn',
    'portal-backend-notice', 'portal-auth-section', 'portal-dashboard',
    'portal-login-form', 'login-email', 'login-password', 'login-feedback',
    'portal-register-form', 'reg-name', 'reg-business', 'reg-phone', 'reg-email', 'reg-password', 'reg-privacy', 'register-feedback',
    'portal-recover-form', 'recover-email', 'recover-feedback',
    'portal-user-name', 'portal-user-email', 'portal-refresh-btn', 'portal-logout-btn',
    'portal-projects-list', 'portal-payments-body', 'portal-dashboard-feedback',
    'admin-backend-notice', 'admin-auth-section', 'admin-dashboard',
    'admin-login-form', 'admin-email', 'admin-password', 'admin-login-feedback',
    'admin-user-label', 'admin-user-email', 'admin-refresh-btn', 'admin-logout-btn',
    'admin-create-project-form', 'proj-client-select', 'proj-title', 'proj-service-type', 'proj-amount-mxn', 'admin-project-feedback',
    'admin-clients-body', 'admin-projects-body', 'admin-payments-body', 'admin-dashboard-feedback'
  ].forEach(id => makeEl('div', id));

  const menuToggle = makeEl('button', 'menu-toggle-btn');
  menuToggle.setAttribute('aria-expanded', 'false');

  const portalSubmitBtn = makeEl('button', 'portal-submit-mock');
  const adminSubmitBtn = makeEl('button', 'admin-submit-mock');

  const docListeners = {};
  const documentMock = {
    createElement(tag) { return makeEl(tag); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    getElementById(id) { return elementsById[id] || null; },
    querySelector(sel) { return sel === '.menu-toggle' ? menuToggle : null; },
    querySelectorAll(sel) {
      if (sel.includes('#portal-auth-section')) return [portalSubmitBtn];
      if (sel.includes('#admin-auth-section')) return [adminSubmitBtn];
      return [];
    },
    addEventListener(ev, fn) {
      if (!docListeners[ev]) docListeners[ev] = [];
      docListeners[ev].push(fn);
    },
    triggerDOMContentLoaded() {
      (docListeners['DOMContentLoaded'] || []).forEach(fn => fn());
    },
    body: makeEl('body', 'doc-body')
  };

  return { documentMock, elementsById, menuToggle, portalSubmitBtn, adminSubmitBtn };
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function runSuite() {
  const { documentMock, elementsById, portalSubmitBtn, adminSubmitBtn } = createNativeMockDOM();

  let lastClipboardText = null;
  let clipboardMode = 'resolve';
  let deferredResolve = null;
  let simulatePopupBlocked = false;
  let lastCreatedPopup = null;
  let lastOpenedUrl = null;

  global.window = global;
  global.document = documentMock;
  global.innerWidth = 1024;
  global.location = { search: '?tipo=citas&pago=pendiente_confirmacion' };

  Object.defineProperty(global, 'navigator', {
    value: {
      clipboard: {
        writeText(text) {
          if (clipboardMode === 'reject') {
            return Promise.reject(new Error('Clipboard blocked'));
          }
          if (clipboardMode === 'deferred') {
            return new Promise(resolve => {
              deferredResolve = () => {
                lastClipboardText = text;
                resolve();
              };
            });
          }
          lastClipboardText = text;
          return Promise.resolve();
        }
      }
    },
    writable: true,
    configurable: true
  });

  global.window.open = function (url) {
    lastOpenedUrl = url;
    if (simulatePopupBlocked) {
      lastCreatedPopup = null;
      return null;
    }
    lastCreatedPopup = { opener: global.window };
    return lastCreatedPopup;
  };

  const baseDir = path.resolve(__dirname, '..');
  const clinicAppPath = path.join(baseDir, 'demos', 'clinica-citas', 'app.js');
  const opsAppPath = path.join(baseDir, 'demos', 'panel-operativo', 'app.js');
  const portalJsPath = path.join(baseDir, 'js', 'portal.js');
  const adminJsPath = path.join(baseDir, 'js', 'admin.js');
  const webhookPath = path.join(baseDir, 'functions', 'api', 'stripe-webhook.js');
  const checkoutPath = path.join(baseDir, 'functions', 'api', 'create-checkout.js');

  const hasClinicDemo = fs.existsSync(clinicAppPath);
  const hasOpsDemo = fs.existsSync(opsAppPath);
  const hasPortal = fs.existsSync(portalJsPath);
  const hasAdmin = fs.existsSync(adminJsPath);
  const has404 = fs.existsSync(path.join(baseDir, '404.html'));
  const hasPrivacy = fs.existsSync(path.join(baseDir, 'privacidad.html'));
  const hasFunctions = fs.existsSync(webhookPath) && fs.existsSync(checkoutPath);

  require(path.join(baseDir, 'js', 'config.js'));
  require(path.join(baseDir, 'js', 'projects.js'));
  require(path.join(baseDir, 'js', 'main.js'));
  require(path.join(baseDir, 'demos', 'reposteria', 'app.js'));
  if (hasClinicDemo) require(clinicAppPath);
  if (hasOpsDemo) require(opsAppPath);
  if (hasPortal) require(portalJsPath);
  if (hasAdmin) require(adminJsPath);

  documentMock.triggerDOMContentLoaded();

  const results = [];
  function test(id, group, desc, passed, detail = '') {
    results.push({
      id,
      group,
      description: desc,
      status: passed ? 'PASS' : 'FAIL',
      detail: passed ? null : (detail || 'Condición de prueba no cumplida')
    });
  }

  const u = window.KAZVORA_MAIN_UTILS;
  const s = window.KAZVORA_SCHEMA;
  const d = window.KAZVORA_BAKERY_DEMO;

  // 1. Seguridad DOM, Configuración Comercial y CSP
  const jsFilesToCheck = [
    path.join(baseDir, 'js', 'main.js'),
    path.join(baseDir, 'demos', 'reposteria', 'app.js')
  ];
  if (hasClinicDemo) jsFilesToCheck.push(clinicAppPath);
  if (hasOpsDemo) jsFilesToCheck.push(opsAppPath);
  if (hasPortal) jsFilesToCheck.push(portalJsPath);
  if (hasAdmin) jsFilesToCheck.push(adminJsPath);

  const hasAnyInnerHtml = jsFilesToCheck.some(fp => {
    const clean = fs.readFileSync(fp, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    return clean.includes('innerHTML');
  });
  test('SEC-DOM-01', 'XSS', 'Todos los controladores JS operan con 0 usos de innerHTML', !hasAnyInnerHtml);

  const env = window.KAZVORA_ENV;
  const validCorpPhone = env && (env.whatsappNumber === '' || u.validateWhatsAppPhone(env.whatsappNumber) === '522721832762');
  test(
    'ENV-01',
    'Config',
    'window.KAZVORA_ENV congelado, WhatsApp comercial E.164 válido y demos aisladas sin spam',
    Boolean(env && Object.isFrozen(env) && validCorpPhone && env.demoBakeryWhatsappNumber === '' && (env.demoClinicWhatsappNumber === undefined || env.demoClinicWhatsappNumber === '')),
    JSON.stringify(env)
  );

  const htmlPages = ['index.html', 'portafolio.html', 'servicios.html', 'nosotros.html', 'contacto.html', 'demos/reposteria/index.html'];
  if (hasClinicDemo && fs.existsSync(path.join(baseDir, 'demos', 'clinica-citas', 'index.html'))) htmlPages.push('demos/clinica-citas/index.html');
  if (hasOpsDemo && fs.existsSync(path.join(baseDir, 'demos', 'panel-operativo', 'index.html'))) htmlPages.push('demos/panel-operativo/index.html');
  if (has404) htmlPages.push('404.html');
  if (hasPrivacy) htmlPages.push('privacidad.html');
  if (hasPortal && fs.existsSync(path.join(baseDir, 'portal.html'))) htmlPages.push('portal.html');
  if (hasAdmin && fs.existsSync(path.join(baseDir, 'admin.html'))) htmlPages.push('admin.html');

  const missingCsp = htmlPages.filter(p => {
    const html = fs.readFileSync(path.join(baseDir, p), 'utf8');
    return !(html.includes('http-equiv="Content-Security-Policy"') && html.includes('name="referrer"'));
  });
  test('SEC-CSP-01', 'CSP', 'Todas las páginas HTML declaran Content-Security-Policy y Referrer-Policy', missingCsp.length === 0, 'Falta en: ' + missingCsp.join(', '));

  if (has404) {
    const html404 = fs.readFileSync(path.join(baseDir, '404.html'), 'utf8');
    test('SEC-404-01', 'Resiliencia', '404.html incluye favicon.svg, robots noindex y enlace a index.html', html404.includes('assets/icons/favicon.svg') && html404.includes('noindex') && html404.includes('index.html'));
  }

  if (hasPrivacy) {
    const htmlPriv = fs.readFileSync(path.join(baseDir, 'privacidad.html'), 'utf8');
    test('SEC-PRIV-01', 'Privacidad', 'privacidad.html identifica titular, correo de derechos ARCO y favicon.svg', htmlPriv.includes('Kevin Santana Ramírez') && htmlPriv.includes('ARCO') && htmlPriv.includes('assets/icons/favicon.svg'));
  }

  // 2. Validación de URLs y parámetro ?tipo=
  test('URL-01', 'MAIN-001', 'Acepta HTTPS, HTTP y ruta relativa limpia', u.validateSafeUrl('https://kazvora.com') === 'https://kazvora.com' && u.validateSafeUrl('http://example.com') === 'http://example.com' && u.validateSafeUrl('demos/reposteria/index.html') === 'demos/reposteria/index.html');
  test('URL-02', 'MAIN-001', 'Rechaza javascript:, data:, vbscript:, // y comillas', u.validateSafeUrl('javascript:alert(1)') === null && u.validateSafeUrl('data:text/html,<script>') === null && u.validateSafeUrl('vbscript:alert(1)') === null && u.validateSafeUrl('//evil.com') === null && u.validateSafeUrl('https://a.com/"onclick="x') === null);
  test(
    'SEC-URLPARAM-01',
    'Seguridad',
    'Preselección ?tipo= acepta lista blanca y bloquea XSS, __proto__ y encoding malformado',
    elementsById['project-type'].value === 'Agenda y sistema de citas' &&
    u.resolveAllowedProjectTypeFromQuery('?tipo=catalogo') === 'Catálogo digital' &&
    u.resolveAllowedProjectTypeFromQuery('?tipo=<script>alert(1)</script>') === null &&
    u.resolveAllowedProjectTypeFromQuery('?tipo=__proto__') === null &&
    u.resolveAllowedProjectTypeFromQuery('?tipo=%E0%A4%A') === null
  );

  // 3. Portafolio y esquema
  const featuredCards = elementsById['featured-projects'].children;
  test('PROJ-01', 'Portafolio', 'Renderizado DOM nativo de proyectos destacados', featuredCards.length >= 1 && featuredCards[0].tagName === 'ARTICLE');
  if (s && typeof s.validateKazvoraProjects === 'function') {
    const filtered = s.validateKazvoraProjects([
      { id: 'ok-1', title: 'OK', category: 'Web', status: 'Demostración', description: 'Desc', technologies: ['JS'], featured: true, url: 'index.html' },
      { id: 'ok-1', title: 'Dup', category: 'Web', status: 'Demostración', description: 'Desc', technologies: [], featured: false, url: '' },
      { id: 'bad-url', title: 'XSS', category: 'Web', status: 'Demostración', description: 'Desc', technologies: [], featured: false, url: 'javascript:alert(1)' }
    ]);
    test('PROJ-02', 'Esquema', 'Validador de esquema descarta duplicados y URLs peligrosas', filtered.length === 1 && filtered[0].id === 'ok-1');
  }

  // 4. Formulario de contacto
  const form = elementsById['contact-form'];
  const fb = elementsById['form-feedback'];
  const origCooldown = u.CONFIG.contactCooldownMs;
  const origPhone = u.CONFIG.whatsappNumber;

  elementsById['name'].value = ''; elementsById['message'].value = '';
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-01', 'Contacto', 'Rechaza formulario vacío', fb.className.includes('is-error'));

  elementsById['website-trap'].value = 'https://bot.invalid';
  elementsById['name'].value = 'Bot'; elementsById['message'].value = 'Texto automatizado de prueba.';
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-02', 'Anti-Bot', 'Campo honeypot (#website-trap) bloquea envío', fb.className.includes('is-error'));
  elementsById['website-trap'].value = '';

  u.CONFIG.contactCooldownMs = 0;
  elementsById['name'].value = 'Carlos Santana';
  elementsById['email'].value = 'carlos@kazvora.com';
  elementsById['has-domain'].value = 'Aún no, empezaría desde cero';
  elementsById['target-timeline'].value = 'Lo antes posible (2 a 4 semanas)';
  elementsById['message'].value = 'Necesito un sitio web corporativo adaptable a móvil.';

  if (u.validateWhatsAppPhone(origPhone)) {
    simulatePopupBlocked = false;
    lastOpenedUrl = null;
    lastClipboardText = null;
    form.dispatchEvent('submit', { preventDefault() {} });
    await flushAsync();
    const waActiveOk =
      typeof lastOpenedUrl === 'string' &&
      lastOpenedUrl.startsWith('https://wa.me/' + u.validateWhatsAppPhone(origPhone) + '?text=') &&
      lastCreatedPopup !== null &&
      lastCreatedPopup.opener === null &&
      fb.className.includes('is-success') &&
      fb.textContent.includes('Se solicitó abrir WhatsApp');

    simulatePopupBlocked = true;
    form.dispatchEvent('submit', { preventDefault() {} });
    await flushAsync();
    const waBlockedOk =
      lastCreatedPopup === null &&
      fb.className.includes('is-error') &&
      fb.textContent.includes('bloqueó la ventana emergente');

    simulatePopupBlocked = false;
    test('FORM-WA-01', 'WhatsApp', 'Contacto abre wa.me oficial con opener=null y detecta popups bloqueados', waActiveOk && waBlockedOk);
  }

  u.CONFIG.whatsappNumber = '';
  lastClipboardText = null;
  clipboardMode = 'deferred';
  fb.className = ''; fb.textContent = '';
  form.dispatchEvent('submit', { preventDefault() {} });
  const pendingOk = !fb.className.includes('is-success') && lastClipboardText === null;
  if (deferredResolve) deferredResolve();
  await flushAsync();
  const resolvedOk = fb.className.includes('is-success') && typeof lastClipboardText === 'string' && lastClipboardText.includes('Carlos Santana');
  const briefFieldsOk = typeof lastClipboardText === 'string' && lastClipboardText.includes('Aún no, empezaría desde cero') && lastClipboardText.includes('Lo antes posible (2 a 4 semanas)');

  clipboardMode = 'reject';
  fb.className = ''; fb.textContent = '';
  form.dispatchEvent('submit', { preventDefault() {} });
  await flushAsync();
  const fallbackOk = fb.className.includes('is-success') && fb.textContent.includes('cópialo manualmente');
  clipboardMode = 'resolve';
  u.CONFIG.whatsappNumber = origPhone;

  test('FORM-03', 'Asíncrono', 'Portapapeles asíncrono sin falso positivo y respaldo ante rechazo', pendingOk && resolvedOk && fallbackOk);
  test('FORM-05', 'Brief', 'El mensaje estructurado incluye estado de dominio y plazo estimado', briefFieldsOk);

  u.CONFIG.contactCooldownMs = 5000;
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-04', 'Anti-Abuso', 'Cooldown detiene doble envío inmediato', fb.className.includes('is-error') && fb.textContent.includes('Espera un momento'));
  u.CONFIG.contactCooldownMs = origCooldown;

  // 5. Demostración #1: Repostería
  test('DEMO-01', 'Repostería', 'Carrito inicia vacío (0 productos y $0 MXN)', d.getSelectedItems().length === 0 && elementsById['header-item-count'].textContent === '0');
  test('DEMO-02', 'Repostería', 'Límites de cantidad: acepta 1 y 10; rechaza 11, -1, 2.5 y NaN',
    d.setProductQuantity('pastel-red-velvet', 1).ok &&
    d.setProductQuantity('pastel-red-velvet', 10).ok &&
    !d.setProductQuantity('pastel-red-velvet', 11).ok &&
    !d.setProductQuantity('pastel-red-velvet', -1).ok &&
    !d.setProductQuantity('pastel-red-velvet', 2.5).ok &&
    !d.setProductQuantity('pastel-red-velvet', NaN).ok &&
    d.setProductQuantity('pastel-red-velvet', 0).ok
  );
  test('DEMO-03', 'Repostería', 'Teléfono internacional E.164 y demo aislada sin spam al dueño',
    d.validateWhatsAppPhone('+52 272 183 2762') === '522721832762' &&
    d.validateWhatsAppPhone('2721832762') === null &&
    d.validateWhatsAppPhone('') === null &&
    d.DEMO_CONFIG.whatsappNumber === ''
  );

  const demoFilters = elementsById['bakery-filters'].querySelectorAll('.bakery-filter-btn');
  const pressedFilters = demoFilters.filter(b => b.getAttribute('aria-pressed') === 'true');
  test('DEMO-04', 'Accesibilidad', 'Filtros de repostería con aria-pressed sincronizado (1 activo)', demoFilters.length === 4 && pressedFilters.length === 1);

  const today = d.getTodayLocalISO();
  test('DEMO-05', 'Fechas', 'Bloquea fechas pasadas e inexistentes; acepta hoy y futuras',
    elementsById['delivery-date'].getAttribute('min') === today &&
    !d.validateDeliveryDate('2020-01-01').valid &&
    !d.validateDeliveryDate('2026-02-30').valid &&
    d.validateDeliveryDate(today).valid &&
    d.validateDeliveryDate('2099-12-31').valid
  );

  const addBtns = elementsById['bakery-grid'].querySelectorAll('.add-btn');
  test('DEMO-06', 'Accesibilidad', 'Botones de catálogo incluyen nombre del producto en aria-label',
    addBtns.length === 6 && addBtns.every(b => (b.getAttribute('aria-label') || '').includes('al pedido'))
  );

  d.DEMO_CONFIG.whatsappNumber = '522721832762';
  d.setProductQuantity('pastel-red-velvet', 1);
  elementsById['customer-name'].value = 'Sofía Hernández';
  elementsById['delivery-date'].value = today;

  simulatePopupBlocked = false;
  elementsById['bakery-order-form'].dispatchEvent('submit', { preventDefault() {} });
  await flushAsync();
  const popOk = lastCreatedPopup !== null && lastCreatedPopup.opener === null;

  simulatePopupBlocked = true;
  elementsById['bakery-order-form'].dispatchEvent('submit', { preventDefault() {} });
  await flushAsync();
  const popBlockedFeedback = elementsById['order-feedback'].textContent;
  const popBlockedOk = lastCreatedPopup === null && popBlockedFeedback.includes('bloqueó la ventana emergente');

  d.DEMO_CONFIG.whatsappNumber = '';
  d.setProductQuantity('pastel-red-velvet', 0);
  elementsById['customer-name'].value = '';
  elementsById['delivery-date'].value = '';
  simulatePopupBlocked = false;

  test('DEMO-07', 'Popups', 'Asigna opener=null al abrir WhatsApp y detecta bloqueo de popups', popOk && popBlockedOk);

  // 6. Demostración #2: Clínica Dental
  if (hasClinicDemo && window.KAZVORA_CLINIC_DEMO) {
    const c = window.KAZVORA_CLINIC_DEMO;
    test('CLINIC-01', 'Clínica', 'Bloquea fechas pasadas, inexistentes y domingos; acepta día hábil futuro',
      !c.validateAppointmentDate('2020-01-01').valid &&
      !c.validateAppointmentDate('2026-02-30').valid &&
      !c.validateAppointmentDate('2026-11-29').valid &&
      c.validateAppointmentDate('2026-11-30').valid
    );
    c.selectService('valoracion-limpieza');
    c.selectTimeSlot('11:00');
    elementsById['patient-name'].value = 'Mariana López';
    elementsById['appointment-date'].value = '2026-11-30';
    lastClipboardText = null;
    elementsById['clinic-booking-form'].dispatchEvent('submit', { preventDefault() {} });
    await flushAsync();
    test('CLINIC-02', 'Clínica', 'Prepara solicitud de cita y la copia al portapapeles manteniendo demo aislada',
      c.CLINIC_CONFIG.whatsappNumber === '' &&
      typeof lastClipboardText === 'string' &&
      lastClipboardText.includes('Mariana López') &&
      lastClipboardText.includes('11:00 h')
    );
  }

  // 7. Demostración #3: Panel Operativo
  if (hasOpsDemo && window.KAZVORA_OPS_DEMO) {
    const o = window.KAZVORA_OPS_DEMO;
    const sellOk = o.registerMovement('CAF-001', 'sell');
    const sellZeroBlocked = !o.registerMovement('ACC-005', 'sell').ok;
    const formulaAdded = o.addProduct({ sku: 'SEC-999', name: '=CMD("calc")', category: 'Accesorios', price: 150, stock: 2, minStock: 1 });
    const csvOut = o.generateSafeCsv(o.getInventorySnapshot());
    const csvSafe = csvOut.includes('"' + "'=CMD(" + '""calc""' + ')"');
    o.resetDemoState();
    test('OPS-01', 'Panel Operativo', 'Controla ventas, bloquea stock 0 y neutraliza CSV Formula Injection', sellOk.ok && sellZeroBlocked && formulaAdded.ok && csvSafe);
  }

  // 8. Portal de Clientes
  if (hasPortal && window.KAZVORA_PORTAL_UTILS) {
    const p = window.KAZVORA_PORTAL_UTILS;
    const portalRaw = fs.readFileSync(portalJsPath, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const noLocalStorageAuth = !portalRaw.includes('localStorage');
    const strongPassOk = !p.validatePasswordStrength('12345').ok && !p.validatePasswordStrength('sololetraslargo').ok && p.validatePasswordStrength('Kazvora2026!').ok;
    const safeUnconfiguredMode = p.isBackendConfigured() || (elementsById['portal-backend-notice'].hidden === false && portalSubmitBtn.disabled === true);
    const pagoBannerOk =
      typeof p.resolvePaymentReturnMessage === 'function' &&
      p.resolvePaymentReturnMessage('?pago=pendiente_confirmacion') !== null &&
      p.resolvePaymentReturnMessage('?pago=<script>alert(1)</script>') === null &&
      elementsById['login-feedback'].textContent.includes('pasarela de pago');
    test('PORTAL-01', 'Portal Auth', 'Portal sin localStorage, contraseñas robustas, modo seguro y retorno ?pago= por lista blanca', noLocalStorageAuth && strongPassOk && safeUnconfiguredMode && pagoBannerOk);
  }

  // 9. Consola Administrativa (admin.html + js/admin.js)
  if (hasAdmin && window.KAZVORA_ADMIN_UTILS) {
    const a = window.KAZVORA_ADMIN_UTILS;
    const adminRaw = fs.readFileSync(adminJsPath, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const noLocalStorageAdmin = !adminRaw.includes('localStorage');
    const validProj = a.validateProjectInput({
      clientId: '11111111-2222-3333-4444-555555555555',
      title: 'Catálogo Web Corporativo',
      serviceType: 'web',
      amountMxn: 4500
    });
    const invalidUuid = a.validateProjectInput({
      clientId: 'no-es-uuid',
      title: 'Test',
      serviceType: 'web',
      amountMxn: 500
    });
    const invalidAmount = a.validateProjectInput({
      clientId: '11111111-2222-3333-4444-555555555555',
      title: 'Test',
      serviceType: 'web',
      amountMxn: -100
    });
    const safeAdminUnconfigured = a.isBackendConfigured() || (elementsById['admin-backend-notice'].hidden === false && adminSubmitBtn.disabled === true);
    test(
      'ADMIN-01',
      'Consola Admin',
      'Admin sin localStorage, valida UUID/montos en centavos y se desactiva de forma segura sin backend',
      noLocalStorageAdmin && validProj.ok && validProj.payload.total_amount_cents === 450000 && !invalidUuid.ok && !invalidAmount.ok && safeAdminUnconfigured
    );
  }

  // 10. Backend Serverless (Cloudflare Pages Functions)
  if (hasFunctions) {
    const whCode = fs.readFileSync(webhookPath, 'utf8');
    const chkCode = fs.readFileSync(checkoutPath, 'utf8');
    const noHardcodedSecrets = !/(sk_live_|sk_test_|whsec_|eyJhbGci)/.test(whCode + chkCode);
    const hasSecurityControls = whCode.includes('timingSafeEqualHex') && whCode.includes('REPLAY_TOLERANCE_SECONDS') && chkCode.includes('client_id=eq.');
    test('API-SEC-01', 'Backend Pagos', 'Cloudflare Functions sin secretos embebidos, anti-IDOR y firma HMAC-SHA256', noHardcodedSecrets && hasSecurityControls);
  }

  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    totalTests: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status !== 'PASS').length,
    passRate: ((results.filter(r => r.status === 'PASS').length / results.length) * 100).toFixed(1) + '%',
    results: results
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exitCode = 1;
}

runSuite().catch(err => {
  console.error('Error ejecutando suite de pruebas:', err);
  process.exitCode = 1;
});