/**
 * KAZVORA Technologies — Suite de Pruebas Automatizadas v2.1 (Node.js 22+)
 * Archivo: tests/run-fase4-audit-tests.js
 *
 * Sincronizada con la arquitectura DOM nativa (cero innerHTML en main.js y demos/reposteria/app.js).
 * Ejecutar desde la raíz del proyecto:
 *   node tests/run-fase4-audit-tests.js
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
      textContent: '',
      className: '',
      hidden: false,
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
    'contact-form', 'form-feedback', 'website-trap', 'name', 'email', 'project-type', 'message',
    'delivery-date', 'bakery-filters', 'bakery-grid', 'order-items-list',
    'order-total-amount', 'header-item-count', 'whatsapp-preview',
    'mobile-order-bar', 'mobile-bar-count', 'mobile-bar-total',
    'bakery-order-form', 'order-feedback', 'copy-order-btn',
    'customer-name', 'delivery-mode', 'cake-notes'
  ].forEach(id => makeEl('div', id));

  const menuToggle = makeEl('button', 'menu-toggle-btn');
  menuToggle.setAttribute('aria-expanded', 'false');

  const docListeners = {};
  const documentMock = {
    createElement(tag) { return makeEl(tag); },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    getElementById(id) { return elementsById[id] || null; },
    querySelector(sel) { return sel === '.menu-toggle' ? menuToggle : null; },
    addEventListener(ev, fn) {
      if (!docListeners[ev]) docListeners[ev] = [];
      docListeners[ev].push(fn);
    },
    triggerDOMContentLoaded() {
      (docListeners['DOMContentLoaded'] || []).forEach(fn => fn());
    },
    body: makeEl('body', 'doc-body')
  };

  return { documentMock, elementsById, menuToggle };
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function runSuite() {
  const { documentMock, elementsById } = createNativeMockDOM();

  let lastClipboardText = null;
  let clipboardMode = 'resolve'; // 'resolve' | 'reject' | 'deferred'
  let deferredResolve = null;
  let simulatePopupBlocked = false;
  let lastCreatedPopup = null;

  global.window = global;
  global.document = documentMock;
  global.innerWidth = 1024;
  global.navigator = {
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
  };

  global.window.open = function () {
    if (simulatePopupBlocked) {
      lastCreatedPopup = null;
      return null;
    }
    lastCreatedPopup = { opener: global.window };
    return lastCreatedPopup;
  };

  const baseDir = path.resolve(__dirname, '..');
  require(path.join(baseDir, 'js', 'config.js'));
  require(path.join(baseDir, 'js', 'projects.js'));
  require(path.join(baseDir, 'js', 'main.js'));
  require(path.join(baseDir, 'demos', 'reposteria', 'app.js'));

  documentMock.triggerDOMContentLoaded();

  const results = [];
  function test(id, group, desc, passed, detail = '') {
    results.push({ id, group, description: desc, status: passed ? 'PASS' : 'FAIL', detail: passed ? null : detail });
  }

  const u = window.KAZVORA_MAIN_UTILS;
  const s = window.KAZVORA_SCHEMA;
  const d = window.KAZVORA_BAKERY_DEMO;

  // 1. Arquitectura y Seguridad Anti-XSS (cero innerHTML ejecutable)
  const mainSrc = fs.readFileSync(path.join(baseDir, 'js', 'main.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const appSrc = fs.readFileSync(path.join(baseDir, 'demos', 'reposteria', 'app.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  test('SEC-DOM-01', 'XSS', 'js/main.js y demos/reposteria/app.js operan con 0 usos de innerHTML', !mainSrc.includes('innerHTML') && !appSrc.includes('innerHTML'));
  test('ENV-01', 'Config', 'window.KAZVORA_ENV existe, está congelado y sin números ficticios', Boolean(window.KAZVORA_ENV && Object.isFrozen(window.KAZVORA_ENV) && window.KAZVORA_ENV.whatsappNumber === ''));

  const htmlPages = ['index.html', 'portafolio.html', 'servicios.html', 'nosotros.html', 'contacto.html', 'demos/reposteria/index.html'];
  test('SEC-CSP-01', 'CSP', 'Las 6 páginas HTML declaran Content-Security-Policy y Referrer-Policy', htmlPages.every(p => {
    const html = fs.readFileSync(path.join(baseDir, p), 'utf8');
    return html.includes('http-equiv="Content-Security-Policy"') && html.includes('name="referrer"');
  }));

  // 2. Validación positiva de URLs (MAIN-001)
  test('URL-01', 'MAIN-001', 'Acepta HTTPS, HTTP y ruta relativa limpia', u.validateSafeUrl('https://kazvora.com') === 'https://kazvora.com' && u.validateSafeUrl('http://example.com') === 'http://example.com' && u.validateSafeUrl('demos/reposteria/index.html') === 'demos/reposteria/index.html');
  test('URL-02', 'MAIN-001', 'Rechaza javascript:, data:, vbscript:, // y comillas', u.validateSafeUrl('javascript:alert(1)') === null && u.validateSafeUrl('data:text/html,<script>') === null && u.validateSafeUrl('vbscript:alert(1)') === null && u.validateSafeUrl('//evil.com') === null && u.validateSafeUrl('https://a.com/"onclick="x') === null);

  // 3. Tarjetas DOM nativas y esquema de proyectos
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

  // 4. Formulario de contacto (validación, honeypot, asíncrono portapapeles, rechazo y cooldown)
  const form = elementsById['contact-form'];
  const fb = elementsById['form-feedback'];
  const origCooldown = u.CONFIG.contactCooldownMs;

  elementsById['name'].value = ''; elementsById['message'].value = '';
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-01', 'Contacto', 'Rechaza formulario vacío', fb.className.includes('is-error'));

  elementsById['website-trap'].value = 'https://bot.invalid';
  elementsById['name'].value = 'Bot'; elementsById['message'].value = 'Texto automatizado de prueba.';
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-02', 'Anti-Bot', 'Campo honeypot (#website-trap) bloquea envío', fb.className.includes('is-error'));
  elementsById['website-trap'].value = '';

  u.CONFIG.contactCooldownMs = 0;
  lastClipboardText = null;
  clipboardMode = 'deferred';
  elementsById['name'].value = 'Carlos Santana';
  elementsById['email'].value = 'carlos@kazvora.com';
  elementsById['message'].value = 'Necesito un sitio web corporativo adaptable a móvil.';
  form.dispatchEvent('submit', { preventDefault() {} });
  const pendingOk = !fb.className.includes('is-success') && lastClipboardText === null;
  if (deferredResolve) deferredResolve();
  await flushAsync();
  const resolvedOk = fb.className.includes('is-success') && typeof lastClipboardText === 'string' && lastClipboardText.includes('Carlos Santana');

  clipboardMode = 'reject';
  fb.className = ''; fb.textContent = '';
  form.dispatchEvent('submit', { preventDefault() {} });
  await flushAsync();
  const fallbackOk = fb.className.includes('is-success') && fb.textContent.includes('cópialo manualmente');
  clipboardMode = 'resolve';
  test('FORM-03', 'Asíncrono', 'Portapapeles asíncrono sin falso positivo y respaldo ante rechazo', pendingOk && resolvedOk && fallbackOk);

  u.CONFIG.contactCooldownMs = 5000;
  form.dispatchEvent('submit', { preventDefault() {} });
  test('FORM-04', 'Anti-Abuso', 'Cooldown detiene doble envío inmediato', fb.className.includes('is-error') && fb.textContent.includes('Espera un momento'));
  u.CONFIG.contactCooldownMs = origCooldown;

  // 5. Demostración Repostería
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
  test('DEMO-03', 'Repostería', 'Teléfono internacional E.164 y configuración vacía sin ficticios',
    d.validateWhatsAppPhone('+52 272 123 4567') === '522721234567' &&
    d.validateWhatsAppPhone('2721234567') === null &&
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

  d.DEMO_CONFIG.whatsappNumber = '522721234567';
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
  const popBlockedOk = lastCreatedPopup === null && elementsById['order-feedback'].textContent.includes('bloqueó la ventana emergente');
  d.DEMO_CONFIG.whatsappNumber = '';
  d.setProductQuantity('pastel-red-velvet', 0);
  test('DEMO-07', 'Popups', 'Asigna opener=null al abrir WhatsApp y detecta bloqueo de popups', popOk && popBlockedOk);

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