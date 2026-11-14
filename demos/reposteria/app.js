/**
 * KAZVORA Technologies — Demostración Comercial #1: Dulce Atelier (demos/reposteria/app.js)
 * Intervención Técnica Fase 4:
 * - DEMO-001: Inicialización del carrito estrictamente vacío ({})
 * - DEMO-002: Límite superior configurable (MAX_QTY_PER_PRODUCT = 10) y validación entera no negativa
 * - DEMO-003: Validación internacional E.164 del número de WhatsApp sin números ficticios
 * - DEMO-004: Atributos aria-pressed sincronizados en filtros conservando el foco de teclado
 * - DEMO-005: Fecha mínima igual al día local actual y rechazo de fechas pasadas
 * - DEMO-006: Etiquetas aria-label específicas por producto en cada botón de acción
 */
(function () {
  "use strict";

  const DEMO_CONFIG = {
    businessName: "Dulce Atelier (Demo KAZVORA)",
    // Se conserva vacío "" por restricción comercial. Cuando se configure un número válido E.164
    // (ej. "522721234567"), se habilitará la apertura de WhatsApp.
    whatsappNumber: "",
    maxQuantityPerProduct: 10
  };

  const DEMO_PRODUCTS = [
    {
      id: "pastel-red-velvet",
      name: "Red Velvet Imperial & Frutos Rojos",
      category: "Pasteles",
      portions: "10–12 porciones",
      prepTime: "24 h de anticipación",
      price: 680,
      emoji: "🎂",
      description:
        "Bizcocho húmedo de cacao suave con betún artesanal de queso crema y corona de frutos rojos frescos."
    },
    {
      id: "pastel-triple-chocolate",
      name: "Mousse Belga Triple Chocolate",
      category: "Pasteles",
      portions: "12–14 porciones",
      prepTime: "24 h de anticipación",
      price: 750,
      emoji: "🍫",
      description:
        "Capas de ganache semiamargo, mousse de chocolate con leche y base crujiente de avellana."
    },
    {
      id: "tarta-frambuesa-pistache",
      name: "Tarta Francesa de Pistache y Frambuesa",
      category: "Tartas",
      portions: "8–10 porciones",
      prepTime: "24 h de anticipación",
      price: 620,
      emoji: "🥧",
      description:
        "Base sablé de almendra rellena de crema de pistache tostado y frambuesas seleccionadas."
    },
    {
      id: "cheesecake-vasco",
      name: "Cheesecake Vasco Caramelizado",
      category: "Tartas",
      portions: "8–10 porciones",
      prepTime: "Disponible el mismo día",
      price: 590,
      emoji: "🍮",
      description:
        "Textura cremosa al centro y cubierta dorada horneada a alta temperatura al estilo San Sebastián."
    },
    {
      id: "caja-macarons",
      name: "Caja Degustación 12 Macarons",
      category: "Individuales",
      portions: "12 piezas",
      prepTime: "Disponible el mismo día",
      price: 420,
      emoji: "🍬",
      description:
        "Selección artesanal: vainilla de Papantla, frutos del bosque, caramelo salado, matcha y chocolate."
    },
    {
      id: "pack-cupcakes-celebracion",
      name: "Caja de 6 Cupcakes Gourmet",
      category: "Individuales",
      portions: "6 piezas",
      prepTime: "12 h de anticipación",
      price: 340,
      emoji: "🧁",
      description:
        "Decorados a mano con buttercream suizo y rellenos frutales o de praliné."
    }
  ];

  // DEMO-001: El carrito comienza completamente vacío
  const orderState = Object.create(null);

  let activeCategory = "Todos";

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatCurrency(amount) {
    const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    return "$" + safeAmount.toLocaleString("es-MX") + " MXN";
  }

  /**
   * DEMO-003: Valida número telefónico en formato internacional E.164 (11 a 15 dígitos, sin iniciar en 0)
   * @param {string} rawPhone
   * @returns {string|null}
   */
  function validateWhatsAppPhone(rawPhone) {
    if (typeof rawPhone !== "string") return null;
    const trimmed = rawPhone.trim();
    if (!trimmed) return null;

    if (!/^\+?[0-9\s-]+$/.test(trimmed)) {
      return null;
    }

    const digits = trimmed.replace(/[\s+-]/g, "");
    if (!/^[1-9]\d{10,14}$/.test(digits)) {
      return null;
    }

    return digits;
  }

  /**
   * DEMO-005: Obtiene la fecha actual en la zona horaria local del usuario en formato YYYY-MM-DD
   * @returns {string}
   */
  function getTodayLocalISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  /**
   * DEMO-005: Verifica que una cadena YYYY-MM-DD sea una fecha real de calendario y no sea anterior a hoy
   * @param {string} dateStr
   * @returns {{ valid: boolean, reason: string }}
   */
  function validateDeliveryDate(dateStr) {
    if (typeof dateStr !== "string" || dateStr.trim() === "") {
      return { valid: true, reason: "" };
    }

    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return {
        valid: false,
        reason: "El formato de la fecha no es válido (usa AAAA-MM-DD)."
      };
    }

    const parts = trimmed.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    const parsedDate = new Date(year, month - 1, day);
    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return {
        valid: false,
        reason: "La fecha seleccionada no existe en el calendario."
      };
    }

    const todayISO = getTodayLocalISO();
    if (trimmed < todayISO) {
      return {
        valid: false,
        reason:
          "No es posible seleccionar una fecha pasada (" +
          trimmed +
          "). Elige a partir de hoy (" +
          todayISO +
          ")."
      };
    }

    return { valid: true, reason: "" };
  }

  function findProductById(productId) {
    if (typeof productId !== "string") return null;
    for (let i = 0; i < DEMO_PRODUCTS.length; i += 1) {
      if (DEMO_PRODUCTS[i].id === productId) {
        return DEMO_PRODUCTS[i];
      }
    }
    return null;
  }

  function getSelectedItems() {
    const list = [];
    DEMO_PRODUCTS.forEach(function (product) {
      const rawQty = orderState[product.id];
      const qty =
        Number.isSafeInteger(rawQty) &&
        rawQty > 0 &&
        rawQty <= DEMO_CONFIG.maxQuantityPerProduct
          ? rawQty
          : 0;
      if (qty > 0) {
        list.push({
          product: product,
          qty: qty,
          subtotal: qty * product.price
        });
      }
    });
    return list;
  }

  function buildWhatsAppMessage() {
    const items = getSelectedItems();
    const nameEl = document.getElementById("customer-name");
    const modeEl = document.getElementById("delivery-mode");
    const dateEl = document.getElementById("delivery-date");
    const notesEl = document.getElementById("cake-notes");

    const customerName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : "[Tu nombre]";
    const deliveryMode = modeEl ? modeEl.value : "Recoger en sucursal";
    const rawDate = dateEl && dateEl.value ? dateEl.value.trim() : "";
    const dateCheck = validateDeliveryDate(rawDate);
    const deliveryDate = rawDate && dateCheck.valid ? rawDate : "Por definir";
    const notes = notesEl && notesEl.value.trim() ? notesEl.value.trim() : "";

    const lines = [
      "Hola, *" +
        DEMO_CONFIG.businessName +
        "*. Quiero consultar disponibilidad para este pedido de demostración:",
      "",
      "👤 *Cliente:* " + customerName,
      "🚚 *Modalidad:* " + deliveryMode,
      "📅 *Fecha deseada:* " + deliveryDate,
      "",
      "🍰 *Productos seleccionados:*"
    ];

    let total = 0;
    if (items.length === 0) {
      lines.push("• (Aún no has agregado productos del catálogo)");
    } else {
      items.forEach(function (entry) {
        total += entry.subtotal;
        lines.push(
          "• " +
            entry.qty +
            "x " +
            entry.product.name +
            " (" +
            formatCurrency(entry.subtotal) +
            ")"
        );
      });
    }

    lines.push("");
    lines.push("💰 *Total estimado (Demo):* " + formatCurrency(total));

    if (notes) {
      lines.push("✨ *Dedicatoria / Notas:* " + notes);
    }

    lines.push("");
    lines.push("_(Mensaje generado desde la demostración comercial de KAZVORA Technologies)_");

    return lines.join("\n");
  }

  /**
   * DEMO-004: Renderiza los filtros con aria-pressed y actualiza su estado sin destruir el foco del teclado
   */
  function renderFilters() {
    const container = document.getElementById("bakery-filters");
    if (!container) return;

    const categories = ["Todos"];
    DEMO_PRODUCTS.forEach(function (p) {
      if (!categories.includes(p.category)) {
        categories.push(p.category);
      }
    });

    const existingButtons = container.querySelectorAll(".bakery-filter-btn");
    if (existingButtons.length === categories.length) {
      existingButtons.forEach(function (btn) {
        const cat = btn.getAttribute("data-cat") || "";
        const isCurrent = cat === activeCategory;
        btn.classList.toggle("active", isCurrent);
        btn.setAttribute("aria-pressed", String(isCurrent));
      });
      return;
    }

    container.innerHTML = categories
      .map(function (cat) {
        const isCurrent = cat === activeCategory;
        return (
          '<button type="button" class="bakery-filter-btn' +
          (isCurrent ? " active" : "") +
          '" data-cat="' +
          escapeHTML(cat) +
          '" aria-pressed="' +
          String(isCurrent) +
          '">' +
          escapeHTML(cat) +
          "</button>"
        );
      })
      .join("");
  }

  /**
   * DEMO-006: Renderiza el catálogo con nombres accesibles específicos por producto en cada botón
   */
  function renderCatalog() {
    const grid = document.getElementById("bakery-grid");
    if (!grid) return;

    const filtered =
      activeCategory === "Todos"
        ? DEMO_PRODUCTS
        : DEMO_PRODUCTS.filter(function (p) {
            return p.category === activeCategory;
          });

    grid.innerHTML = filtered
      .map(function (product) {
        const qty = orderState[product.id] || 0;
        const safeName = escapeHTML(product.name);
        const safeId = escapeHTML(product.id);

        const controlHTML =
          qty > 0
            ? '<div class="qty-controls" role="group" aria-label="Cantidad de ' +
              safeName +
              '">' +
                '<button type="button" class="qty-btn" data-action="dec" data-id="' +
                safeId +
                '" aria-label="Disminuir cantidad de ' +
                safeName +
                '">−</button>' +
                '<span class="qty-value" aria-live="polite">' +
                qty +
                "</span>" +
                '<button type="button" class="qty-btn" data-action="inc" data-id="' +
                safeId +
                '" aria-label="Aumentar cantidad de ' +
                safeName +
                '">+</button>' +
              "</div>"
            : '<button type="button" class="add-btn" data-action="inc" data-id="' +
              safeId +
              '" aria-label="Agregar ' +
              safeName +
              ' al pedido">Agregar +</button>';

        return (
          '<article class="product-card">' +
            '<div class="product-top">' +
              '<span class="product-emoji" aria-hidden="true">' +
              escapeHTML(product.emoji) +
              "</span>" +
              '<span class="product-demo-label">' +
              escapeHTML(product.category) +
              " · Demo</span>" +
            "</div>" +
            "<h3>" +
            safeName +
            "</h3>" +
            '<p class="product-desc">' +
            escapeHTML(product.description) +
            "</p>" +
            '<div class="product-meta">' +
              "<span>" +
              escapeHTML(product.portions) +
              "</span>" +
              "<span>" +
              escapeHTML(product.prepTime) +
              "</span>" +
            "</div>" +
            '<div class="product-bottom">' +
              '<span class="product-price">$' +
              product.price +
              "</span>" +
              controlHTML +
            "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderOrderSummary() {
    const listEl = document.getElementById("order-items-list");
    const totalEl = document.getElementById("order-total-amount");
    const headerCountEl = document.getElementById("header-item-count");
    const previewEl = document.getElementById("whatsapp-preview");
    const mobileBar = document.getElementById("mobile-order-bar");
    const mobileCount = document.getElementById("mobile-bar-count");
    const mobileTotal = document.getElementById("mobile-bar-total");

    const items = getSelectedItems();
    let totalCount = 0;
    let totalAmount = 0;

    items.forEach(function (entry) {
      totalCount += entry.qty;
      totalAmount += entry.subtotal;
    });

    if (headerCountEl) {
      headerCountEl.textContent = String(totalCount);
    }

    if (totalEl) {
      totalEl.textContent = formatCurrency(totalAmount);
    }

    if (listEl) {
      if (items.length === 0) {
        listEl.innerHTML =
          '<p class="empty-order">Tu bandeja está vacía. Agrega pasteles o postres desde el catálogo para probar la demostración.</p>';
      } else {
        listEl.innerHTML = items
          .map(function (entry) {
            const safeName = escapeHTML(entry.product.name);
            const safeId = escapeHTML(entry.product.id);
            return (
              '<div class="order-line">' +
                '<div class="order-line-info">' +
                  "<strong>" +
                  safeName +
                  "</strong>" +
                  "<small>" +
                  entry.qty +
                  " × $" +
                  entry.product.price +
                  " = " +
                  formatCurrency(entry.subtotal) +
                  "</small>" +
                "</div>" +
                '<div class="qty-controls" role="group" aria-label="Ajustar cantidad de ' +
                safeName +
                ' en el resumen">' +
                  '<button type="button" class="qty-btn" data-action="dec" data-id="' +
                  safeId +
                  '" aria-label="Quitar una unidad de ' +
                  safeName +
                  '">−</button>' +
                  '<span class="qty-value">' +
                  entry.qty +
                  "</span>" +
                  '<button type="button" class="qty-btn" data-action="inc" data-id="' +
                  safeId +
                  '" aria-label="Agregar una unidad de ' +
                  safeName +
                  '">+</button>' +
                "</div>" +
              "</div>"
            );
          })
          .join("");
      }
    }

    if (previewEl) {
      previewEl.textContent = buildWhatsAppMessage();
    }

    if (mobileBar && mobileCount && mobileTotal) {
      if (totalCount > 0) {
        mobileBar.hidden = false;
        mobileCount.textContent =
          totalCount + (totalCount === 1 ? " producto" : " productos");
        mobileTotal.textContent = formatCurrency(totalAmount);
      } else {
        mobileBar.hidden = true;
      }
    }
  }

  /**
   * DEMO-002: Establece una cantidad validando entero seguro, no negatividad y tope máximo
   * @param {string} productId
   * @param {number} targetQty
   * @returns {{ ok: boolean, qty: number, reason: string }}
   */
  function setProductQuantity(productId, targetQty) {
    const feedback = document.getElementById("order-feedback");
    const product = findProductById(productId);

    if (!product) {
      return { ok: false, qty: 0, reason: "Producto no encontrado." };
    }

    if (typeof targetQty !== "number" || !Number.isSafeInteger(targetQty)) {
      if (feedback) {
        feedback.textContent = "La cantidad debe ser un número entero válido.";
      }
      return { ok: false, qty: orderState[productId] || 0, reason: "Cantidad no entera." };
    }

    if (targetQty < 0) {
      if (feedback) {
        feedback.textContent = "No se permiten cantidades negativas.";
      }
      return { ok: false, qty: orderState[productId] || 0, reason: "Cantidad negativa." };
    }

    if (targetQty > DEMO_CONFIG.maxQuantityPerProduct) {
      if (feedback) {
        feedback.textContent =
          "El límite máximo en pedidos demostrativos en línea es de " +
          DEMO_CONFIG.maxQuantityPerProduct +
          " unidades por producto (" +
          product.name +
          ").";
      }
      return {
        ok: false,
        qty: orderState[productId] || 0,
        reason: "Excede el límite máximo permitido."
      };
    }

    if (targetQty === 0) {
      delete orderState[productId];
    } else {
      orderState[productId] = targetQty;
    }

    if (feedback) {
      feedback.textContent = "";
    }

    renderCatalog();
    renderOrderSummary();
    return { ok: true, qty: targetQty, reason: "" };
  }

  function updateQuantity(productId, delta) {
    if (typeof delta !== "number" || !Number.isSafeInteger(delta)) {
      return { ok: false, qty: 0, reason: "Incremento inválido." };
    }
    const current = orderState[productId] || 0;
    const next = current + delta;
    if (current === 0 && delta < 0) {
      return setProductQuantity(productId, 0);
    }
    return setProductQuantity(productId, next);
  }

  function copyTextToClipboard(text, feedbackEl, successMessage) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          if (feedbackEl) feedbackEl.textContent = successMessage;
        })
        .catch(function () {
          if (feedbackEl) {
            feedbackEl.textContent = "Resumen listo en la vista previa superior.";
          }
        });
    } else if (feedbackEl) {
      feedbackEl.textContent = "Resumen listo en la vista previa superior.";
    }
  }

  // Exponer utilidades para pruebas de regresión y auditoría independiente
  window.KAZVORA_BAKERY_DEMO = {
    DEMO_CONFIG: DEMO_CONFIG,
    getOrderStateSnapshot: function () {
      return Object.assign({}, orderState);
    },
    setProductQuantity: setProductQuantity,
    updateQuantity: updateQuantity,
    validateWhatsAppPhone: validateWhatsAppPhone,
    validateDeliveryDate: validateDeliveryDate,
    getTodayLocalISO: getTodayLocalISO,
    getSelectedItems: getSelectedItems
  };

  document.addEventListener("DOMContentLoaded", function () {
    // DEMO-005: Configurar fecha mínima local en el selector de fecha
    const dateInput = document.getElementById("delivery-date");
    if (dateInput) {
      dateInput.setAttribute("min", getTodayLocalISO());
    }

    renderFilters();
    renderCatalog();
    renderOrderSummary();

    const filtersEl = document.getElementById("bakery-filters");
    if (filtersEl) {
      filtersEl.addEventListener("click", function (event) {
        const btn = event.target.closest(".bakery-filter-btn");
        if (!btn) return;
        activeCategory = btn.getAttribute("data-cat") || "Todos";
        renderFilters();
        renderCatalog();
      });
    }

    document.body.addEventListener("click", function (event) {
      const qtyBtn = event.target.closest("[data-action][data-id]");
      if (!qtyBtn) return;
      const action = qtyBtn.getAttribute("data-action");
      const id = qtyBtn.getAttribute("data-id");
      if (!id) return;
      updateQuantity(id, action === "inc" ? 1 : -1);
    });

    const form = document.getElementById("bakery-order-form");
    const feedback = document.getElementById("order-feedback");
    const copyBtn = document.getElementById("copy-order-btn");

    if (form) {
      form.addEventListener("input", function () {
        if (dateInput && dateInput.value) {
          const check = validateDeliveryDate(dateInput.value);
          if (!check.valid && feedback) {
            feedback.textContent = check.reason;
          } else if (feedback && feedback.textContent === check.reason) {
            feedback.textContent = "";
          }
        }
        const previewEl = document.getElementById("whatsapp-preview");
        if (previewEl) {
          previewEl.textContent = buildWhatsAppMessage();
        }
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const items = getSelectedItems();
        if (items.length === 0) {
          if (feedback) {
            feedback.textContent =
              "Agrega al menos un producto del catálogo para preparar el pedido.";
          }
          return;
        }

        const nameInput = document.getElementById("customer-name");
        const customerName = nameInput ? nameInput.value.trim() : "";
        if (customerName.length < 2 || customerName.length > 80) {
          if (feedback) {
            feedback.textContent =
              "Por favor, ingresa tu nombre (entre 2 y 80 caracteres) para preparar el pedido.";
          }
          if (nameInput) nameInput.focus();
          return;
        }

        // DEMO-005: Validar que la fecha no sea pasada antes de generar el pedido
        const rawDate = dateInput ? dateInput.value.trim() : "";
        const dateValidation = validateDeliveryDate(rawDate);
        if (!dateValidation.valid) {
          if (feedback) {
            feedback.textContent = dateValidation.reason;
          }
          if (dateInput) dateInput.focus();
          return;
        }

        const message = buildWhatsAppMessage();
        const validPhone = validateWhatsAppPhone(DEMO_CONFIG.whatsappNumber);

        // DEMO-003: Validar formato internacional antes de abrir enlace de WhatsApp
        if (validPhone) {
          const waUrl = "https://wa.me/" + validPhone + "?text=" + encodeURIComponent(message);
          let popupWindow = null;
          try {
            popupWindow = window.open(waUrl, "_blank");
            if (popupWindow) {
              popupWindow.opener = null;
            }
          } catch (err) {
            popupWindow = null;
          }

          if (popupWindow) {
            if (feedback) {
              feedback.textContent =
                "Pedido preparado. Se solicitó abrir WhatsApp en una nueva pestaña (recuerda confirmar el envío en WhatsApp).";
            }
          } else {
            copyTextToClipboard(
              message,
              feedback,
              "Tu navegador bloqueó la ventana emergente. Copiamos el pedido a tu portapapeles como respaldo."
            );
          }
        } else {
          copyTextToClipboard(
            message,
            feedback,
            "✓ Canal de WhatsApp no configurado en esta demostración. Tu pedido fue preparado y copiado al portapapeles."
          );
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const items = getSelectedItems();
        if (items.length === 0) {
          if (feedback) {
            feedback.textContent =
              "Agrega al menos un producto del catálogo antes de copiar el resumen.";
          }
          return;
        }

        const rawDate = dateInput ? dateInput.value.trim() : "";
        const dateValidation = validateDeliveryDate(rawDate);
        if (!dateValidation.valid) {
          if (feedback) {
            feedback.textContent = dateValidation.reason;
          }
          return;
        }

        const message = buildWhatsAppMessage();
        copyTextToClipboard(
          message,
          feedback,
          "✓ Resumen del pedido copiado al portapapeles."
        );
      });
    }
  });
})();