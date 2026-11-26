/**
 * KAZVORA Technologies — Demostración Comercial #2: Clínica Dental Nova (demos/clinica-citas/app.js)
 * - Construcción 100 % nativa del DOM (sin innerHTML: mitigación estructural anti-XSS)
 * - Lee configuración pública desde window.KAZVORA_ENV (js/config.js)
 * - Selección de tratamiento, validación de fecha local (bloquea fechas pasadas y domingos)
 * - Selector accesible de horarios (aria-pressed), validación E.164 y respaldo de portapapeles
 */
(function () {
  "use strict";

  const ENV =
    typeof window !== "undefined" &&
    window.KAZVORA_ENV &&
    typeof window.KAZVORA_ENV === "object"
      ? window.KAZVORA_ENV
      : {};

  const CLINIC_CONFIG = {
    businessName: "Clínica Dental Nova (Demo KAZVORA)",
    // Conservado vacío "" hasta autorización comercial explícita.
    whatsappNumber:
      typeof ENV.demoClinicWhatsappNumber === "string" ? ENV.demoClinicWhatsappNumber : ""
  };

  const CLINIC_SERVICES = [
    {
      id: "valoracion-limpieza",
      name: "Valoración Integral y Limpieza Ultrasónica",
      area: "Prevención",
      duration: "45 min",
      price: 650,
      description:
        "Revisión diagnóstica general, profilaxis ultrasónica y plan de cuidado preventivo personalizado."
    },
    {
      id: "resina-estetica",
      name: "Restauración con Resina Estética",
      area: "Restauración",
      duration: "50 min",
      price: 890,
      description:
        "Reconstrucción dental con materiales fotopolimerizables de alta estética igualados al tono natural."
    },
    {
      id: "blanqueamiento-clinico",
      name: "Blanqueamiento Dental en Consultorio",
      area: "Estética",
      duration: "60 min",
      price: 2200,
      description:
        "Sesión controlada de aclaramiento dental con protección gingival y evaluación previa de sensibilidad."
    },
    {
      id: "valoracion-ortodoncia",
      name: "Consulta de Valoración de Ortodoncia",
      area: "Ortodoncia",
      duration: "40 min",
      price: 450,
      description:
        "Evaluación de alineación dental y mordida para definir opciones de brackets o alineadores."
    },
    {
      id: "urgencia-dental",
      name: "Atención de Molestia o Urgencia Dental",
      area: "Restauración",
      duration: "45 min",
      price: 700,
      description:
        "Valoración prioritaria por dolor agudo, sensibilidad repentina o fractura de pieza dental."
    },
    {
      id: "revision-infantil",
      name: "Consulta Preventiva Infantil",
      area: "Prevención",
      duration: "35 min",
      price: 550,
      description:
        "Revisión amigable para niños con aplicación de flúor y orientación de cepillado para padres."
    }
  ];

  const TIME_SLOTS = ["09:30", "11:00", "12:30", "16:00", "17:30", "18:30"];

  let activeArea = "Todos";
  let selectedServiceId = null;
  let selectedTimeSlot = "";

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

  function validateWhatsAppPhone(rawPhone) {
    if (typeof rawPhone !== "string") return null;
    const trimmed = rawPhone.trim();
    if (!trimmed) return null;
    if (!/^\+?[0-9\s-]+$/.test(trimmed)) return null;
    const digits = trimmed.replace(/[\s+-]/g, "");
    if (!/^[1-9]\d{10,14}$/.test(digits)) return null;
    return digits;
  }

  function getTodayLocalISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function validateAppointmentDate(dateStr) {
    if (typeof dateStr !== "string" || dateStr.trim() === "") {
      return { valid: false, reason: "Por favor, selecciona una fecha preferida para tu cita." };
    }

    const trimmed = dateStr.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { valid: false, reason: "El formato de la fecha no es válido (AAAA-MM-DD)." };
    }

    const parts = trimmed.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return { valid: false, reason: "La fecha ingresada no existe en el calendario." };
    }

    const todayISO = getTodayLocalISO();
    if (trimmed < todayISO) {
      return {
        valid: false,
        reason: "No es posible agendar en una fecha pasada (" + trimmed + "). Elige desde hoy (" + todayISO + ")."
      };
    }

    if (parsed.getDay() === 0) {
      return {
        valid: false,
        reason: "En esta demostración la clínica atiende de lunes a sábado. Por favor elige otro día."
      };
    }

    return { valid: true, reason: "" };
  }

  function findServiceById(id) {
    for (let i = 0; i < CLINIC_SERVICES.length; i += 1) {
      if (CLINIC_SERVICES[i].id === id) return CLINIC_SERVICES[i];
    }
    return null;
  }

  function buildWhatsAppMessage() {
    const service = findServiceById(selectedServiceId);
    const nameEl = document.getElementById("patient-name");
    const visitEl = document.getElementById("visit-type");
    const dateEl = document.getElementById("appointment-date");
    const notesEl = document.getElementById("patient-notes");

    const patientName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : "[Nombre del paciente]";
    const visitType = visitEl ? visitEl.value : "Primera vez";
    const rawDate = dateEl && dateEl.value ? dateEl.value.trim() : "";
    const dateCheck = rawDate ? validateAppointmentDate(rawDate) : { valid: false };
    const dateLabel = rawDate && dateCheck.valid ? rawDate : "[Fecha por definir]";
    const slotLabel = selectedTimeSlot ? selectedTimeSlot + " h" : "[Horario por definir]";
    const notes = notesEl && notesEl.value.trim() ? notesEl.value.trim() : "";

    const lines = [
      "Hola, *" + CLINIC_CONFIG.businessName + "*. Quisiera solicitar disponibilidad para una cita (Demo):",
      "",
      "👤 *Paciente:* " + patientName + " (" + visitType + ")",
      "🦷 *Tratamiento:* " + (service ? service.name + " (" + service.duration + ")" : "[Sin seleccionar]"),
      "💵 *Referencia orientativa (Demo):* " + (service ? formatCurrency(service.price) : "Por definir"),
      "📅 *Fecha preferida:* " + dateLabel,
      "🕒 *Horario preferido:* " + slotLabel
    ];

    if (notes) {
      lines.push("📝 *Comentarios:* " + notes);
    }

    lines.push("");
    lines.push("_(Solicitud generada desde la Demostración Comercial #2 de KAZVORA Technologies)_");

    return lines.join("\n");
  }

  function renderFilters() {
    const container = document.getElementById("clinic-filters");
    if (!container) return;

    const areas = ["Todos"];
    CLINIC_SERVICES.forEach(function (srv) {
      if (!areas.includes(srv.area)) areas.push(srv.area);
    });

    const existing = container.querySelectorAll(".clinic-filter-btn");
    if (existing.length === areas.length) {
      existing.forEach(function (btn) {
        const area = btn.getAttribute("data-area") || "";
        const isCurrent = area === activeArea;
        btn.classList.toggle("active", isCurrent);
        btn.setAttribute("aria-pressed", String(isCurrent));
      });
      return;
    }

    clearContainer(container);
    areas.forEach(function (area) {
      const isCurrent = area === activeArea;
      const btn = createEl(
        "button",
        isCurrent ? "clinic-filter-btn active" : "clinic-filter-btn",
        area
      );
      btn.setAttribute("type", "button");
      btn.setAttribute("data-area", area);
      btn.setAttribute("aria-pressed", String(isCurrent));
      container.appendChild(btn);
    });
  }

  function renderServices() {
    const grid = document.getElementById("clinic-services-grid");
    if (!grid) return;

    clearContainer(grid);
    const filtered =
      activeArea === "Todos"
        ? CLINIC_SERVICES
        : CLINIC_SERVICES.filter(function (s) {
            return s.area === activeArea;
          });

    filtered.forEach(function (service) {
      const isSelected = service.id === selectedServiceId;
      const card = createEl(
        "article",
        isSelected ? "treatment-card is-selected" : "treatment-card"
      );

      const top = createEl("div", "treatment-top");
      top.appendChild(createEl("span", "treatment-cat", service.area));
      top.appendChild(createEl("span", "treatment-duration", service.duration));
      card.appendChild(top);

      card.appendChild(createEl("h3", "", service.name));
      card.appendChild(createEl("p", "treatment-desc", service.description));

      const bottom = createEl("div", "treatment-bottom");
      bottom.appendChild(createEl("span", "treatment-price", formatCurrency(service.price)));

      const selectBtn = createEl(
        "button",
        "select-treatment-btn",
        isSelected ? "Seleccionado ✓" : "Elegir"
      );
      selectBtn.setAttribute("type", "button");
      selectBtn.setAttribute("data-service-id", service.id);
      selectBtn.setAttribute("aria-pressed", String(isSelected));
      selectBtn.setAttribute(
        "aria-label",
        (isSelected ? "Tratamiento seleccionado: " : "Elegir tratamiento ") + service.name
      );

      bottom.appendChild(selectBtn);
      card.appendChild(bottom);
      grid.appendChild(card);
    });
  }

  function renderTimeSlots() {
    const container = document.getElementById("time-slots-grid");
    if (!container) return;

    const existing = container.querySelectorAll(".slot-btn");
    if (existing.length === TIME_SLOTS.length) {
      existing.forEach(function (btn) {
        const slot = btn.getAttribute("data-slot") || "";
        const isCurrent = slot === selectedTimeSlot;
        btn.classList.toggle("active", isCurrent);
        btn.setAttribute("aria-pressed", String(isCurrent));
      });
      return;
    }

    clearContainer(container);
    TIME_SLOTS.forEach(function (slot) {
      const isCurrent = slot === selectedTimeSlot;
      const btn = createEl("button", isCurrent ? "slot-btn active" : "slot-btn", slot);
      btn.setAttribute("type", "button");
      btn.setAttribute("data-slot", slot);
      btn.setAttribute("aria-pressed", String(isCurrent));
      btn.setAttribute("aria-label", "Seleccionar horario de las " + slot + " horas");
      container.appendChild(btn);
    });
  }

  function renderSelectedSummary() {
    const box = document.getElementById("selected-service-box");
    const preview = document.getElementById("clinic-whatsapp-preview");
    const service = findServiceById(selectedServiceId);

    if (box) {
      clearContainer(box);
      if (!service) {
        box.appendChild(createEl("strong", "", "Ningún tratamiento seleccionado aún"));
        box.appendChild(
          createEl(
            "span",
            "",
            "Elige una opción del listado izquierdo para calcular duración y referencia."
          )
        );
      } else {
        box.appendChild(createEl("strong", "", service.name));
        box.appendChild(
          createEl(
            "span",
            "",
            service.area + " · " + service.duration + " · Referencia: " + formatCurrency(service.price)
          )
        );
      }
    }

    if (preview) {
      preview.textContent = buildWhatsAppMessage();
    }
  }

  function selectService(serviceId) {
    const srv = findServiceById(serviceId);
    if (!srv) return false;
    selectedServiceId = srv.id;
    renderServices();
    renderSelectedSummary();
    return true;
  }

  function selectTimeSlot(slot) {
    if (!TIME_SLOTS.includes(slot)) return false;
    selectedTimeSlot = slot;
    renderTimeSlots();
    renderSelectedSummary();
    return true;
  }

  function copyToClipboardSafe(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
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

  window.KAZVORA_CLINIC_DEMO = {
    CLINIC_CONFIG: CLINIC_CONFIG,
    TIME_SLOTS: TIME_SLOTS.slice(),
    selectService: selectService,
    selectTimeSlot: selectTimeSlot,
    validateAppointmentDate: validateAppointmentDate,
    validateWhatsAppPhone: validateWhatsAppPhone,
    getTodayLocalISO: getTodayLocalISO,
    buildWhatsAppMessage: buildWhatsAppMessage,
    getState: function () {
      return {
        selectedServiceId: selectedServiceId,
        selectedTimeSlot: selectedTimeSlot,
        activeArea: activeArea
      };
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    const dateInput = document.getElementById("appointment-date");
    if (dateInput) {
      dateInput.setAttribute("min", getTodayLocalISO());
    }

    renderFilters();
    renderServices();
    renderTimeSlots();
    renderSelectedSummary();

    const filtersEl = document.getElementById("clinic-filters");
    if (filtersEl) {
      filtersEl.addEventListener("click", function (event) {
        const btn = event.target.closest(".clinic-filter-btn");
        if (!btn) return;
        activeArea = btn.getAttribute("data-area") || "Todos";
        renderFilters();
        renderServices();
      });
    }

    const servicesGrid = document.getElementById("clinic-services-grid");
    if (servicesGrid) {
      servicesGrid.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-service-id]");
        if (!btn) return;
        const id = btn.getAttribute("data-service-id");
        if (id) {
          selectService(id);
          const feedback = document.getElementById("booking-feedback");
          if (feedback) {
            feedback.textContent = "";
            feedback.className = "booking-feedback";
          }
        }
      });
    }

    const slotsGrid = document.getElementById("time-slots-grid");
    if (slotsGrid) {
      slotsGrid.addEventListener("click", function (event) {
        const btn = event.target.closest("[data-slot]");
        if (!btn) return;
        const slot = btn.getAttribute("data-slot");
        if (slot) selectTimeSlot(slot);
      });
    }

    const form = document.getElementById("clinic-booking-form");
    const feedback = document.getElementById("booking-feedback");
    const copyBtn = document.getElementById("copy-booking-btn");

    function validateBookingForm() {
      if (!findServiceById(selectedServiceId)) {
        return { ok: false, message: "Primero elige un tratamiento del catálogo." };
      }

      const nameInput = document.getElementById("patient-name");
      const name = nameInput ? nameInput.value.trim() : "";
      if (name.length < 2 || name.length > 80) {
        if (nameInput) nameInput.focus();
        return { ok: false, message: "Ingresa el nombre del paciente (entre 2 y 80 caracteres)." };
      }

      const rawDate = dateInput ? dateInput.value.trim() : "";
      const dateCheck = validateAppointmentDate(rawDate);
      if (!dateCheck.valid) {
        if (dateInput) dateInput.focus();
        return { ok: false, message: dateCheck.reason };
      }

      if (!selectedTimeSlot) {
        return { ok: false, message: "Selecciona un horario preferido para continuar." };
      }

      return { ok: true, message: "" };
    }

    if (form) {
      form.addEventListener("input", function () {
        if (dateInput && dateInput.value) {
          const check = validateAppointmentDate(dateInput.value);
          if (!check.valid && feedback) {
            feedback.textContent = check.reason;
            feedback.className = "booking-feedback is-error";
          } else if (feedback && feedback.className.includes("is-error")) {
            feedback.textContent = "";
            feedback.className = "booking-feedback";
          }
        }
        renderSelectedSummary();
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        const check = validateBookingForm();
        if (!check.ok) {
          if (feedback) {
            feedback.textContent = check.message;
            feedback.className = "booking-feedback is-error";
          }
          return;
        }

        const preparedText = buildWhatsAppMessage();
        const validPhone = validateWhatsAppPhone(CLINIC_CONFIG.whatsappNumber);

        if (validPhone) {
          const waUrl = "https://wa.me/" + validPhone + "?text=" + encodeURIComponent(preparedText);
          let popupWindow = null;
          try {
            popupWindow = window.open(waUrl, "_blank");
            if (popupWindow) {
              popupWindow.opener = null;
            }
          } catch (err) {
            popupWindow = null;
          }

          copyToClipboardSafe(preparedText).then(function (copied) {
            if (!feedback) return;
            if (popupWindow) {
              feedback.textContent =
                "Solicitud preparada. Se solicitó abrir WhatsApp en una nueva pestaña (pulsa Enviar dentro de WhatsApp para completar tu solicitud)." +
                (copied ? " Copiamos respaldo en tu portapapeles." : "");
              feedback.className = "booking-feedback";
            } else {
              feedback.textContent =
                "Tu navegador bloqueó la ventana emergente de WhatsApp. " +
                (copied
                  ? "Copiamos la solicitud en tu portapapeles para pegarla manualmente."
                  : "Permite ventanas emergentes o copia el texto de la vista previa.");
              feedback.className = "booking-feedback is-error";
            }
          });
          return;
        }

        copyToClipboardSafe(preparedText).then(function (copied) {
          if (!feedback) return;
          feedback.textContent = copied
            ? "✓ Solicitud preparada y copiada al portapapeles (Modo demostración sin número de WhatsApp activo)."
            : "Solicitud lista en la vista previa superior para copiarla manualmente.";
          feedback.className = "booking-feedback";
        });
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const check = validateBookingForm();
        if (!check.ok) {
          if (feedback) {
            feedback.textContent = check.message;
            feedback.className = "booking-feedback is-error";
          }
          return;
        }

        const preparedText = buildWhatsAppMessage();
        copyToClipboardSafe(preparedText).then(function (copied) {
          if (!feedback) return;
          feedback.textContent = copied
            ? "✓ Solicitud de cita copiada al portapapeles."
            : "Solicitud lista en la vista previa superior.";
          feedback.className = "booking-feedback";
        });
      });
    }
  });
})();