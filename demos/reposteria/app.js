/**
 * KAZVORA Technologies — Demostración Comercial #1: Dulce Atelier v2.1.1 (demos/reposteria/app.js)
 * - Construcción 100 % nativa del DOM (sin innerHTML: protección estructural anti-XSS)
 * - Configuración desacoplada vía window.KAZVORA_ENV (js/config.js)
 * - Carrito inicialmente vacío, tope de 10 unidades por producto y validación entera
 * - Teléfono E.164 sin números ficticios, fecha mínima local y accesibilidad ARIA completa
 * - Manejo robusto de bloqueador de ventanas emergentes aun sin acceso a navigator.clipboard
 */
(function () {
  "use strict";

  const ENV =
    typeof window !== "undefined" &&
    window.KAZVORA_ENV &&
    typeof window.KAZVORA_ENV === "object"
      ? window.KAZVORA_ENV
      : {};

  const DEMO_CONFIG = {
    businessName: "Dulce Atelier (Demo KAZVORA)",
    // Conservado vacío "" hasta autorización comercial explícita.
    whatsappNumber:
      typeof ENV.demoBakeryWhatsappNumber === "string" ? ENV.demoBakeryWhatsappNumber : "",
    maxQuantityPerProduct:
      Number.isSafeInteger(ENV.demoMaxQuantityPerProduct) && ENV.demoMaxQuantityPerProduct > 0
        ? ENV.demoMaxQuantityPerProduct
        : 10
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

  // Carrito inicialmente vacío
  const orderState = Object.create(null);
  let activeCategory = "Todos";

  function clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function formatCurrency(amount) {
    const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    return "$" + safeAmount.toLocaleString("es-MX") + " MXN";
  }

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

  function getTodayLocalISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

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

  function createQtyControls(product, qty, isSummary) {
    const group = createEl("div", "qty-controls");
    group.setAttribute("role", "group");
    group.setAttribute(
      "aria-label",
      isSummary
        ? "Ajustar cantidad de " + product.name + " en el resumen"
        : "Cantidad de " + product.name
    );

    const decBtn = createEl("button", "qty-btn", "−");
    decBtn.setAttribute("type", "button");
    decBtn.setAttribute("data-action", "dec");
    decBtn.setAttribute("data-id", product.id);
    decBtn.setAttribute(
      "aria-label",
      (isSummary ? "Quitar una unidad de " : "Disminuir cantidad de ") + product.name
    );

    const valueSpan = createEl("span", "qty-value", String(qty));
    if (!isSummary) {
      valueSpan.setAttribute("aria-live", "polite");
    }

    const incBtn = createEl("button", "qty-btn", "+");
    incBtn.setAttribute("type", "button");
    incBtn.setAttribute("data-action", "inc");
    incBtn.setAttribute("data-id", product.id);
    incBtn.setAttribute(
      "aria-label",
      (isSummary ? "Agregar una unidad de " : "Aumentar cantidad de ") + product.name
    );

    group.appendChild(decBtn);
    group.appendChild(valueSpan);
    group.appendChild(incBtn);
    return group;
  }

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

    clearContainer(container);
    categories.forEach(function (cat) {
      const isCurrent = cat === activeCategory;
      const btn = createEl(
        "button",
        isCurrent ? "bakery-filter-btn active" : "bakery-filter-btn",
        cat
      );
      btn.setAttribute("type", "button");
      btn.setAttribute("data-cat", cat);
      btn.setAttribute("aria-pressed", String(isCurrent));
      container.appendChild(btn);
    });
  }

  function renderCatalog() {
    const grid = document.getElementById("bakery-grid");
    if (!grid) return;

    clearContainer(grid);
    const filtered =
      activeCategory === "Todos"
        ? DEMO_PRODUCTS
        : DEMO_PRODUCTS.filter(function (p) {
            return p.category === activeCategory;
          });

    filtered.forEach(function (product) {
      const qty = orderState[product.id] || 0;
      const card = createEl("article", "product-card");

      const top = createEl("div", "product-top");
      const emojiSpan = createEl("span", "product-emoji", product.emoji);
      emojiSpan.setAttribute("aria-hidden", "true");
      top.appendChild(emojiSpan);
      top.appendChild(createEl("span", "product-demo-label", product.category + " · Demo"));
      card.appendChild(top);

      card.appendChild(createEl("h3", "", product.name));
      card.appendChild(createEl("p", "product-desc", product.description));

      const meta = createEl("div", "product-meta");
      meta.appendChild(createEl("span", "", product.portions));
      meta.appendChild(createEl("span", "", product.prepTime));
      card.appendChild(meta);

      const bottom = createEl("div", "product-bottom");
      bottom.appendChild(createEl("span", "product-price", "$" + product.price));

      if (qty > 0) {
        bottom.appendChild(createQtyControls(product, qty, false));
      } else {
        const addBtn = createEl("button", "add-btn", "Agregar +");
        addBtn.setAttribute("type", "button");
        addBtn.setAttribute("data-action", "inc");
        addBtn.setAttribute("data-id", product.id);
        addBtn.setAttribute("aria-label", "Agregar " + product.name + " al pedido");
        bottom.appendChild(addBtn);
      }

      card.appendChild(bottom);
      grid.appendChild(card);
    });
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

    if (headerCountEl) headerCountEl.textContent = String(totalCount);
    if (totalEl) totalEl.textContent = formatCurrency(totalAmount);

    if (listEl) {
      clearContainer(listEl);
      if (items.length === 0) {
        listEl.appendChild(
          createEl(
            "p",
            "empty-order",
            "Tu bandeja está vacía. Agrega pasteles o postres desde el catálogo para probar la demostración."
          )
        );
      } else {
        items.forEach(function (entry) {
          const line = createEl("div", "order-line");
          const info = createEl("div", "order-line-info");
          info.appendChild(createEl("strong", "", entry.product.name));
          info.appendChild(
            createEl(
              "small",
              "",
              entry.qty + " × $" + entry.product.price + " = " + formatCurrency(entry.subtotal)
            )
          );
          line.appendChild(info);
          line.appendChild(createQtyControls(entry.product, entry.qty, true));
          listEl.appendChild(line);
        });
      }
    }

    if (previewEl) {
      previewEl.textContent = buildWhatsAppMessage();
    }

    if (mobileBar && mobileCount && mobileTotal) {
      if (totalCount > 0) {
        mobileBar.hidden = false;
        mobileCount.textContent = totalCount + (totalCount === 1 ? " producto" : " productos");
        mobileTotal.textContent = formatCurrency(totalAmount);
      } else {
        mobileBar.hidden = true;
      }
    }
  }

  function setProductQuantity(productId, targetQty) {
    const feedback = document.getElementById("order-feedback");
    const product = findProductById(productId);

    if (!product) {
      return { ok: false, qty: 0, reason: "Producto no encontrado." };
    }

    if (typeof targetQty !== "number" || !Number.isSafeInteger(targetQty)) {
      if (feedback) feedback.textContent = "La cantidad debe ser un número entero válido.";
      return { ok: false, qty: orderState[productId] || 0, reason: "Cantidad no entera." };
    }

    if (targetQty < 0) {
      if (feedback) feedback.textContent = "No se permiten cantidades negativas.";
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

    if (feedback) feedback.textContent = "";

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

  function copyToClipboardSafe(text) {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      return navigator.clipboard
        .writeText(text)
        .then(function () {
          return true;
        })
        .catch(function () {
          return false;
        });
    }
    return Promise.resolve(false);
  }

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

        const rawDate = dateInput ? dateInput.value.trim() : "";
        const dateValidation = validateDeliveryDate(rawDate);
        if (!dateValidation.valid) {
          if (feedback) feedback.textContent = dateValidation.reason;
          if (dateInput) dateInput.focus();
          return;
        }

        const message = buildWhatsAppMessage();
        const validPhone = validateWhatsAppPhone(DEMO_CONFIG.whatsappNumber);

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

          copyToClipboardSafe(message).then(function (copied) {
            if (!feedback) return;
            if (popupWindow) {
              feedback.textContent =
                "Pedido preparado. Se solicitó abrir WhatsApp en una nueva pestaña (recuerda confirmar el envío en WhatsApp)." +
                (copied ? " Copiamos un respaldo en tu portapapeles." : "");
            } else {
              feedback.textContent =
                "Tu navegador bloqueó la ventana emergente de WhatsApp. " +
                (copied
                  ? "Copiamos el pedido a tu portapapeles como respaldo."
                  : "Permite ventanas emergentes para este sitio o copia el resumen desde la vista previa superior.");
            }
          });
          return;
        }

        copyToClipboardSafe(message).then(function (copied) {
          if (!feedback) return;
          feedback.textContent = copied
            ? "✓ Canal de WhatsApp no configurado en esta demostración. Tu pedido fue preparado y copiado al portapapeles."
            : "Canal de WhatsApp no configurado en esta demostración. Copia el resumen desde la vista previa superior.";
        });
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
          if (feedback) feedback.textContent = dateValidation.reason;
          return;
        }

        const message = buildWhatsAppMessage();
        copyToClipboardSafe(message).then(function (copied) {
          if (!feedback) return;
          feedback.textContent = copied
            ? "✓ Resumen del pedido copiado al portapapeles."
            : "Resumen listo en la vista previa superior para copiarlo manualmente.";
        });
      });
    }
  });
})();