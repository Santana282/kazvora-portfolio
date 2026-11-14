/**
 * KAZVORA Technologies — Controlador Principal (js/main.js)
 * Intervención Técnica Fase 4:
 * - MAIN-001: Política positiva de validación de URLs (HTTP, HTTPS y rutas relativas válidas)
 * - MAIN-002: Límites de longitud y validación de campos en el formulario sin pérdida de datos
 * - MAIN-003: Manejo transparente de WhatsApp, detección de bloqueo de popups y copia de respaldo
 * - PROJECTS-002: Respaldo de validación de esquema al consumir window.KAZVORA_PROJECTS
 */
(function () {
  "use strict";

  const KAZVORA_CONFIG = {
    // Número internacional E.164 (ej. "522721234567").
    // Se conserva vacío "" hasta que el fundador autorice el número comercial definitivo.
    whatsappNumber: ""
  };

  const FORM_LIMITS = {
    NAME_MIN: 2,
    NAME_MAX: 80,
    EMAIL_MAX: 120,
    TYPE_MAX: 60,
    MESSAGE_MIN: 10,
    MESSAGE_MAX: 1000
  };

  const ALLOWED_CATEGORIES = ["Web", "Catálogo digital", "Datos y software"];

  /**
   * Sanitiza cadenas de texto para evitar inyección de HTML (XSS)
   * @param {string} value
   * @returns {string}
   */
  function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * MAIN-001: Valida positivamente una URL permitiendo solo HTTP, HTTPS o rutas relativas válidas.
   * Rechaza javascript:, data:, vbscript:, protocolos desconocidos, URLs protocol-relative (//)
   * y caracteres peligrosos para atributos HTML.
   * @param {string} rawUrl
   * @returns {string|null} URL válida o null si debe rechazarse
   */
  function validateSafeUrl(rawUrl) {
    if (window.KAZVORA_SCHEMA && typeof window.KAZVORA_SCHEMA.validateProjectUrl === "function") {
      return window.KAZVORA_SCHEMA.validateProjectUrl(rawUrl);
    }

    if (typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    if (trimmed === "") return "";

    if (/[\u0000-\u001F\u007F\s"'<>`]/.test(trimmed)) {
      return null;
    }

    if (trimmed.startsWith("//") || trimmed.startsWith("\\\\") || trimmed.includes("\\")) {
      return null;
    }

    const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      if (scheme !== "http" && scheme !== "https") {
        return null;
      }
      try {
        const parsed = new URL(trimmed);
        if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
          return null;
        }
        return trimmed;
      } catch (err) {
        return null;
      }
    }

    if (trimmed.includes(":")) {
      return null;
    }

    const relativePattern =
      /^(?:\.\/)?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*(?:\?[a-zA-Z0-9=&._-]+)?(?:#[a-zA-Z0-9._-]+)?$/;
    if (!relativePattern.test(trimmed) || trimmed.includes("..")) {
      return null;
    }

    return trimmed;
  }

  /**
   * Valida formato telefónico internacional E.164 para WhatsApp (11 a 15 dígitos con prefijo de país)
   * @param {string} rawPhone
   * @returns {string|null} Número de solo dígitos o null si no es válido
   */
  function validateWhatsAppPhone(rawPhone) {
    if (typeof rawPhone !== "string") return null;
    const trimmed = rawPhone.trim();
    if (!trimmed) return null;

    // Solo permitir dígitos, espacios, guiones y un signo '+' inicial opcional
    if (!/^\+?[0-9\s-]+$/.test(trimmed)) {
      return null;
    }

    const digits = trimmed.replace(/[\s+-]/g, "");
    // Formato internacional E.164: no inicia con 0, requiere código de país + número (11 a 15 dígitos)
    if (!/^[1-9]\d{10,14}$/.test(digits)) {
      return null;
    }

    return digits;
  }

  /**
   * Valida correo electrónico opcional con límite de longitud
   * @param {string} email
   * @returns {boolean}
   */
  function isValidOptionalEmail(email) {
    if (!email) return true;
    if (email.length > FORM_LIMITS.EMAIL_MAX) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  /**
   * PROJECTS-002: Obtiene y valida defensivamente la lista de proyectos
   * @returns {Array}
   */
  function getValidatedProjects() {
    const raw = window.KAZVORA_PROJECTS;
    if (
      window.KAZVORA_SCHEMA &&
      typeof window.KAZVORA_SCHEMA.validateKazvoraProjects === "function"
    ) {
      return window.KAZVORA_SCHEMA.validateKazvoraProjects(raw);
    }

    if (!Array.isArray(raw)) return [];
    const seenIds = new Set();

    return raw.filter(function (item) {
      if (!item || typeof item !== "object") return false;
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const desc = typeof item.description === "string" ? item.description.trim() : "";
      const cat = typeof item.category === "string" ? item.category.trim() : "";

      if (!id || seenIds.has(id) || !title || !desc) return false;
      if (!ALLOWED_CATEGORIES.includes(cat)) return false;
      if (typeof item.featured !== "boolean") return false;

      const checkUrl = validateSafeUrl(item.url === undefined ? "" : item.url);
      if (checkUrl === null) return false;

      seenIds.add(id);
      return true;
    });
  }

  /**
   * 1. Actualiza automáticamente el año en el pie de página
   */
  function initFooterYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

  /**
   * 2. Gestiona la apertura/cierre accesible del menú móvil
   */
  function initMobileMenu() {
    const toggleBtn = document.querySelector(".menu-toggle");
    const mainNav = document.getElementById("main-nav");

    if (!toggleBtn || !mainNav) return;

    function closeMenu() {
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.setAttribute("aria-label", "Abrir menú");
      mainNav.classList.remove("is-open");
    }

    toggleBtn.addEventListener("click", function () {
      const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
      const nextState = !isExpanded;
      toggleBtn.setAttribute("aria-expanded", String(nextState));
      toggleBtn.setAttribute("aria-label", nextState ? "Cerrar menú" : "Abrir menú");
      mainNav.classList.toggle("is-open", nextState);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && mainNav.classList.contains("is-open")) {
        closeMenu();
        toggleBtn.focus();
      }
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 768) {
          closeMenu();
        }
      });
    });
  }

  /**
   * 3. Construye el HTML seguro de una tarjeta de proyecto (MAIN-001)
   * @param {Object} project
   * @returns {string}
   */
  function createProjectCardHTML(project) {
    const theme = ["red", "blue", "pink"].includes(project.theme) ? project.theme : "blue";
    const title = escapeHTML(project.title || "Proyecto KAZVORA");
    const category = escapeHTML(project.category || "General");
    const status = escapeHTML(project.status || "Demostración");
    const description = escapeHTML(project.description || "");
    const icon = escapeHTML(project.icon || "↗");

    const validatedUrl = validateSafeUrl(project.url === undefined ? "" : project.url);

    const techList = Array.isArray(project.technologies)
      ? project.technologies
          .map(function (tech) {
            return '<span class="project-tag">' + escapeHTML(tech) + "</span>";
          })
          .join("")
      : "";

    let actionHTML = '<span class="project-status-note">En preparación · Próximamente</span>';
    if (validatedUrl) {
      const isExternal = /^https?:\/\//i.test(validatedUrl);
      const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
      actionHTML =
        '<a class="text-link project-link" href="' +
        escapeHTML(validatedUrl) +
        '"' +
        targetAttr +
        '>Explorar proyecto <span aria-hidden="true">↗</span></a>';
    }

    return (
      '<article class="project-card theme-' + theme + '">' +
        '<div class="project-card-top">' +
          '<div class="project-symbol ' + theme + '-symbol" aria-hidden="true"><span>' + icon + "</span></div>" +
          '<div class="project-badges">' +
            '<span class="project-category ' + theme + '-text">' + category + "</span>" +
            '<span class="project-badge">' + status + "</span>" +
          "</div>" +
        "</div>" +
        '<h3 class="project-title">' + title + "</h3>" +
        '<p class="project-description">' + description + "</p>" +
        '<div class="project-tags">' + techList + "</div>" +
        '<div class="project-footer">' + actionHTML + "</div>" +
      "</article>"
    );
  }

  /**
   * 4. Inicializa proyectos destacados en portada y catálogo filtrable en portafolio
   */
  function initPortfolio() {
    const featuredContainer = document.getElementById("featured-projects");
    const allContainer = document.getElementById("all-projects");
    const filtersContainer = document.getElementById("project-filters");

    if (!featuredContainer && !allContainer) return;

    const projects = getValidatedProjects();

    if (featuredContainer) {
      const featuredList = projects.filter(function (item) {
        return item.featured === true;
      });

      if (featuredList.length === 0) {
        featuredContainer.innerHTML =
          '<p class="empty-state">Nuevos proyectos destacados en preparación.</p>';
      } else {
        featuredContainer.innerHTML = featuredList.map(createProjectCardHTML).join("");
      }
    }

    if (allContainer) {
      function renderFilteredProjects(selectedCategory) {
        const filtered =
          selectedCategory === "Todos"
            ? projects
            : projects.filter(function (item) {
                return item.category === selectedCategory;
              });

        if (filtered.length === 0) {
          allContainer.innerHTML =
            '<p class="empty-state">No hay proyectos registrados en esta categoría todavía.</p>';
          return;
        }

        allContainer.innerHTML = filtered.map(createProjectCardHTML).join("");
      }

      if (filtersContainer) {
        const uniqueCategories = ["Todos"];
        projects.forEach(function (item) {
          if (item.category && !uniqueCategories.includes(item.category)) {
            uniqueCategories.push(item.category);
          }
        });

        filtersContainer.innerHTML = uniqueCategories
          .map(function (cat, idx) {
            const activeClass = idx === 0 ? " active" : "";
            const ariaPressed = idx === 0 ? "true" : "false";
            return (
              '<button type="button" class="filter-btn' +
              activeClass +
              '" data-category="' +
              escapeHTML(cat) +
              '" aria-pressed="' +
              ariaPressed +
              '">' +
              escapeHTML(cat) +
              "</button>"
            );
          })
          .join("");

        filtersContainer.addEventListener("click", function (event) {
          const btn = event.target.closest(".filter-btn");
          if (!btn) return;

          const category = btn.getAttribute("data-category") || "Todos";

          filtersContainer.querySelectorAll(".filter-btn").forEach(function (el) {
            const isCurrent = el === btn;
            el.classList.toggle("active", isCurrent);
            el.setAttribute("aria-pressed", String(isCurrent));
          });

          renderFilteredProjects(category);
        });
      }

      renderFilteredProjects("Todos");
    }
  }

  /**
   * Copia texto al portapapeles devolviendo una promesa booleana
   * @param {string} text
   * @returns {Promise<boolean>}
   */
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

  /**
   * 5. Gestiona el formulario de contacto con límites de longitud y manejo realista de WhatsApp
   * (MAIN-002 y MAIN-003)
   */
  function initContactForm() {
    const form = document.getElementById("contact-form");
    const feedback = document.getElementById("form-feedback");

    if (!form || !feedback) return;

    // Desactivar validación nativa silenciosa para mostrar mensajes claros en #form-feedback
    form.setAttribute("novalidate", "novalidate");

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const nameInput = document.getElementById("name");
      const emailInput = document.getElementById("email");
      const typeInput = document.getElementById("project-type");
      const messageInput = document.getElementById("message");

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const projectType = typeInput ? typeInput.value.trim() : "Proyecto general";
      const message = messageInput ? messageInput.value.trim() : "";

      // Validaciones de presencia y límites de longitud (MAIN-002) sin borrar los datos del usuario
      if (!name) {
        feedback.textContent = "Por favor, escribe tu nombre para poder dirigirnos a ti.";
        feedback.className = "form-feedback is-error";
        if (nameInput) nameInput.focus();
        return;
      }

      if (name.length < FORM_LIMITS.NAME_MIN || name.length > FORM_LIMITS.NAME_MAX) {
        feedback.textContent =
          "El nombre debe tener entre " +
          FORM_LIMITS.NAME_MIN +
          " y " +
          FORM_LIMITS.NAME_MAX +
          " caracteres.";
        feedback.className = "form-feedback is-error";
        if (nameInput) nameInput.focus();
        return;
      }

      if (!isValidOptionalEmail(email)) {
        feedback.textContent =
          "Ingresa un correo electrónico válido (máximo " +
          FORM_LIMITS.EMAIL_MAX +
          " caracteres) o déjalo vacío.";
        feedback.className = "form-feedback is-error";
        if (emailInput) emailInput.focus();
        return;
      }

      if (projectType.length > FORM_LIMITS.TYPE_MAX) {
        feedback.textContent = "El tipo de proyecto seleccionado excede la longitud permitida.";
        feedback.className = "form-feedback is-error";
        return;
      }

      if (!message) {
        feedback.textContent = "Por favor, describe brevemente qué necesitas resolver.";
        feedback.className = "form-feedback is-error";
        if (messageInput) messageInput.focus();
        return;
      }

      if (message.length < FORM_LIMITS.MESSAGE_MIN || message.length > FORM_LIMITS.MESSAGE_MAX) {
        feedback.textContent =
          "La descripción de tu idea debe tener entre " +
          FORM_LIMITS.MESSAGE_MIN +
          " y " +
          FORM_LIMITS.MESSAGE_MAX +
          " caracteres (actual: " +
          message.length +
          ").";
        feedback.className = "form-feedback is-error";
        if (messageInput) messageInput.focus();
        return;
      }

      const lines = [
        "Hola, equipo de KAZVORA Technologies.",
        "Mi nombre es " + name + ".",
        "Tipo de proyecto: " + projectType + ".",
        email ? "Correo de contacto: " + email + "." : null,
        "",
        "Detalles de mi idea:",
        message
      ].filter(function (line) {
        return line !== null;
      });

      const preparedText = lines.join("\n");
      const validPhone = validateWhatsAppPhone(KAZVORA_CONFIG.whatsappNumber);

      // MAIN-003: Si existe un número internacional válido, intentar abrir WhatsApp verificando bloqueo de popups
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
          if (popupWindow) {
            feedback.textContent =
              "Mensaje preparado. Se solicitó abrir WhatsApp en una nueva pestaña (recuerda pulsar Enviar dentro de WhatsApp para completar el envío)." +
              (copied ? " También copiamos una copia de respaldo en tu portapapeles." : "");
            feedback.className = "form-feedback is-success";
          } else {
            feedback.textContent =
              "Tu navegador bloqueó la ventana emergente de WhatsApp. " +
              (copied
                ? "Copiamos tu mensaje al portapapeles para que puedas pegarlo manualmente."
                : "Permite ventanas emergentes para este sitio o copia este texto: " + preparedText);
            feedback.className = "form-feedback is-error";
          }
        });
        return;
      }

      // Modo estándar mientras el número de WhatsApp está pendiente de configuración
      copyToClipboardSafe(preparedText).then(function (copied) {
        if (copied) {
          feedback.textContent =
            "✓ Mensaje preparado y copiado al portapapeles. El envío directo por WhatsApp aún no está activo; pega este mensaje en tu canal de contacto.";
          feedback.className = "form-feedback is-success";
        } else {
          feedback.textContent =
            "Mensaje preparado (selecciónalo y cópialo manualmente): " + preparedText;
          feedback.className = "form-feedback is-success";
        }
      });
    });
  }

  // Exponer funciones clave para auditoría y pruebas de regresión
  window.KAZVORA_MAIN_UTILS = {
    validateSafeUrl: validateSafeUrl,
    validateWhatsAppPhone: validateWhatsAppPhone,
    isValidOptionalEmail: isValidOptionalEmail,
    FORM_LIMITS: Object.assign({}, FORM_LIMITS)
  };

  document.addEventListener("DOMContentLoaded", function () {
    initFooterYear();
    initMobileMenu();
    initPortfolio();
    initContactForm();
  });
})();