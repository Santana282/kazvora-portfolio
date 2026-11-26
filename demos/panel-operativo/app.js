/**
 * KAZVORA Technologies — Prototipo de Panel de Organización Operativa (demos/panel-operativo/app.js)
 * - Construcción 100 % nativa del DOM (sin innerHTML: mitigación estructural anti-XSS)
 * - Estado en memoria (no utiliza almacenamiento del navegador como base de datos segura)
 * - Protección contra CSV Formula Injection (OWASP) al exportar reportes
 * - Validación estricta de SKU, categorías, precios y existencias
 */
(function () {
  "use strict";

  const ALLOWED_CATEGORIES = ["Bebidas", "Insumos", "Empaque", "Accesorios"];
  const MAX_STOCK = 9999;
  const MAX_PRICE = 100000;

  const INITIAL_INVENTORY = [
    { sku: "CAF-001", name: "Café Veracruz Grano 1kg", category: "Bebidas", price: 320, stock: 18, minStock: 6 },
    { sku: "CAF-002", name: "Matcha Ceremonial 250g", category: "Bebidas", price: 410, stock: 4, minStock: 5 },
    { sku: "INS-010", name: "Jarabe Vainilla Natural 750ml", category: "Insumos", price: 185, stock: 12, minStock: 4 },
    { sku: "INS-014", name: "Cacao Semiamargo Repostería 1kg", category: "Insumos", price: 290, stock: 3, minStock: 5 },
    { sku: "EMP-021", name: "Caja Pastel 25x25cm (Paq. 25)", category: "Empaque", price: 240, stock: 9, minStock: 4 },
    { sku: "ACC-005", name: "Termo Acero Inoxidable 500ml", category: "Accesorios", price: 360, stock: 0, minStock: 3 }
  ];

  let inventory = [];
  let activityLog = [];
  let sessionSalesAmount = 0;
  let sessionSalesCount = 0;
  let activeCategory = "Todos";
  let searchQuery = "";

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
    const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    return "$" + safe.toLocaleString("es-MX") + " MXN";
  }

  function getTimeLabel() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }

  /**
   * Neutraliza CSV Formula Injection (OWASP) escapando celdas que comiencen con =, +, -, @, Tab o CR
   * y aplicando formato RFC 4180 (comillas dobles escapadas).
   */
  function sanitizeCsvCell(rawCell) {
    let text = rawCell === null || rawCell === undefined ? "" : String(rawCell);
    text = text.replace(/\r?\n/g, " ");
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function generateSafeCsv(items) {
    const header = ["SKU", "Producto", "Categoria", "Precio_MXN", "Existencia", "Stock_Minimo", "Estado"];
    const rows = [header.map(sanitizeCsvCell).join(",")];

    items.forEach(function (item) {
      const status =
        item.stock === 0 ? "Agotado" : item.stock <= item.minStock ? "Stock bajo" : "Óptimo";
      rows.push(
        [item.sku, item.name, item.category, item.price, item.stock, item.minStock, status]
          .map(sanitizeCsvCell)
          .join(",")
      );
    });

    return rows.join("\n");
  }

  function pushLog(message) {
    activityLog.unshift({ time: getTimeLabel(), message: message });
    if (activityLog.length > 20) {
      activityLog.pop();
    }
  }

  function resetDemoState() {
    inventory = INITIAL_INVENTORY.map(function (item) {
      return Object.assign({}, item);
    });
    activityLog = [];
    sessionSalesAmount = 0;
    sessionSalesCount = 0;
    activeCategory = "Todos";
    searchQuery = "";

    const searchInput = document.getElementById("ops-search");
    if (searchInput) searchInput.value = "";

    pushLog("Datos demostrativos inicializados en memoria.");
    renderAll();
  }

  function getStockStatus(item) {
    if (item.stock === 0) return { label: "Agotado", className: "status-pill status-empty" };
    if (item.stock <= item.minStock) return { label: "Stock bajo", className: "status-pill status-low" };
    return { label: "Óptimo", className: "status-pill status-ok" };
  }

  function getMetrics() {
    let totalUnits = 0;
    let totalValue = 0;
    let lowStockCount = 0;

    inventory.forEach(function (item) {
      totalUnits += item.stock;
      totalValue += item.stock * item.price;
      if (item.stock <= item.minStock) {
        lowStockCount += 1;
      }
    });

    return {
      totalSkus: inventory.length,
      totalUnits: totalUnits,
      totalValue: totalValue,
      lowStockCount: lowStockCount,
      sessionSalesAmount: sessionSalesAmount,
      sessionSalesCount: sessionSalesCount
    };
  }

  function registerMovement(sku, type) {
    const item = inventory.find(function (p) {
      return p.sku === sku;
    });
    if (!item) return { ok: false, reason: "Artículo no encontrado." };

    if (type === "sell") {
      if (item.stock <= 0) {
        return { ok: false, reason: "Sin existencias disponibles para venta." };
      }
      item.stock -= 1;
      sessionSalesAmount += item.price;
      sessionSalesCount += 1;
      pushLog("Venta (-1): " + item.name + " (+" + formatCurrency(item.price) + ")");
      renderAll();
      return { ok: true, stock: item.stock };
    }

    if (type === "restock") {
      if (item.stock >= MAX_STOCK) {
        return { ok: false, reason: "Límite máximo de inventario alcanzado." };
      }
      item.stock += 1;
      pushLog("Entrada (+1): " + item.name + " (Stock: " + item.stock + ")");
      renderAll();
      return { ok: true, stock: item.stock };
    }

    return { ok: false, reason: "Movimiento no válido." };
  }

  function addProduct(rawData) {
    const sku = typeof rawData.sku === "string" ? rawData.sku.trim().toUpperCase() : "";
    const name = typeof rawData.name === "string" ? rawData.name.trim() : "";
    const category = typeof rawData.category === "string" ? rawData.category.trim() : "";
    const price = Number(rawData.price);
    const stock = Number(rawData.stock);
    const minStock = Number(rawData.minStock);

    if (!/^[A-Z0-9-]{3,16}$/.test(sku)) {
      return { ok: false, reason: "El SKU debe tener 3 a 16 caracteres (solo letras, números y guiones)." };
    }

    if (inventory.some(function (p) { return p.sku === sku; })) {
      return { ok: false, reason: "Ya existe un artículo registrado con el SKU " + sku + "." };
    }

    if (name.length < 2 || name.length > 70) {
      return { ok: false, reason: "El nombre del producto debe tener entre 2 y 70 caracteres." };
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return { ok: false, reason: "Selecciona una categoría permitida." };
    }

    if (!Number.isSafeInteger(price) || price < 1 || price > MAX_PRICE) {
      return { ok: false, reason: "El precio debe ser un entero entre $1 y $100,000 MXN." };
    }

    if (!Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) {
      return { ok: false, reason: "El stock inicial debe ser un entero entre 0 y 9,999." };
    }

    if (!Number.isSafeInteger(minStock) || minStock < 0 || minStock > 999) {
      return { ok: false, reason: "El stock mínimo debe ser un entero entre 0 y 999." };
    }

    const newItem = {
      sku: sku,
      name: name,
      category: category,
      price: price,
      stock: stock,
      minStock: minStock
    };

    inventory.unshift(newItem);
    pushLog("Alta de artículo: " + sku + " — " + name);
    renderAll();
    return { ok: true, item: newItem };
  }

  function renderKpis() {
    const m = getMetrics();
    const skusEl = document.getElementById("kpi-total-skus");
    const unitsEl = document.getElementById("kpi-total-units");
    const valEl = document.getElementById("kpi-inventory-value");
    const salesEl = document.getElementById("kpi-session-sales");
    const countEl = document.getElementById("kpi-sales-count");
    const lowEl = document.getElementById("kpi-low-stock");

    if (skusEl) skusEl.textContent = String(m.totalSkus);
    if (unitsEl) unitsEl.textContent = m.totalUnits + " unidades en existencia";
    if (valEl) valEl.textContent = formatCurrency(m.totalValue);
    if (salesEl) salesEl.textContent = formatCurrency(m.sessionSalesAmount);
    if (countEl) {
      countEl.textContent =
        m.sessionSalesCount + (m.sessionSalesCount === 1 ? " venta registrada" : " ventas registradas");
    }
    if (lowEl) lowEl.textContent = String(m.lowStockCount);
  }

  function renderFilters() {
    const container = document.getElementById("ops-filters");
    if (!container) return;

    const categories = ["Todos"].concat(ALLOWED_CATEGORIES);
    const existing = container.querySelectorAll(".ops-filter-btn");
    if (existing.length === categories.length) {
      existing.forEach(function (btn) {
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
      const btn = createEl("button", isCurrent ? "ops-filter-btn active" : "ops-filter-btn", cat);
      btn.setAttribute("type", "button");
      btn.setAttribute("data-cat", cat);
      btn.setAttribute("aria-pressed", String(isCurrent));
      container.appendChild(btn);
    });
  }

  function renderTable() {
    const tbody = document.getElementById("ops-inventory-body");
    if (!tbody) return;

    clearContainer(tbody);
    const q = searchQuery.trim().toLowerCase();

    const filtered = inventory.filter(function (item) {
      const matchesCat = activeCategory === "Todos" || item.category === activeCategory;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      const tr = createEl("tr");
      const td = createEl("td", "empty-row", "No se encontraron artículos con los filtros actuales.");
      td.setAttribute("colspan", "6");
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(function (item) {
      const tr = createEl("tr");

      const tdName = createEl("td");
      tdName.appendChild(createEl("span", "sku-code", item.sku));
      tdName.appendChild(createEl("strong", "", item.name));
      tr.appendChild(tdName);

      tr.appendChild(createEl("td", "", item.category));
      tr.appendChild(createEl("td", "", formatCurrency(item.price)));
      tr.appendChild(createEl("td", "", item.stock + " u. (mín. " + item.minStock + ")"));

      const tdStatus = createEl("td");
      const st = getStockStatus(item);
      tdStatus.appendChild(createEl("span", st.className, st.label));
      tr.appendChild(tdStatus);

      const tdActions = createEl("td");
      const group = createEl("div", "action-group");

      const sellBtn = createEl("button", "row-btn row-btn-sell", "Venta -1");
      sellBtn.setAttribute("type", "button");
      sellBtn.setAttribute("data-move", "sell");
      sellBtn.setAttribute("data-sku", item.sku);
      sellBtn.setAttribute("aria-label", "Registrar venta de una unidad de " + item.name);
      if (item.stock <= 0) sellBtn.disabled = true;

      const restockBtn = createEl("button", "row-btn row-btn-restock", "+1");
      restockBtn.setAttribute("type", "button");
      restockBtn.setAttribute("data-move", "restock");
      restockBtn.setAttribute("data-sku", item.sku);
      restockBtn.setAttribute("aria-label", "Registrar entrada de una unidad de " + item.name);

      group.appendChild(sellBtn);
      group.appendChild(restockBtn);
      tdActions.appendChild(group);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function renderActivityLog() {
    const list = document.getElementById("ops-activity-log");
    if (!list) return;

    clearContainer(list);
    activityLog.forEach(function (entry) {
      const li = createEl("li", "activity-item");
      li.appendChild(createEl("small", "", entry.time));
      li.appendChild(createEl("span", "", entry.message));
      list.appendChild(li);
    });
  }

  function renderAll() {
    renderKpis();
    renderFilters();
    renderTable();
    renderActivityLog();
  }

  function downloadCsvFile() {
    const csv = generateSafeCsv(inventory);
    const feedback = document.getElementById("ops-feedback");

    try {
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "kazvora-inventario-demo.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      pushLog("Exportación CSV generada (" + inventory.length + " artículos).");
      renderActivityLog();
      if (feedback) {
        feedback.textContent = "✓ Archivo CSV seguro descargado.";
        feedback.className = "ops-feedback is-success";
      }
    } catch (err) {
      if (feedback) {
        feedback.textContent = "No se pudo descargar el CSV en este navegador.";
        feedback.className = "ops-feedback is-error";
      }
    }
  }

  window.KAZVORA_OPS_DEMO = {
    getMetrics: getMetrics,
    addProduct: addProduct,
    registerMovement: registerMovement,
    sanitizeCsvCell: sanitizeCsvCell,
    generateSafeCsv: generateSafeCsv,
    resetDemoState: resetDemoState,
    getInventorySnapshot: function () {
      return inventory.map(function (i) { return Object.assign({}, i); });
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    resetDemoState();

    const filtersEl = document.getElementById("ops-filters");
    if (filtersEl) {
      filtersEl.addEventListener("click", function (event) {
        const btn = event.target.closest(".ops-filter-btn");
        if (!btn) return;
        activeCategory = btn.getAttribute("data-cat") || "Todos";
        renderFilters();
        renderTable();
      });
    }

    const searchInput = document.getElementById("ops-search");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        searchQuery = searchInput.value;
        renderTable();
      });
    }

    const tbody = document.getElementById("ops-inventory-body");
    if (tbody) {
      tbody.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-move][data-sku]");
        if (!btn) return;
        const move = btn.getAttribute("data-move");
        const sku = btn.getAttribute("data-sku");
        if (move && sku) {
          registerMovement(sku, move);
        }
      });
    }

    const form = document.getElementById("ops-add-form");
    const feedback = document.getElementById("ops-feedback");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const res = addProduct({
          sku: document.getElementById("sku-input").value,
          name: document.getElementById("name-input").value,
          category: document.getElementById("category-input").value,
          price: document.getElementById("price-input").value,
          stock: document.getElementById("stock-input").value,
          minStock: document.getElementById("min-stock-input").value
        });

        if (!res.ok) {
          if (feedback) {
            feedback.textContent = res.reason;
            feedback.className = "ops-feedback is-error";
          }
          return;
        }

        form.reset();
        if (feedback) {
          feedback.textContent = "✓ Artículo " + res.item.sku + " agregado a la sesión.";
          feedback.className = "ops-feedback is-success";
        }
      });
    }

    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", downloadCsvFile);
    }

    const resetBtn = document.getElementById("reset-demo-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetDemoState();
        if (feedback) {
          feedback.textContent = "✓ Datos demostrativos restaurados.";
          feedback.className = "ops-feedback is-success";
        }
      });
    }
  });
})();