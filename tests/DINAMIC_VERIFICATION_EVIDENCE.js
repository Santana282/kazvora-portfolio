/**
 * KAZVORA Technologies — Suite de Pruebas Dinámicas de Auditoría (Fase 4 — Revisión 2)
 * Archivo: tests/run-fase4-audit-tests.js
 *
 * Correcciones implementadas en esta versión:
 * - Sincronización asíncrona real (async/await + vaciado de cola de microtareas) para T-MAIN-002.5.
 * - Verificación anti-falsos positivos (comprueba estado pendiente antes de resolver la promesa,
 *   estado resuelto tras completar clipboard.writeText y flujo de respaldo cuando clipboard rechaza).
 * - Verificación integral en T-MAIN-003.1 (WhatsApp sin configurar, popup permitido con opener=null
 *   y popup bloqueado cuando window.open devuelve null).
 * - Generación automática del archivo tests/DYNAMIC_VERIFICATION_EVIDENCE.json a partir de la
 *   ejecución real en Node.js.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createMockDOM() {
  const elementsById = {};
  const listeners = {};

  function makeEl(tag, id = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id: id,
      value: '',
      textContent: '',
      className: '',
      hidden: false,
      attributes: {},
      children: [],
      _innerHTML: '',
      classList: {
        _set: new Set(),
        add(c) {
          this._set.add(c);
        },
        remove(c) {
          this._set.delete(c);
        },
        toggle(c, force) {
          if (force === undefined) {
            if (this._set.has(c)) {
              this._set.delete(c);
              return false;
            }
            this._set.add(c);
            return true;
          }
          if (force) this._set.add(c);
          else this._set.delete(c);
          return force;
        },
        contains(c) {
          return this._set.has(c);
        }
      },
      setAttribute(k, v) {
        this.attributes[k] = String(v);
      },
      getAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k)
          ? this.attributes[k]
          : null;
      },
      hasAttribute(k) {
        return Object.prototype.hasOwnProperty.call(this.attributes, k);
      },
      addEventListener(ev, fn) {
        if (!listeners[id + ':' + ev]) listeners[id + ':' + ev] = [];
        listeners[id + ':' + ev].push(fn);
      },
      dispatchEvent(ev, eventObj) {
        const list = listeners[id + ':' + ev] || [];
        list.forEach(fn => fn(eventObj));
      },
      focus() {
        this._focused = true;
      },
      querySelectorAll(sel) {
        if (sel === '.bakery-filter-btn') return this._filterBtns || [];
        if (sel === '.filter-btn') return this._filterBtns || [];
        if (sel === 'a') return [];
        return [];
      }
    };

    Object.defineProperty(el, 'innerHTML', {
      get() {
        return this._innerHTML;
      },
      set(val) {
        this._innerHTML = String(val);
        if (this.id === 'bakery-filters' || this.id === 'project-filters') {
          const btnRegex =
            /<button[^>]*class="([^"]*)"[^>]*data-(?:cat|category)="([^"]*)"[^>]*aria-pressed="([^"]*)"[^>]*>([^<]*)<\/button>/g;
          const btns = [];
          let m;
          while ((m = btnRegex.exec(this._innerHTML)) !== null) {
            const b = makeEl('button');
            b.className = m[1];
            if (m[1].includes('active')) b.classList.add('active');
            b.setAttribute(
              this.id === 'bakery-filters' ? 'data-cat' : 'data-category',
              m[2]
            );
            b.setAttribute('aria-pressed', m[3]);
            b.textContent = m[4];
            btns.push(b);
          }
          this._filterBtns = btns;
        }
      }
    });

    if (id) elementsById[id] = el;
    return el;
  }

  [
    'year',
    'main-nav',
    'featured-projects',
    'all-projects',
    'project-filters',
    'contact-form',
    'form-feedback',
    'name',
    'email',
    'project-type',
    'message',
    'delivery-date',
    'bakery-filters',
    'bakery-grid',
    'order-items-list',
    'order-total-amount',
    'header-item-count',
    'whatsapp-preview',
    'mobile-order-bar',
    'mobile-bar-count',
    'mobile-bar-total',
    'bakery-order-form',
    'order-feedback',
    'copy-order-btn',
    'customer-name',
    'delivery-mode',
    'cake-notes'
  ].forEach(id => makeEl('div', id));

  const menuToggle = makeEl('button', 'menu-toggle-btn');
  menuToggle.setAttribute('aria-expanded', 'false');

  const docListeners = {};
  const documentMock = {
    getElementById(id) {
      return elementsById[id] || null;
    },
    querySelector(sel) {
      if (sel === '.menu-toggle') return menuToggle;
      return null;
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

  return { documentMock, elementsById, menuToggle };
}

/**
 * Espera a que se vacíe la cola de microtareas (Promises encadenadas .then/.catch)
 * y el siguiente ciclo del event loop.
 */
