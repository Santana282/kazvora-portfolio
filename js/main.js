(() => {
    "use strict";

    // ==========================================
    // 1. CONFIGURACIÓN Y UTILIDADES
    // ==========================================

    const projects = Array.isArray(window.KAZVORA_PROJECTS)
        ? window.KAZVORA_PROJECTS
        : [];

    const safeText = (value) => String(value ?? "");

    // Evita que los datos de los proyectos se interpreten como HTML.
    const escapeHTML = (value) => safeText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const themeClass = (theme) => ({
        red: "red-art",
        pink: "pink-art",
        green: "green-art"
    })[theme] || "red-art";

    const safeURL = (value) => {
        const url = safeText(value).trim();

        // Solo permite enlaces web convencionales.
        return /^https?:\/\//i.test(url) ? url : "";
    };

    // ==========================================
    // 2. TARJETAS DE PROYECTOS
    // ==========================================

    const projectCard = (project) => {
        const tags = (
            Array.isArray(project.technologies)
                ? project.technologies
                : []
        ).map((tag) => 
            <span>${escapeHTML(tag)}</span>
        ).join("");

        const url = safeURL(project.url);

        const link = url
            ? 
                <a
                    class="project-link"
                    href="${escapeHTML(url)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Ver proyecto
                    <span aria-hidden="true">↗</span>
                </a>
            
            : 
                <span
                    class="project-link"
                    aria-label="Demostración aún no publicada"
                >
                    Ficha en preparación
                </span>
            ;

        return 
            <article class="project-card">
                <div class="project-art ${themeClass(project.theme)}">
                    <span class="art-icon" aria-hidden="true">
                        ${escapeHTML(project.icon || "◇")}
                    </span>
                </div>

                <div class="project-body">
                    <div class="project-meta">
                        <span class="project-category">
                            ${escapeHTML(project.category)}
                        </span>

                        <span class="project-status">
                            ${escapeHTML(project.status)}
                        </span>
                    </div>

                    <h3>${escapeHTML(project.title)}</h3>

                    <p>${escapeHTML(project.description)}</p>

                    <div class="project-tags">${tags}</div>

                    ${link}
                </div>
            </article>
        ;
    };

    // ==========================================
    // 3. PROYECTOS DESTACADOS
    // ==========================================

    const featured = document.getElementById("featured-projects");

    if (featured) {
        const items = projects
            .filter((project) => project.featured)
            .slice(0, 3);

        featured.innerHTML = items.length
            ? items.map(projectCard).join("")
            : "<p>Próximamente presentaremos nuestros proyectos.</p>";
    }

    // ==========================================
    // 4. PORTAFOLIO Y FILTROS
    // ==========================================

    const all = document.getElementById("all-projects");
    const filters = document.getElementById("project-filters");

    if (all && filters) {
        const categories = [
            "Todos",
            ...new Set(
                projects
                    .map((project) => project.category)
                    .filter(Boolean)
            )
        ];

        filters.innerHTML = categories.map((category, index) => 
            `<button
                class="filter-button"
                type="button"
                data-filter="${escapeHTML(category)}"
                aria-pressed="${index === 0 ? "true" : "false"}"
            >
                ${escapeHTML(category)}
            </button>`
        ).join("");

        const render = (category) => {
            const selected = category === "Todos"
                ? projects
                : projects.filter(
                    (project) => project.category === category
                );

            all.innerHTML = selected.length
                ? selected.map(projectCard).join("")
                : "<p>No hay proyectos en esta categoría todavía.</p>";
        };

        render("Todos");

        filters.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-filter]");

            if (!button || !filters.contains(button)) {
                return;
            }

            filters.querySelectorAll("button").forEach((item) => {
                item.setAttribute(
                    "aria-pressed",
                    String(item === button)
                );
            });

            render(button.dataset.filter);
        });
    }

    // ==========================================
    // 5. MENÚ DE NAVEGACIÓN MÓVIL
    // ==========================================

    const toggle = document.querySelector(".menu-toggle");
    const nav = document.getElementById("main-nav");

    if (toggle && nav) {
        const closeMenu = () => {
            toggle.setAttribute("aria-expanded", "false");
            toggle.setAttribute("aria-label", "Abrir menú");
            nav.classList.remove("is-open");
        };

        toggle.addEventListener("click", () => {
            const isOpen =
                toggle.getAttribute("aria-expanded") === "true";

            const shouldOpen = !isOpen;

            toggle.setAttribute(
                "aria-expanded",
                String(shouldOpen)
            );

            toggle.setAttribute(
                "aria-label",
                shouldOpen ? "Cerrar menú" : "Abrir menú"
            );

            nav.classList.toggle("is-open", shouldOpen);
        });

        nav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeMenu();
            }
        });
    }

    // ==========================================
    // 6. AÑO AUTOMÁTICO DEL PIE DE PÁGINA
    // ==========================================

    const year = document.getElementById("year");

    if (year) {
        year.textContent = new Date().getFullYear();
    }

    // ==========================================
    // 7. FORMULARIO DE CONTACTO
    // ==========================================

    const form = document.getElementById("contact-form");
    const feedback = document.getElementById("form-feedback");

    if (form && feedback) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!form.reportValidity()) {
                return;
            }

            const data = new FormData(form);

            const name = safeText(data.get("name")).trim();
            const email = safeText(data.get("email")).trim();
            const projectType = safeText(
                data.get("project-type")
            ).trim();
            const details = safeText(data.get("message")).trim();

            const message = [
                "Hola, KAZVORA Technologies.",
                "",
                `Mi nombre es: ${name}`,
                email ? `Mi correo: ${email}` : "",
                `Tipo de proyecto: ${projectType}`,
                "",
                `Detalles: ${details}`
            ].filter(Boolean).join("\n");
            // Primero intenta copiar el mensaje.
            try {
                if (
                    navigator.clipboard &&
                    typeof navigator.clipboard.writeText === "function"
                ) {
                    await navigator.clipboard.writeText(message);

                    feedback.textContent =
                        "Mensaje copiado. Ya puedes pegarlo donde quieras. " +
                        "El envío directo por WhatsApp estará disponible " +
                        "cuando configuremos el número oficial.";

                    return;
                }
            } catch (error) {
                // Si el portapapeles falla, mostramos el mensaje abajo.
                console.warn(
                    "No se pudo copiar el mensaje al portapapeles.",
                    error
                );
            }

            // Alternativa: permite seleccionar y copiar manualmente.
            feedback.textContent =
                "No fue posible copiar automáticamente. " +
                "Puedes seleccionar y copiar el siguiente mensaje:\n\n" +
                message;
        });
    }
})();