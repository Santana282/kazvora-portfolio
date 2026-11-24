/**
 * KAZVORA Technologies — Controlador Principal Seguro v2.1 (js/main.js)
 * - Construcción 100 % nativa del DOM (sin innerHTML: mitigación estructural contra XSS)
 * - Validación positiva de URLs (HTTP, HTTPS y rutas relativas limpias)
 * - Menú móvil accesible con tecla Escape y sincronización aria-expanded
 * - Portafolio destacado y filtrable con validación defensiva de esquema
 * - Formulario de contacto con límites de longitud, honeypot, cooldown y respaldo de portapapeles
 */
(function () {
  "use strict";

  const ENV =
    typeof window !== "undefined" &&
    window.KAZVORA_ENV &&
    typeof window.KAZVORA_ENV === "object"
      ? window.KAZVORA_ENV
      : {};

  const KAZVORA_CONFIG = {
    // Se conserva vacío "" hasta que se autorice el número comercial oficial (formato E.164).
    whatsappNumber: typeof ENV.whatsappNumber === "string" ? ENV.whatsappNumber : "",
    contactCooldownMs:
      typeof ENV.contactCooldownMs === "number" && ENV.contactCooldownMs >= 0
        ? ENV.contactCooldownMs
        : 2500
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
  const ALLOWED_THEMES = ["red", "blue", "pink"];

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

  function isValidOptionalEmail(email) {
    if (!email) return true;
    if (email.length > FORM_LIMITS.EMAIL_MAX) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

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

  function initFooterYear() {
    const yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

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

  function createProjectCardElement(project) {
    const theme = ALLOWED_THEMES.includes(project.theme) ? project.theme : "blue";
    const article = createEl("article", "project-card theme-" + theme);

    const top = createEl("div", "project-card-top");
    const symbolBox = createEl("div", "project-symbol " + theme + "-symbol");
    symbolBox.setAttribute("aria-hidden", "true");
    symbolBox.appendChild(createEl("span", "", project.icon || "↗"));

    const badges = createEl("div", "project-badges");
    badges.appendChild(createEl("span", "project-category " + theme + "-text", project.category || "General"));
    badges.appendChild(createEl("span", "project-badge", project.status || "Demostración"));

    top.appendChild(symbolBox);
    top.appendChild(badges);
    article.appendChild(top);

    article.appendChild(createEl("h3", "project-title", project.title || "Proyecto KAZVORA"));
    article.appendChild(createEl("p", "project-description", project.description || ""));

    const tagsWrap = createEl("div", "project-tags");
    if (Array.isArray(project.technologies)) {
      project.technologies.forEach(function (tech) {
        if (typeof tech === "string" && tech.trim() !== "") {
          tagsWrap.appendChild(createEl("span", "project-tag", tech.trim()));
        }
      });
    }
    article.appendChild(tagsWrap);

    const footer = createEl("div", "project-footer");
    const validatedUrl = validateSafeUrl(project.url === undefined ? "" : project.url);

    if (validatedUrl) {
      const link = createEl("a", "text-link project-link");
      link.setAttribute("href", validatedUrl);
      if (/^https?:\/\//i.test(validatedUrl)) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      }
      link.appendChild(document.createTextNode("Explorar proyecto "));
      const arrow = createEl("span", "", "↗");
      arrow.setAttribute("aria-hidden", "true");
      link.appendChild(arrow);
      footer.appendChild(link);
    } else {
      footer.appendChild(createEl("span", "project-status-note", "En preparación · Próximamente"));
    }

    article.appendChild(footer);
    return article;
  }

  function initPortfolio() {
    const featuredContainer = document.getElementById("featured-projects");
    const allContainer = document.getElementById("all-projects");
    const filtersContainer = document.getElementById("project-filters");

    if (!featuredContainer && !allContainer) return;

    const projects = getValidatedProjects();

    if (featuredContainer) {
      clearContainer(featuredContainer);
      const featuredList = projects.filter(function (item) {
        return item.featured === true;
      });

      if (featuredList.length === 0) {
        featuredContainer.appendChild(
          createEl("p", "empty-state", "Nuevos proyectos destacados en preparación.")
        );
      } else {
        featuredList.forEach(function (item) {
          featuredContainer.appendChild(createProjectCardElement(item));
        });
      }
    }

    if (allContainer) {
      function renderFilteredProjects(selectedCategory) {
        clearContainer(allContainer);
        const filtered =
          selectedCategory === "Todos"
            ? projects
            : projects.filter(function (item) {
                return item.category === selectedCategory;
              });

        if (filtered.length === 0) {
          allContainer.appendChild(
            createEl("p", "empty-state", "No hay proyectos registrados en esta categoría todavía.")
          );
          return;
        }

        filtered.forEach(function (item) {
          allContainer.appendChild(createProjectCardElement(item));
        });
      }

      if (filtersContainer) {
        clearContainer(filtersContainer);
        const uniqueCategories = ["Todos"];
        projects.forEach(function (item) {
          if (item.category && !uniqueCategories.includes(item.category)) {
            uniqueCategories.push(item.category);
          }
        });

        uniqueCategories.forEach(function (cat, idx) {
          const btn = createEl("button", idx === 0 ? "filter-btn active" : "filter-btn", cat);
          btn.setAttribute("type", "button");
          btn.setAttribute("data-category", cat);
          btn.setAttribute("aria-pressed", idx === 0 ? "true" : "false");
          filtersContainer.appendChild(btn);
        });

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

  function initContactForm() {
    const form = document.getElementById("contact-form");
    const feedback = document.getElementById("form-feedback");

    if (!form || !feedback) return;

    form.setAttribute("novalidate", "novalidate");
    let lastValidSubmitTs = 0;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const honeypotInput = document.getElementById("website-trap");
      if (honeypotInput && typeof honeypotInput.value === "string" && honeypotInput.value.trim() !== "") {
        feedback.textContent = "No fue posible procesar la solicitud.";
        feedback.className = "form-feedback is-error";
        return;
      }

      const nameInput = document.getElementById("name");
      const emailInput = document.getElementById("email");
      const typeInput = document.getElementById("project-type");
      const messageInput = document.getElementById("message");

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const projectType = typeInput ? typeInput.value.trim() : "Proyecto general";
      const message = messageInput ? messageInput.value.trim() : "";

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

      const nowTs = Date.now();
      if (
        KAZVORA_CONFIG.contactCooldownMs > 0 &&
        lastValidSubmitTs > 0 &&
        nowTs - lastValidSubmitTs < KAZVORA_CONFIG.contactCooldownMs
      ) {
        feedback.textContent = "Espera un momento antes de volver a preparar el mensaje.";
        feedback.className = "form-feedback is-error";
        return;
      }
      lastValidSubmitTs = nowTs;

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

  window.KAZVORA_MAIN_UTILS = {
    validateSafeUrl: validateSafeUrl,
    validateWhatsAppPhone: validateWhatsAppPhone,
    isValidOptionalEmail: isValidOptionalEmail,
    createProjectCardElement: createProjectCardElement,
    FORM_LIMITS: Object.assign({}, FORM_LIMITS),
    CONFIG: KAZVORA_CONFIG
  };

  document.addEventListener("DOMContentLoaded", function () {
    initFooterYear();
    initMobileMenu();
    initPortfolio();
    initContactForm();
  });
})();