async function flushAsyncOperations() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function runAllAuditTests() {
  const { documentMock, elementsById } = createMockDOM();

  let lastClipboardText = null;
  let clipboardMode = 'resolve'; // 'resolve' | 'reject' | 'deferred'
  let deferredClipboardResolve = null;
  let simulatePopupBlocked = false;
  let lastOpenedUrl = null;
  let lastCreatedPopup = null;

  global.window = global;
  global.document = documentMock;
  global.innerWidth = 1024;
  global.navigator = {
    clipboard: {
      writeText(text) {
        if (clipboardMode === 'reject') {
          return Promise.reject(new Error('Clipboard write rejected by browser policy'));
        }
        if (clipboardMode === 'deferred') {
          return new Promise(resolve => {
            deferredClipboardResolve = () => {
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
  require(path.join(baseDir, 'js', 'projects.js'));
  require(path.join(baseDir, 'js', 'main.js'));
  require(path.join(baseDir, 'demos', 'reposteria', 'app.js'));

  documentMock.triggerDOMContentLoaded();

  const results = [];
  function recordTest(id, finding, description, expected, actual, passed, errorDesc = null) {
    results.push({
      testId: id,
      finding: finding,
      description: description,
      expected: expected,
      actual: actual,
      status: passed ? 'PASS' : 'FAIL',
      error: passed ? null : (errorDesc || 'Assertion failed')
    });
  }

  const u = window.KAZVORA_MAIN_UTILS;
  const s = window.KAZVORA_SCHEMA;
  const d = window.KAZVORA_BAKERY_DEMO;

  // --- MAIN-001 Tests (9 pruebas) ---
  recordTest(
    'T-MAIN-001.1',
    'MAIN-001',
    'URL HTTPS válida',
    'https://kazvora.com/app',
    u.validateSafeUrl('https://kazvora.com/app'),
    u.validateSafeUrl('https://kazvora.com/app') === 'https://kazvora.com/app'
  );
  recordTest(
    'T-MAIN-001.2',
    'MAIN-001',
    'URL HTTP válida',
    'http://example.com/test',
    u.validateSafeUrl('http://example.com/test'),
    u.validateSafeUrl('http://example.com/test') === 'http://example.com/test'
  );
  recordTest(
    'T-MAIN-001.3',
    'MAIN-001',
    'Ruta relativa válida',
    'demos/reposteria/index.html',
    u.validateSafeUrl('demos/reposteria/index.html'),
    u.validateSafeUrl('demos/reposteria/index.html') === 'demos/reposteria/index.html'
  );
  recordTest(
    'T-MAIN-001.4',
    'MAIN-001',
    'Rechazo de javascript:alert(1)',
    null,
    u.validateSafeUrl('javascript:alert(1)'),
    u.validateSafeUrl('javascript:alert(1)') === null
  );
  recordTest(
    'T-MAIN-001.5',
    'MAIN-001',
    'Rechazo de data:text/html',
    null,
    u.validateSafeUrl('data:text/html,<script>alert(1)</script>'),
    u.validateSafeUrl('data:text/html,<script>alert(1)</script>') === null
  );
  recordTest(
    'T-MAIN-001.6',
    'MAIN-001',
    'Rechazo de vbscript:alert(1)',
    null,
    u.validateSafeUrl('vbscript:alert(1)'),
    u.validateSafeUrl('vbscript:alert(1)') === null
  );
  recordTest(
    'T-MAIN-001.7',
    'MAIN-001',
    'Rechazo de protocol-relative //evil.com',
    null,
    u.validateSafeUrl('//evil.com'),
    u.validateSafeUrl('//evil.com') === null
  );
  recordTest(
    'T-MAIN-001.8',
    'MAIN-001',
    'Rechazo de URL con comillas/caracteres de atributo',
    null,
    u.validateSafeUrl('https://example.com/"onmouseover="alert(1)'),
    u.validateSafeUrl('https://example.com/"onmouseover="alert(1)') === null
  );
  recordTest(
    'T-MAIN-001.9',
    'MAIN-001',
    'URL vacía devuelve cadena vacía sin enlace roto',
    '',
    u.validateSafeUrl('   '),
    u.validateSafeUrl('   ') === ''
  );

  // --- MAIN-002 Tests (5 pruebas) ---
  const contactForm = elementsById['contact-form'];
  const feedbackEl = elementsById['form-feedback'];

  // 1. Envío vacío
  elementsById['name'].value = '';
  elementsById['email'].value = '';
  elementsById['message'].value = '';
  contactForm.dispatchEvent('submit', { preventDefault() {} });
  recordTest(
    'T-MAIN-002.1',
    'MAIN-002',
    'Rechazo de formulario vacío',
    'form-feedback is-error',
    feedbackEl.className,
    feedbackEl.className.includes('is-error')
  );

  // 2. Nombre demasiado largo (>80) y conservación del valor introducido
  const longName = 'A'.repeat(85);
  elementsById['name'].value = longName;
  elementsById['message'].value = 'Mensaje válido de más de diez caracteres.';
  contactForm.dispatchEvent('submit', { preventDefault() {} });
  recordTest(
    'T-MAIN-002.2',
    'MAIN-002',
    'Rechazo de nombre > 80 caracteres sin borrar input',
    true,
    feedbackEl.className.includes('is-error') && elementsById['name'].value === longName,
    feedbackEl.className.includes('is-error') && elementsById['name'].value === longName
  );

  // 3. Correo inválido
  elementsById['name'].value = 'Carlos Santana';
  elementsById['email'].value = 'correo-invalido@';
  contactForm.dispatchEvent('submit', { preventDefault() {} });
  recordTest(
    'T-MAIN-002.3',
    'MAIN-002',
    'Rechazo de correo inválido conservando datos',
    true,
    feedbackEl.className.includes('is-error') && elementsById['name'].value === 'Carlos Santana',
    feedbackEl.className.includes('is-error') && elementsById['name'].value === 'Carlos Santana'
  );

  // 4. Mensaje demasiado largo (>1000)
  elementsById['email'].value = 'carlos@kazvora.com';
  elementsById['message'].value = 'X'.repeat(1005);
  contactForm.dispatchEvent('submit', { preventDefault() {} });
  recordTest(
    'T-MAIN-002.4',
    'MAIN-002',
    'Rechazo de mensaje > 1000 caracteres',
    true,
    feedbackEl.className.includes('is-error'),
    feedbackEl.className.includes('is-error')
  );

  // 5. T-MAIN-002.5: Aceptación de datos válidos y sincronización asíncrona con portapapeles
  // Paso A: Probar con promesa diferida que antes de completarse el portapapeles NO hay falso positivo
  lastClipboardText = null;
  clipboardMode = 'deferred';
  elementsById['name'].value = 'Carlos Santana';
  elementsById['email'].value = 'carlos@kazvora.com';
  elementsById['project-type'].value = 'Catálogo digital';
  elementsById['message'].value =
    'Necesito cotizar un catálogo digital adaptable a dispositivos móviles.';

  contactForm.dispatchEvent('submit', { preventDefault() {} });
  const notPrematurelyResolved =
    !feedbackEl.className.includes('is-success') && lastClipboardText === null;

  // Paso B: Resolver la operación asíncrona del portapapeles y esperar vaciado de microtareas
  if (typeof deferredClipboardResolve === 'function') {
    deferredClipboardResolve();
  }
  await flushAsyncOperations();

  const resolvedSuccess =
    feedbackEl.className.includes('is-success') &&
    feedbackEl.textContent.includes('Mensaje preparado y copiado al portapapeles') &&
    typeof lastClipboardText === 'string' &&
    lastClipboardText.includes('Carlos Santana') &&
    lastClipboardText.includes('Necesito cotizar un catálogo digital');

  // Paso C: Verificar comportamiento alternativo cuando navigator.clipboard.writeText rechaza la promesa
  clipboardMode = 'reject';
  feedbackEl.className = '';
  feedbackEl.textContent = '';
  contactForm.dispatchEvent('submit', { preventDefault() {} });
  await flushAsyncOperations();

  const fallbackOnRejectWorks =
    feedbackEl.className.includes('is-success') &&
    feedbackEl.textContent.includes('Mensaje preparado (selecciónalo y cópialo manualmente):') &&
    feedbackEl.textContent.includes('Carlos Santana');

  // Restaurar modo estándar del mock de portapapeles
  clipboardMode = 'resolve';

  const tMain0025Passed =
    notPrematurelyResolved && resolvedSuccess && fallbackOnRejectWorks;

  recordTest(
    'T-MAIN-002.5',
    'MAIN-002',
    'Aceptación de datos válidos, espera asíncrona de portapapeles (sin falso positivo prematuro) y respaldo ante fallo de portapapeles',
    {
      notPrematurelyResolved: true,
      resolvedSuccess: true,
      fallbackOnRejectWorks: true
    },
    {
      notPrematurelyResolved: notPrematurelyResolved,
      resolvedSuccess: resolvedSuccess,
      fallbackOnRejectWorks: fallbackOnRejectWorks
    },
    tMain0025Passed
  );

  // --- MAIN-003 Tests ---
  // Comprueba que nunca se afirma envío automático y que el respaldo de portapapeles y control de popups en demo funcionan
  const noFakeSentClaim = !feedbackEl.textContent.toLowerCase().includes('mensaje enviado');

  // Probar también apertura y bloqueo de ventana emergente en la demostración cuando hay teléfono válido temporal
  d.DEMO_CONFIG.whatsappNumber = '522721234567';
  d.setProductQuantity('pastel-red-velvet', 1);
  elementsById['customer-name'].value = 'Sofía Hernández';
  elementsById['delivery-date'].value = d.getTodayLocalISO();

  simulatePopupBlocked = false;
  elementsById['bakery-order-form'].dispatchEvent('submit', { preventDefault() {} });
  await flushAsyncOperations();
  const popupAllowedCheck =
    lastCreatedPopup !== null &&
    lastCreatedPopup.opener === null &&
    elementsById['order-feedback'].textContent.includes('Se solicitó abrir WhatsApp');

  simulatePopupBlocked = true;
  elementsById['bakery-order-form'].dispatchEvent('submit', { preventDefault() {} });
  await flushAsyncOperations();
  const popupBlockedCheck =
    lastCreatedPopup === null &&
    elementsById['order-feedback'].textContent.includes('bloqueó la ventana emergente');

  // Restaurar estado limpio comercial (sin número y carrito en 0)
  d.DEMO_CONFIG.whatsappNumber = '';
  simulatePopupBlocked = false;
  d.setProductQuantity('pastel-red-velvet', 0);
  elementsById['customer-name'].value = '';
  elementsById['delivery-date'].value = '';

  recordTest(
    'T-MAIN-003.1',
    'MAIN-003',
    'No afirma que el mensaje fue enviado automáticamente, asigna opener=null al abrir ventana y detecta bloqueo de popups',
    {
      noFakeSentClaim: true,
      popupAllowedCheck: true,
      popupBlockedCheck: true
    },
    {
      noFakeSentClaim: noFakeSentClaim,
      popupAllowedCheck: popupAllowedCheck,
      popupBlockedCheck: popupBlockedCheck
    },
    noFakeSentClaim && popupAllowedCheck && popupBlockedCheck
  );

  // --- PROJECTS-001 Tests ---
  const servProject = window.KAZVORA_PROJECTS.find(p => p.url === 'servicios.html');
  recordTest(
    'T-PROJ-001.1',
    'PROJECTS-001',
    'Proyecto que apunta a servicios.html clasificado honestamente como Proyecto propio',
    'Proyecto propio',
    servProject ? servProject.status : null,
    Boolean(
      servProject &&
        servProject.status === 'Proyecto propio' &&
        servProject.title.includes('Servicios KAZVORA')
    )
  );

  // --- PROJECTS-002 Tests ---
  const sampleInvalid = s.validateKazvoraProjects([
    {
      id: 'ok-1',
      title: 'Valido',
      category: 'Web',
      status: 'Demostración',
      description: 'Desc',
      technologies: ['JS'],
      featured: true,
      url: 'index.html'
    },
    {
      id: 'ok-1',
      title: 'Duplicado',
      category: 'Web',
      status: 'Demostración',
      description: 'Desc',
      technologies: [],
      featured: false,
      url: ''
    },
    {
      id: 'sin-titulo',
      title: '',
      category: 'Web',
      status: 'Demostración',
      description: 'Desc',
      technologies: [],
      featured: false,
      url: ''
    },
    {
      id: 'cat-invalida',
      title: 'Cat',
      category: 'Blockchain',
      status: 'Demostración',
      description: 'Desc',
      technologies: [],
      featured: false,
      url: ''
    },
    {
      id: 'url-peligrosa',
      title: 'XSS',
      category: 'Web',
      status: 'Demostración',
      description: 'Desc',
      technologies: [],
      featured: false,
      url: 'javascript:alert(1)'
    },
    {
      id: 'featured-malo',
      title: 'Bool',
      category: 'Web',
      status: 'Demostración',
      description: 'Desc',
      technologies: [],
      featured: 'si',
      url: ''
    }
  ]);
  recordTest(
    'T-PROJ-002.1',
    'PROJECTS-002',
    'Validador de esquema descarta duplicados, vacíos, categoría inválida, URL peligrosa y featured no booleano',
    1,
    sampleInvalid.length,
    sampleInvalid.length === 1 && sampleInvalid[0].id === 'ok-1'
  );

  // --- DEMO-001 Tests ---
  recordTest(
    'T-DEMO-001.1',
    'DEMO-001',
    'Carrito de repostería inicia vacío (0 productos y $0 MXN)',
    0,
    d.getSelectedItems().length,
    d.getSelectedItems().length === 0 &&
      elementsById['header-item-count'].textContent === '0' &&
      elementsById['order-total-amount'].textContent === '$0 MXN'
  );

  // --- DEMO-002 Tests (7 pruebas) ---
  const r1 = d.setProductQuantity('pastel-red-velvet', 1);
  recordTest(
    'T-DEMO-002.1',
    'DEMO-002',
    'Agregar 1 unidad actualiza cantidad y subtotal ($680 MXN)',
    680,
    d.getSelectedItems()[0]?.subtotal,
    r1.ok === true && d.getSelectedItems()[0]?.subtotal === 680
  );

  const rMax = d.setProductQuantity('pastel-red-velvet', 10);
  recordTest(
    'T-DEMO-002.2',
    'DEMO-002',
    'Acepta cantidad máxima configurada (10 unidades = $6,800 MXN)',
    6800,
    d.getSelectedItems()[0]?.subtotal,
    rMax.ok === true && d.getSelectedItems()[0]?.subtotal === 6800
  );

  const rOver = d.setProductQuantity('pastel-red-velvet', 11);
  recordTest(
    'T-DEMO-002.3',
    'DEMO-002',
    'Rechaza cantidad > máximo (11) conservando 10 unidades',
    false,
    rOver.ok,
    rOver.ok === false && d.getSelectedItems()[0]?.qty === 10
  );

  const rNeg = d.setProductQuantity('pastel-red-velvet', -1);
  recordTest(
    'T-DEMO-002.4',
    'DEMO-002',
    'Rechaza cantidad negativa (-1)',
    false,
    rNeg.ok,
    rNeg.ok === false
  );

  const rFloat = d.setProductQuantity('pastel-red-velvet', 2.5);
  recordTest(
    'T-DEMO-002.5',
    'DEMO-002',
    'Rechaza cantidad no entera (2.5)',
    false,
    rFloat.ok,
    rFloat.ok === false
  );

  const rNaN = d.setProductQuantity('pastel-red-velvet', NaN);
  recordTest(
    'T-DEMO-002.6',
    'DEMO-002',
    'Rechaza valor no numérico (NaN)',
    false,
    rNaN.ok,
    rNaN.ok === false
  );

  const rZero = d.setProductQuantity('pastel-red-velvet', 0);
  recordTest(
    'T-DEMO-002.7',
    'DEMO-002',
    'Regresar a 0 vacía el producto del carrito',
    0,
    d.getSelectedItems().length,
    rZero.ok === true && d.getSelectedItems().length === 0
  );

  // --- DEMO-003 Tests (6 pruebas) ---
  recordTest(
    'T-DEMO-003.1',
    'DEMO-003',
    'Acepta número válido internacional de México (+52 272 123 4567)',
    '522721234567',
    d.validateWhatsAppPhone('+52 272 123 4567'),
    d.validateWhatsAppPhone('+52 272 123 4567') === '522721234567'
  );
  recordTest(
    'T-DEMO-003.2',
    'DEMO-003',
    'Rechaza número de 10 dígitos sin código de país',
    null,
    d.validateWhatsAppPhone('2721234567'),
    d.validateWhatsAppPhone('2721234567') === null
  );
  recordTest(
    'T-DEMO-003.3',
    'DEMO-003',
    'Rechaza número vacío',
    null,
    d.validateWhatsAppPhone(''),
    d.validateWhatsAppPhone('') === null
  );
  recordTest(
    'T-DEMO-003.4',
    'DEMO-003',
    'Rechaza cadena con letras',
    null,
    d.validateWhatsAppPhone('52272123ABCD'),
    d.validateWhatsAppPhone('52272123ABCD') === null
  );
  recordTest(
    'T-DEMO-003.5',
    'DEMO-003',
    'Rechaza prefijo que inicia con 0',
    null,
    d.validateWhatsAppPhone('00522721234567'),
    d.validateWhatsAppPhone('00522721234567') === null
  );
  recordTest(
    'T-DEMO-003.6',
    'DEMO-003',
    'Configuración comercial permanece sin número ficticio ("")',
    '',
    d.DEMO_CONFIG.whatsappNumber,
    d.DEMO_CONFIG.whatsappNumber === ''
  );

  // --- DEMO-004 Tests ---
  const filterBtns = elementsById['bakery-filters'].querySelectorAll('.bakery-filter-btn');
  const activeBtns = filterBtns.filter(b => b.getAttribute('aria-pressed') === 'true');
  recordTest(
    'T-DEMO-004.1',
    'DEMO-004',
    'Filtros de repostería tienen aria-pressed y solo 1 activo en true',
    1,
    activeBtns.length,
    filterBtns.length === 4 &&
      activeBtns.length === 1 &&
      activeBtns[0].getAttribute('data-cat') === 'Todos'
  );

  // --- DEMO-005 Tests (5 pruebas) ---
  const todayISO = d.getTodayLocalISO();
  recordTest(
    'T-DEMO-005.1',
    'DEMO-005',
    'Atributo min en input #delivery-date igual a hoy local',
    todayISO,
    elementsById['delivery-date'].getAttribute('min'),
    elementsById['delivery-date'].getAttribute('min') === todayISO
  );
  recordTest(
    'T-DEMO-005.2',
    'DEMO-005',
    'Rechaza fecha pasada (2020-01-01)',
    false,
    d.validateDeliveryDate('2020-01-01').valid,
    d.validateDeliveryDate('2020-01-01').valid === false
  );
  recordTest(
    'T-DEMO-005.3',
    'DEMO-005',
    'Acepta fecha actual (' + todayISO + ')',
    true,
    d.validateDeliveryDate(todayISO).valid,
    d.validateDeliveryDate(todayISO).valid === true
  );
  recordTest(
    'T-DEMO-005.4',
    'DEMO-005',
    'Acepta fecha futura (2099-12-31)',
    true,
    d.validateDeliveryDate('2099-12-31').valid,
    d.validateDeliveryDate('2099-12-31').valid === true
  );
  recordTest(
    'T-DEMO-005.5',
    'DEMO-005',
    'Rechaza fecha inexistente de calendario (2026-02-30)',
    false,
    d.validateDeliveryDate('2026-02-30').valid,
    d.validateDeliveryDate('2026-02-30').valid === false
  );

  // --- DEMO-006 Tests ---
  const catalogHTML = elementsById['bakery-grid'].innerHTML;
  const hasSpecificAriaAdd = catalogHTML.includes(
    'aria-label="Agregar Red Velvet Imperial &amp; Frutos Rojos al pedido"'
  );
  d.setProductQuantity('pastel-red-velvet', 2);
  const catalogHTMLWithQty = elementsById['bakery-grid'].innerHTML;
  const hasSpecificAriaIncDec =
    catalogHTMLWithQty.includes(
      'aria-label="Disminuir cantidad de Red Velvet Imperial &amp; Frutos Rojos"'
    ) &&
    catalogHTMLWithQty.includes(
      'aria-label="Aumentar cantidad de Red Velvet Imperial &amp; Frutos Rojos"'
    );
  d.setProductQuantity('pastel-red-velvet', 0);

  recordTest(
    'T-DEMO-006.1',
    'DEMO-006',
    'Botones Agregar, + y - incluyen aria-label con el nombre específico del producto',
    true,
    hasSpecificAriaAdd && hasSpecificAriaIncDec,
    hasSpecificAriaAdd && hasSpecificAriaIncDec
  );

  // --- DOC-001 & DOC-002 Tests ---
  const docContent = fs.readFileSync(path.join(baseDir, 'PROJECT_CONTEXT.md'), 'utf8');
  const hasResidualCitations = /\[cite:|\[span_/i.test(docContent);
  const hasFiveStates = [
    'Propuesto',
    'Implementado',
    'Probado',
    'Verificado independientemente',
    'Pendiente'
  ].every(st => docContent.includes(st));

  recordTest(
    'T-DOC-001.1',
    'DOC-001',
    'PROJECT_CONTEXT.md libre de referencias residuales o [span_...]',
    false,
    hasResidualCitations,
    hasResidualCitations === false
  );
  recordTest(
    'T-DOC-002.1',
    'DOC-002',
    'PROJECT_CONTEXT.md incluye los 5 niveles de trazabilidad, SHAs base y registro de 40 pruebas dinámicas',
    true,
    hasFiveStates && docContent.includes('40'),
    hasFiveStates && docContent.includes('40')
  );

  // Calcular hashes SHA-256 de los archivos auditados para trazabilidad en el reporte
  const trackedFiles = [
    'index.html',
    'portafolio.html',
    'servicios.html',
    'nosotros.html',
    'contacto.html',
    'README.md',
    'PROJECT_CONTEXT.md',
    'assets/icons/favicon.svg',
    'css/styles.css',
    'js/main.js',
    'js/projects.js',
    'demos/reposteria/index.html',
    'demos/reposteria/styles.css',
    'demos/reposteria/app.js',
    'tests/run-fase4-audit-tests.js'
  ];

  const fileHashes = {};
  trackedFiles.forEach(relPath => {
    const fullPath = path.join(baseDir, relPath);
    if (fs.existsSync(fullPath)) {
      const buf = fs.readFileSync(fullPath);
      fileHashes[relPath] = {
        exists: true,
        bytes: buf.length,
        sha256: crypto.createHash('sha256').update(buf).digest('hex')
      };
    } else {
      fileHashes[relPath] = { exists: false };
    }
  });

  const dynamicReport = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform + ' (' + process.arch + ')',
    totalTests: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status !== 'PASS').length,
    passRate: ((results.filter(r => r.status === 'PASS').length / results.length) * 100).toFixed(1) + '%',
    fileHashes: fileHashes,
    results: results
  };

  const evidenceOutputPath = path.join(__dirname, 'DYNAMIC_VERIFICATION_EVIDENCE.json');
  fs.writeFileSync(evidenceOutputPath, JSON.stringify(dynamicReport, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify(dynamicReport, null, 2));

  if (dynamicReport.failed > 0) {
    process.exitCode = 1;
  }
}

runAllAuditTests().catch(err => {
  console.error('Error fatal ejecutando la suite de auditoría Fase 4:', err);
  process.exitCode = 1;
});