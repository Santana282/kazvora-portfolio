/**
 * KAZVORA Technologies — Fuente de datos oficial y validador de esquema del portafolio v2.2
 * - Política positiva de validación de URLs (HTTP, HTTPS y rutas relativas limpias)
 * - Validación nativa de esquema (IDs únicos, campos obligatorios, categorías, URLs y booleanos)
 * - Incluye Demostración Comercial #1 (Repostería) y Demostración Comercial #2 (Agenda de Citas)
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

  function validateProjectUrl(rawUrl) {
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

      if (!title || !description) {
        console.warn("[KAZVORA] Proyecto '" + id + "' descartado: título o descripción vacíos.");
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
        "Sitio multipágina con arquitectura ligera, diseño adaptable, seguridad anti-XSS sin innerHTML, CSP estricta y filtros dinámicos.",
      technologies: ["HTML5", "CSS3", "JavaScript", "CSP"],
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
        "Demostración comercial para repostería artesanal con vitrina filtrable, armador de pedido interactivo y resumen listo para WhatsApp.",
      technologies: ["HTML5", "CSS3", "JavaScript", "WhatsApp Link"],
      icon: "▦",
      theme: "pink",
      featured: true,
      url: "demos/reposteria/index.html"
    },
    {
      id: "demo-clinica-citas",
      title: "Clínica Dental Nova — Agenda de Citas",
      category: "Web",
      status: "Demostración",
      description:
        "Demostración comercial para consultorios y servicios profesionales: selección de especialidad, fecha hábil, horarios y solicitud estructurada por WhatsApp.",
      technologies: ["HTML5", "CSS3", "JavaScript", "Diseño Claro"],
      icon: "✚",
      theme: "blue",
      featured: true,
      url: "demos/clinica-citas/index.html"
    },
    {
      id: "kazvora-catalogo-servicios",
      title: "Catálogo Institucional de Servicios KAZVORA",
      category: "Web",
      status: "Proyecto propio",
      description:
        "Presentación estructurada de nuestra oferta comercial y hoja de ruta en cinco verticales tecnológicas con total transparencia.",
      technologies: ["HTML5", "CSS3", "Diseño Responsive"],
      icon: "↗",
      theme: "blue",
      featured: false,
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

  window.KAZVORA_SCHEMA = {
    validateProjectUrl: validateProjectUrl,
    validateKazvoraProjects: validateKazvoraProjects,
    ALLOWED_CATEGORIES: ALLOWED_CATEGORIES.slice()
  };

  window.KAZVORA_PROJECTS = validateKazvoraProjects(RAW_PROJECTS_DATA);
})();