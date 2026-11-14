/**
 * KAZVORA Technologies — Fuente de datos oficial y validador de esquema del portafolio
 * Intervención Técnica Fase 4:
 * - PROJECTS-001: Sincronización honesta del registro que dirige a servicios.html
 * - PROJECTS-002: Validación nativa de esquema (IDs únicos, campos obligatorios, categorías, URLs y booleanos)
 */
(function () {
  "use strict";

  const ALLOWED_CATEGORIES = ["Web", "Catálogo digital", "Datos y software"];
  const ALLOWED_STATUSES = [
    "Demostración",
    "Proyecto propio",
    "Académico",
    "Trabajo para cliente"
  ];
  const ALLOWED_THEMES = ["red", "blue", "pink"];

  /**
   * Valida que una URL de proyecto sea vacía, una ruta relativa segura o HTTP/HTTPS válido.
   * Rechaza javascript:, data:, vbscript:, esquemas desconocidos y URLs protocol-relative (//).
   * @param {string} rawUrl
   * @returns {string|null} URL limpia o null si es inválida/peligrosa
   */
  function validateProjectUrl(rawUrl) {
    if (typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    if (trimmed === "") return "";

    // Rechazar caracteres de control, espacios internos o caracteres que rompan atributos
    if (/[\u0000-\u001F\u007F\s"'<>`]/.test(trimmed)) {
      return null;
    }

    // Rechazar URLs protocol-relative (//dominio.com o \\dominio.com)
    if (trimmed.startsWith("//") || trimmed.startsWith("\\\\") || trimmed.includes("\\")) {
      return null;
    }

    // Comprobar si declara un esquema de protocolo (ej. http:, https:, javascript:, data:, vbscript:)
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

    // Si no tiene esquema, no debe contener ':' en ningún punto de la ruta relativa
    if (trimmed.includes(":")) {
      return null;
    }

    // Validar estructura de ruta relativa segura (sin atravesar fuera de raíz con ..al inicio si no corresponde)
    const relativePattern =
      /^(?:\.\/)?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*(?:\?[a-zA-Z0-9=&._-]+)?(?:#[a-zA-Z0-9._-]+)?$/;
    if (!relativePattern.test(trimmed) || trimmed.includes("..")) {
      return null;
    }

    return trimmed;
  }

  /**
   * Valida y filtra la colección de proyectos garantizando integridad de esquema (PROJECTS-002)
   * @param {Array} rawProjects
   * @returns {Array} Lista de proyectos válidos e inmutables
   */
  function validateKazvoraProjects(rawProjects) {
    if (!Array.isArray(rawProjects)) {
      console.warn("[KAZVORA] window.KAZVORA_PROJECTS no es un arreglo válido.");
      return [];
    }

    const seenIds = new Set();
    const validProjects = [];

    rawProjects.forEach(function (item, index) {
      if (!item || typeof item !== "object") {
        console.warn("[KAZVORA] Registro inválido en posición " + index + ": no es un objeto.");
        return;
      }

      const id = typeof item.id === "string" ? item.id.trim() : "";
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const description = typeof item.description === "string" ? item.description.trim() : "";
      const category = typeof item.category === "string" ? item.category.trim() : "";
      const status = typeof item.status === "string" ? item.status.trim() : "Demostración";
      const theme = ALLOWED_THEMES.includes(item.theme) ? item.theme : "blue";
      const icon =
        typeof item.icon === "string" && item.icon.trim() !== "" ? item.icon.trim() : "↗";

      if (!id || !/^[a-z0-9-]+$/.test(id)) {
        console.warn("[KAZVORA] Proyecto descartado en índice " + index + ": id inválido.");
        return;
      }

      if (seenIds.has(id)) {
        console.warn("[KAZVORA] Proyecto descartado: id duplicado '" + id + "'.");
        return;
      }

      if (!title) {
        console.warn("[KAZVORA] Proyecto '" + id + "' descartado: título vacío.");
        return;
      }

      if (!description) {
        console.warn("[KAZVORA] Proyecto '" + id + "' descartado: descripción vacía.");
        return;
      }

      if (!ALLOWED_CATEGORIES.includes(category)) {
        console.warn(
          "[KAZVORA] Proyecto '" + id + "' descartado: categoría no permitida '" + category + "'."
        );
        return;
      }

      if (typeof item.featured !== "boolean") {
        console.warn(
          "[KAZVORA] Proyecto '" + id + "' descartado: el campo 'featured' debe ser booleano."
        );
        return;
      }

      const validatedUrl = validateProjectUrl(item.url === undefined ? "" : item.url);
      if (validatedUrl === null) {
        console.warn(
          "[KAZVORA] Proyecto '" + id + "' descartado: URL insegura o malformada."
        );
        return;
      }

      const technologies = Array.isArray(item.technologies)
        ? item.technologies
            .filter(function (t) {
              return typeof t === "string" && t.trim() !== "";
            })
            .map(function (t) {
              return t.trim();
            })
        : [];

      seenIds.add(id);
      validProjects.push({
        id: id,
        title: title,
        category: category,
        status: ALLOWED_STATUSES.includes(status) ? status : "Demostración",
        description: description,
        technologies: technologies,
        icon: icon,
        theme: theme,
        featured: item.featured,
        url: validatedUrl
      });
    });

    return validProjects;
  }

  const RAW_PROJECTS_DATA = [
    {
      id: "kazvora-sitio-corporativo",
      title: "Plataforma Corporativa KAZVORA",
      category: "Web",
      status: "Proyecto propio",
      description:
        "Sitio multipágina con arquitectura ligera, diseño adaptable, filtros dinámicos de portafolio y generador de consultas comerciales.",
      technologies: ["HTML5", "CSS3", "JavaScript", "GitHub Pages"],
      icon: "</>",
      theme: "red",
      featured: true,
      url: "index.html"
    },
    {
      id: "demo-reposteria-catalogo",
      title: "Dulce Atelier — Catálogo y Pedidos",
      category: "Catálogo digital",
      status: "Demostración",
      description:
        "Demostración comercial para repostería y pastelería artesanal con vitrina filtrable, armador de pedido interactivo y resumen listo para WhatsApp.",
      technologies: ["HTML5", "CSS3", "JavaScript", "WhatsApp Link"],
      icon: "▦",
      theme: "pink",
      featured: true,
      url: "demos/reposteria/index.html"
    },
    {
      id: "kazvora-catalogo-servicios",
      title: "Catálogo Institucional de Servicios KAZVORA",
      category: "Web",
      status: "Proyecto propio",
      description:
        "Presentación estructurada de nuestra oferta comercial: definición clara de alcances, distinción entre servicios activos y áreas futuras, y flujo hacia contacto.",
      technologies: ["HTML5", "CSS3", "Diseño Responsive"],
      icon: "↗",
      theme: "blue",
      featured: true,
      url: "servicios.html"
    },
    {
      id: "prototipo-automatizacion-datos",
      title: "Panel de Organización Operativa",
      category: "Datos y software",
      status: "Demostración",
      description:
        "Concepto técnico en evolución para estructurar registros de ventas, control de catálogo e indicadores básicos para pequeños comercios.",
      technologies: ["JavaScript", "JSON", "Arquitectura Modular"],
      icon: "⌘",
      theme: "blue",
      featured: false,
      url: ""
    }
  ];

  // Exponer utilidades de validación y datos validados en window
  window.KAZVORA_SCHEMA = {
    validateProjectUrl: validateProjectUrl,
    validateKazvoraProjects: validateKazvoraProjects,
    ALLOWED_CATEGORIES: ALLOWED_CATEGORIES.slice()
  };

  window.KAZVORA_PROJECTS = validateKazvoraProjects(RAW_PROJECTS_DATA);
})();