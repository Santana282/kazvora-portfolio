/**
 * KAZVORA Technologies — Demostración Comercial #1: Dulce Atelier (demos/reposteria/app.js)
 * Funcionalidades:
 * - Catálogo demostrativo filtrable por categoría
 * - Armador de pedido interactivo con cálculo en tiempo real
 * - Generador de mensaje estructurado para WhatsApp
 * - Botón de WhatsApp configurable + Copiado directo al portapapeles
 */
(function () {
  "use strict";

  const DEMO_CONFIG = {
    businessName: "Dulce Atelier (Demo KAZVORA)",
    // Si deseas que abra un número de WhatsApp real durante una presentación,
    // coloca aquí los dígitos con código de país (ej. "522721234567").
    whatsappNumber: ""
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
      description: "Bizcocho húmedo de cacao suave con betún artesanal de queso crema y corona de frutos rojos frescos."
    },
    {
      id: "pastel-triple-chocolate",
      name: "Mousse Belga Triple Chocolate",
      category: "Pasteles",
      portions: "12–14 porciones",
      prepTime: "24 h de anticipación",
      price: 750,
      emoji: "🍫",
      description: "Capas de ganache semiamargo, mousse de chocolate con leche y base crujiente de avellana."
    },
    {
      id: "tarta-frambuesa-pistache",
      name: "Tarta Francesa de Pistache y Frambuesa",
      category: "Tartas",
      portions: "8–10 porciones",
      prepTime: "24 h de anticipación",
      price: 620,
      emoji: "🥧",
      description: "Base sablé de almendra rellena de crema de pistache tostado y frambuesas seleccionadas."
    },
    {
      id: "cheesecake-vasco",
      name: "Cheesecake Vasco Caramelizado",
      category: "Tartas",
      portions: "8–10 porciones",
      prepTime: "Disponible el mismo día",
      price: 590,
      emoji: "🍮",
      description: "Textura cremosa al centro y cubierta dorada horneada a alta temperatura al estilo San Sebastián."
    },
    {
      id: "caja-macarons",
      name: "Caja Degustación 12 Macarons",
      category: "Individuales",
      portions: "12 piezas",
      prepTime: "Disponible el mismo día",
      price: 420,
      emoji: "🍬",
      description: "Selección artesanal: vainilla de Papantla, frutos del bosque, caramelo salado, matcha y chocolate."
    },
    {
      id: "pack-cupcakes-celebracion",
      name: "Caja de 6 Cupcakes Gourmet",
      category: "Individuales",
      portions: "6 piezas",
      prepTime: "12 h de anticipación",
      price: 340,
      emoji: "🧁",
      description: "Decorados a mano con buttercream suizo y rellenos frutales o de praliné."
    }
  ];

  // Estado del pedido: { [productId]: quantity }
  const orderState = {
    "pastel-red-velvet": 1
  };

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
    return "$" + Number(amount).toLocaleString("es-MX") + " MXN";
  }

  function getSelectedItems() {
    const list = [];
    DEMO_PRODUCTS.forEach(function (product) {
      const qty = orderState[product.id] || 0;
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
    const deliveryDate = dateEl && dateEl.value ? dateEl.value : "Por definir";
    const notes = notesEl && notesEl.value.trim() ? notesEl.value.trim() : "";

    const lines = [
      "Hola, *" + DEMO_CONFIG.businessName + "*. Quiero consultar disponibilidad para este pedido de demostración:",
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

  function renderFilters() {
    const container = document.getElementById("bakery-filters");
    if (!container) return;

    const categories = ["Todos"];
    DEMO_PRODUCTS.forEach(function (p) {
      if (!categories.includes(p.category)) {
        categories.push(p.category);
      }
    });

    container.innerHTML = categories
      .map(function (cat) {
        const isCurrent = cat === activeCategory;
        return (
          '<button type="button" class="bakery-filter-btn' +
          (isCurrent ? " active" : "") +
          '" data-cat="' +
          escapeHTML(cat) +
          '">' +
          escapeHTML(cat) +
          "</button>"
        );
      })
      .join("");
  }

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
        const controlHTML =
          qty > 0
            ? '<div class="qty-controls">' +
                '<button type="button" class="qty-btn" data-action="dec" data-id="' +
                escapeHTML(product.id) +
                '" aria-label="Disminuir cantidad">−</button>' +
                '<span class="qty-value">' +
                qty +
                "</span>" +
                '<button type="button" class="qty-btn" data-action="inc" data-id="' +
                escapeHTML(product.id) +
                '" aria-label="Aumentar cantidad">+</button>' +
              "</div>"
            : '<button type="button" class="add-btn" data-action="inc" data-id="' +
              escapeHTML(product.id) +
              '">Agregar +</button>';

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
            escapeHTML(product.name) +
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
            return (
              '<div class="order-line">' +
                '<div class="order-line-info">' +
                  "<strong>" +
                  escapeHTML(entry.product.name) +
                  "</strong>" +
                  "<small>" +
                  entry.qty +
                  " × $" +
                  entry.product.price +
                  " = " +
                  formatCurrency(entry.subtotal) +
                  "</small>" +
                "</div>" +
                '<div class="qty-controls">' +
                  '<button type="button" class="qty-btn" data-action="dec" data-id="' +
                  escapeHTML(entry.product.id) +
                  '" aria-label="Quitar uno">−</button>' +
                  '<span class="qty-value">' +
                  entry.qty +
                  "</span>" +
                  '<button type="button" class="qty-btn" data-action="inc" data-id="' +
                  escapeHTML(entry.product.id) +
                  '" aria-label="Agregar uno">+</button>' +
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

  function updateQuantity(productId, delta) {
    const current = orderState[productId] || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      delete orderState[productId];
    } else {
      orderState[productId] = next;
    }
    renderCatalog();
    renderOrderSummary();
  }

  function copyTextToClipboard(text, feedbackEl, successMessage) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          if (feedbackEl) feedbackEl.textContent = successMessage;
        })
        .catch(function () {
          if (feedbackEl) feedbackEl.textContent = "Resumen listo en la vista previa superior.";
        });
    } else if (feedbackEl) {
      feedbackEl.textContent = "Resumen listo en la vista previa superior.";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderFilters();
    renderCatalog();
    renderOrderSummary();

    // Delegación de eventos para filtros
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

    // Delegación de eventos para botones + / - en catálogo y panel
    document.body.addEventListener("click", function (event) {
      const qtyBtn = event.target.closest("[data-action][data-id]");
      if (!qtyBtn) return;
      const action = qtyBtn.getAttribute("data-action");
      const id = qtyBtn.getAttribute("data-id");
      if (!id) return;
      updateQuantity(id, action === "inc" ? 1 : -1);
    });

    // Actualizar vista previa en tiempo real al escribir en el formulario
    const form = document.getElementById("bakery-order-form");
    const feedback = document.getElementById("order-feedback");
    const copyBtn = document.getElementById("copy-order-btn");

    if (form) {
      form.addEventListener("input", function () {
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
            feedback.textContent = "Agrega al menos un producto del catálogo para preparar el pedido.";
          }
          return;
        }

        const message = buildWhatsAppMessage();
        const cleanPhone = DEMO_CONFIG.whatsappNumber.replace(/\D/g, "");

        if (cleanPhone.length >= 10) {
          const waUrl = "https://wa.me/" + cleanPhone + "?text=" + encodeURIComponent(message);
          window.open(waUrl, "_blank", "noopener,noreferrer");
          if (feedback) {
            feedback.textContent = "✓ Abriendo WhatsApp con tu pedido demostrativo...";
          }
        } else {
          copyTextToClipboard(
            message,
            feedback,
            "✓ Pedido preparado y copiado al portapapeles (Modo demostración sin número de WhatsApp activo)."
          );
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
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