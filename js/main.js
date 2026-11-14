/**
 * KAZVORA Technologies — Controlador Principal (js/main.js)
 * Módulos:
 * 1. Año automático en footer (#year)
 * 2. Navegación móvil accesible (.menu-toggle + #main-nav)
 * 3. Renderizado de proyectos destacados (#featured-projects) y catálogo (#all-projects)
 * 4. Filtros dinámicos por categoría (#project-filters)
 * 5. Gestión del formulario de contacto (#contact-form + #form-feedback)
 */
(function () {
  "use strict";

  const KAZVORA_CONFIG = {
    // Coloca aquí el número con código de país (ej. "522721234567") cuando esté activo.
    // Mientras permanezca vacío "", el sistema opera en modo seguro copiando el mensaje.
    whatsappNumber: ""
  };

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

    // Cerrar al presionar Escape
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && mainNav.classList.contains("is-open")) {
        closeMenu();
        toggleBtn.focus();
      }
    });

    // Cerrar al hacer clic en un enlace dentro de vista móvil
    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 768) {
          closeMenu();
        }
      });
    });
  }

  /**
   * 3. Construye el HTML seguro de una tarjeta de proyecto
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
    const rawUrl = typeof project.url === "string" ? project.url.trim() : "";

    const techList = Array.isArray(project.technologies)
      ? project.technologies
          .map(function (tech) {
            return '<span class="project-tag">' + escapeHTML(tech) + "</span>";
          })
          .join("")
      : "";

    let actionHTML = '<span class="project-status-note">En preparación · Próximamente</span>';
    if (rawUrl && !/^javascript:/i.test(rawUrl)) {
      const isExternal = /^https?:\/\//i.test(rawUrl);
      const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
      actionHTML =
        '<a class="text-link project-link" href="' +
        escapeHTML(rawUrl) +
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

    const projects = Array.isArray(window.KAZVORA_PROJECTS) ? window.KAZVORA_PROJECTS : [];

    // Renderizar destacados en index.html
    if (featuredContainer) {
      const featuredList = projects.filter(function (item) {
        return Boolean(item && item.featured);
      });

      if (featuredList.length === 0) {
        featuredContainer.innerHTML =
          '<p class="empty-state">Nuevos proyectos destacados en preparación.</p>';
      } else {
        featuredContainer.innerHTML = featuredList.map(createProjectCardHTML).join("");
      }
    }

    // Renderizar todos los proyectos y filtros en portafolio.html
    if (allContainer) {
      function renderFilteredProjects(selectedCategory) {
        const filtered =
          selectedCategory === "Todos"
            ? projects
            : projects.filter(function (item) {
                return item && item.category === selectedCategory;
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
          if (item && item.category && !uniqueCategories.includes(item.category)) {
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
   * 5. Gestiona el formulario de contacto (preparación, copiado y WhatsApp opcional)
   */
  function initContactForm() {
    const form = document.getElementById("contact-form");
    const feedback = document.getElementById("form-feedback");

    if (!form || !feedback) return;

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

      if (!name || !message) {
        feedback.textContent = "Por favor, completa tu nombre y los detalles de tu idea.";
        feedback.className = "form-feedback is-error";
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
      const cleanPhone = KAZVORA_CONFIG.whatsappNumber.replace(/\D/g, "");

      // Si hay número comercial configurado, abre WhatsApp directamente
      if (cleanPhone.length >= 10) {
        const waUrl =
          "https://wa.me/" + cleanPhone + "?text=" + encodeURIComponent(preparedText);
        window.open(waUrl, "_blank", "noopener,noreferrer");
        feedback.textContent =
          "¡Mensaje preparado! Se abrió WhatsApp en una nueva pestaña para enviarlo.";
        feedback.className = "form-feedback is-success";
        return;
      }

      // Modo actual: copia el mensaje al portapapeles y lo deja listo
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard
          .writeText(preparedText)
          .then(function () {
            feedback.textContent =
              "✓ Mensaje preparado y copiado al portapapeles. Ya puedes pegarlo en tu canal de contacto.";
            feedback.className = "form-feedback is-success";
          })
          .catch(function () {
            feedback.textContent = "Mensaje preparado: " + preparedText;
            feedback.className = "form-feedback is-success";
          });
      } else {
        feedback.textContent = "Mensaje preparado: " + preparedText;
        feedback.className = "form-feedback is-success";
      }
    });
  }

  // Inicialización ordenada al cargar el DOM
  document.addEventListener("DOMContentLoaded", function () {
    initFooterYear();
    initMobileMenu();
    initPortfolio();
    initContactForm();
  });
})();