/**
 * KAZVORA Technologies — Controlador del Portal de Clientes v2.4 (js/portal.js)
 *
 * CONTROLES DE SEGURIDAD (OWASP ASVS / LFPDPPP):
 * - Cero usos de innerHTML (construcción 100 % nativa del DOM con textContent).
 * - Cero almacenamiento de contraseñas o tokens en localStorage (sesión mantenida en memoria).
 * - Si supabaseUrl/supabaseAnonKey no están configurados, deshabilita envíos sin simular auth.
 * - Mensajes de recuperación y login genéricos para prevenir enumeración de usuarios.
 * - Validación de contraseñas fuertes (mínimo 10 caracteres, letras y números).
 * - El botón de pago solicita una sesión de cobro al backend (/api/create-checkout);
 *   nunca envía montos modificables desde el cliente ni marca órdenes como pagadas.
 */
(function () {
  "use strict";

  const ENV =
    typeof window !== "undefined" &&
    window.KAZVORA_ENV &&
    typeof window.KAZVORA_ENV === "object"
      ? window.KAZVORA_ENV
      : {};

  const PORTAL_CONFIG = {
    supabaseUrl: typeof ENV.supabaseUrl === "string" ? ENV.supabaseUrl.trim().replace(/\/+$/, "") : "",
    supabaseAnonKey: typeof ENV.supabaseAnonKey === "string" ? ENV.supabaseAnonKey.trim() : "",
    apiBaseUrl: typeof ENV.apiBaseUrl === "string" ? ENV.apiBaseUrl.trim().replace(/\/+$/, "") : ""
  };

  // Sesión exclusivamente en memoria (protección frente a persistencia insegura en localStorage)
  let currentSession = null;

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

  function isBackendConfigured() {
    return (
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(PORTAL_CONFIG.supabaseUrl) &&
      PORTAL_CONFIG.supabaseAnonKey.length >= 20
    );
  }

  function isValidEmail(email) {
    return typeof email === "string" && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function validatePasswordStrength(password) {
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      return { ok: false, reason: "La contraseña debe tener entre 10 y 128 caracteres." };
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return { ok: false, reason: "La contraseña debe combinar al menos letras y números." };
    }
    return { ok: true, reason: "" };
  }

  function validateOptionalPhone(rawPhone) {
    if (!rawPhone) return { ok: true, normalized: null };
    if (!/^\+?[0-9\s-]+$/.test(rawPhone)) {
      return { ok: false, normalized: null };
    }
    const digits = rawPhone.replace(/[\s+-]/g, "");
    if (!/^[1-9]\d{10,14}$/.test(digits)) {
      return { ok: false, normalized: null };
    }
    return { ok: true, normalized: "+" + digits };
  }

  function formatCentsMXN(cents) {
    const amount = Number.isSafeInteger(cents) && cents >= 0 ? cents / 100 : 0;
    return "$" + amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MXN";
  }

  function setFeedback(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.className = isError ? "form-feedback is-error" : "form-feedback is-success";
  }

  function supabaseHeaders(accessToken) {
    const headers = {
      "Content-Type": "application/json",
      apikey: PORTAL_CONFIG.supabaseAnonKey
    };
    if (accessToken) {
      headers.Authorization = "Bearer " + accessToken;
    }
    return headers;
  }

  async function apiRequest(url, options) {
    const response = await fetch(url, options);
    let data = null;
    try {
      data = await response.json();
    } catch (err) {
      data = null;
    }
    return { ok: response.ok, status: response.status, data: data };
  }

  function switchTab(tabName) {
    const tabs = document.querySelectorAll("[data-portal-tab]");
    tabs.forEach(function (btn) {
      const isCurrent = btn.getAttribute("data-portal-tab") === tabName;
      btn.classList.toggle("active", isCurrent);
      btn.setAttribute("aria-selected", String(isCurrent));
    });

    const forms = {
      login: document.getElementById("portal-login-form"),
      register: document.getElementById("portal-register-form"),
      recover: document.getElementById("portal-recover-form")
    };

    Object.keys(forms).forEach(function (key) {
      if (forms[key]) {
        forms[key].hidden = key !== tabName;
      }
    });
  }

  function toggleDashboardView(isAuthenticated) {
    const authSection = document.getElementById("portal-auth-section");
    const dashboard = document.getElementById("portal-dashboard");
    if (authSection) authSection.hidden = isAuthenticated;
    if (dashboard) dashboard.hidden = !isAuthenticated;
  }

  async function requestServerCheckout(projectId) {
    const feedback = document.getElementById("portal-dashboard-feedback");
    if (!currentSession || !currentSession.access_token) return;

    if (!PORTAL_CONFIG.apiBaseUrl) {
      setFeedback(
        feedback,
        "El módulo de pagos automáticos en servidor aún no está conectado. Coordina tu orden directamente por WhatsApp oficial (+52 272 183 2762).",
        false
      );
      return;
    }

    setFeedback(feedback, "Generando enlace de pago seguro en servidor...", false);

    try {
      const res = await apiRequest(PORTAL_CONFIG.apiBaseUrl + "/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + currentSession.access_token
        },
        body: JSON.stringify({ projectId: projectId })
      });

      if (!res.ok || !res.data || typeof res.data.checkoutUrl !== "string") {
        setFeedback(
          feedback,
          "No fue posible generar la sesión de pago en este momento. Intenta de nuevo o contáctanos por WhatsApp.",
          true
        );
        return;
      }

      if (!/^https:\/\/checkout\.stripe\.com\//i.test(res.data.checkoutUrl)) {
        setFeedback(feedback, "URL de pasarela rechazada por política de seguridad.", true);
        return;
      }

      window.location.assign(res.data.checkoutUrl);
    } catch (err) {
      setFeedback(feedback, "Error de red al contactar el servidor de pagos.", true);
    }
  }

  function renderProjects(projects) {
    const container = document.getElementById("portal-projects-list");
    if (!container) return;
    clearContainer(container);

    if (!Array.isArray(projects) || projects.length === 0) {
      container.appendChild(
        createEl("p", "empty-state", "Aún no tienes proyectos asignados en tu cuenta. Solicita una cotización en Contacto para iniciar.")
      );
      return;
    }

    const statusLabels = {
      quoted: "Cotizado",
      in_progress: "En desarrollo",
      review: "En revisión",
      delivered: "Entregado",
      cancelled: "Cancelado"
    };

    projects.forEach(function (proj) {
      const card = createEl("article", "project-card");

      const top = createEl("div", "project-card-top");
      const badge = createEl("span", "project-badge", statusLabels[proj.status] || "Activo");
      top.appendChild(createEl("span", "project-category blue-text", proj.service_type || "Proyecto"));
      top.appendChild(badge);
      card.appendChild(top);

      card.appendChild(createEl("h3", "project-title", proj.title || "Proyecto KAZVORA"));
      card.appendChild(
        createEl("p", "project-description", "Importe acordado: " + formatCentsMXN(proj.total_amount_cents))
      );

      const footer = createEl("div", "project-footer");
      if (proj.status === "quoted" || proj.status === "in_progress") {
        const payBtn = createEl("button", "button button-primary", "Pagar / Transferir SPEI");
        payBtn.setAttribute("type", "button");
        payBtn.addEventListener("click", function () {
          requestServerCheckout(proj.id);
        });
        footer.appendChild(payBtn);
      } else {
        footer.appendChild(createEl("span", "project-status-note", "Estado: " + (statusLabels[proj.status] || proj.status)));
      }
      card.appendChild(footer);
      container.appendChild(card);
    });
  }

  function renderPayments(orders) {
    const tbody = document.getElementById("portal-payments-body");
    if (!tbody) return;
    clearContainer(tbody);

    if (!Array.isArray(orders) || orders.length === 0) {
      const tr = createEl("tr");
      const td = createEl("td", "", "No hay órdenes de pago registradas todavía.");
      td.setAttribute("colspan", "4");
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const providerLabels = {
      stripe_spei: "Transferencia SPEI (Stripe)",
      stripe_card: "Tarjeta (Stripe)",
      mercadopago: "Mercado Pago",
      manual_verified: "Transferencia verificada"
    };

    const statusMap = {
      paid: { label: "Acreditado", cls: "payment-badge payment-paid" },
      pending: { label: "Pendiente", cls: "payment-badge payment-pending" },
      expired: { label: "Expirado", cls: "payment-badge payment-other" },
      failed: { label: "Fallido", cls: "payment-badge payment-other" },
      refunded: { label: "Reembolsado", cls: "payment-badge payment-other" }
    };

    orders.forEach(function (ord) {
      const tr = createEl("tr");
      const dateStr = typeof ord.created_at === "string" ? ord.created_at.slice(0, 10) : "—";
      tr.appendChild(createEl("td", "", dateStr));
      tr.appendChild(createEl("td", "", providerLabels[ord.provider] || ord.provider || "—"));
      tr.appendChild(createEl("td", "", formatCentsMXN(ord.amount_cents)));

      const tdStatus = createEl("td");
      const st = statusMap[ord.status] || { label: ord.status || "Pendiente", cls: "payment-badge payment-pending" };
      tdStatus.appendChild(createEl("span", st.cls, st.label));
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });
  }

  async function loadClientDashboard() {
    if (!currentSession || !currentSession.access_token || !currentSession.user) return;
    const feedback = document.getElementById("portal-dashboard-feedback");
    const nameEl = document.getElementById("portal-user-name");
    const emailEl = document.getElementById("portal-user-email");

    if (emailEl) emailEl.textContent = currentSession.user.email || "";

    try {
      const headers = supabaseHeaders(currentSession.access_token);
      const [profRes, projRes, payRes] = await Promise.all([
        apiRequest(PORTAL_CONFIG.supabaseUrl + "/rest/v1/profiles?select=full_name,business_name&limit=1", { headers: headers }),
        apiRequest(PORTAL_CONFIG.supabaseUrl + "/rest/v1/client_projects?select=id,title,service_type,status,total_amount_cents&order=created_at.desc", { headers: headers }),
        apiRequest(PORTAL_CONFIG.supabaseUrl + "/rest/v1/payment_orders?select=id,provider,amount_cents,status,created_at&order=created_at.desc", { headers: headers })
      ]);

      if (profRes.ok && Array.isArray(profRes.data) && profRes.data[0] && nameEl) {
        const p = profRes.data[0];
        nameEl.textContent = p.full_name + (p.business_name ? " · " + p.business_name : "");
      }

      renderProjects(projRes.ok ? projRes.data : []);
      renderPayments(payRes.ok ? payRes.data : []);
      setFeedback(feedback, "", false);
    } catch (err) {
      setFeedback(feedback, "No fue posible cargar tus datos del servidor. Intenta actualizar.", true);
    }
  }

  function disableAuthFormsWhenUnconfigured() {
    const notice = document.getElementById("portal-backend-notice");
    if (notice) notice.hidden = false;

    const submitButtons = document.querySelectorAll("#portal-auth-section button[type='submit']");
    submitButtons.forEach(function (btn) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    });
  }

  window.KAZVORA_PORTAL_UTILS = {
    isBackendConfigured: isBackendConfigured,
    isValidEmail: isValidEmail,
    validatePasswordStrength: validatePasswordStrength,
    validateOptionalPhone: validateOptionalPhone,
    formatCentsMXN: formatCentsMXN
  };

  document.addEventListener("DOMContentLoaded", function () {
    const authSection = document.getElementById("portal-auth-section");
    if (!authSection) return;

    document.querySelectorAll("[data-portal-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-portal-tab") || "login");
      });
    });

    const configured = isBackendConfigured();
    if (!configured) {
      disableAuthFormsWhenUnconfigured();
    }

    const loginForm = document.getElementById("portal-login-form");
    const loginFeedback = document.getElementById("login-feedback");
    if (loginForm) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!isBackendConfigured()) {
          setFeedback(loginFeedback, "El servidor de autenticación aún está en configuración.", true);
          return;
        }

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        if (!isValidEmail(email) || password.length < 10) {
          setFeedback(loginFeedback, "Credenciales inválidas. Verifica tu correo y contraseña.", true);
          return;
        }

        setFeedback(loginFeedback, "Verificando credenciales...", false);
        try {
          const res = await apiRequest(PORTAL_CONFIG.supabaseUrl + "/auth/v1/token?grant_type=password", {
            method: "POST",
            headers: supabaseHeaders(),
            body: JSON.stringify({ email: email, password: password })
          });

          if (!res.ok || !res.data || !res.data.access_token) {
            setFeedback(loginFeedback, "No fue posible iniciar sesión. Verifica tus datos o confirma tu correo.", true);
            return;
          }

          currentSession = res.data;
          loginForm.reset();
          toggleDashboardView(true);
          await loadClientDashboard();
        } catch (err) {
          setFeedback(loginFeedback, "Error de conexión con el servicio de autenticación.", true);
        }
      });
    }

    const regForm = document.getElementById("portal-register-form");
    const regFeedback = document.getElementById("register-feedback");
    if (regForm) {
      regForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!isBackendConfigured()) {
          setFeedback(regFeedback, "El servidor de registro aún está en configuración.", true);
          return;
        }

        const fullName = document.getElementById("reg-name").value.trim();
        const businessName = document.getElementById("reg-business").value.trim();
        const rawPhone = document.getElementById("reg-phone").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const acceptedPrivacy = document.getElementById("reg-privacy").checked;

        if (fullName.length < 2 || fullName.length > 100) {
          setFeedback(regFeedback, "Ingresa tu nombre completo (entre 2 y 100 caracteres).", true);
          return;
        }
        if (!isValidEmail(email)) {
          setFeedback(regFeedback, "Ingresa un correo electrónico válido.", true);
          return;
        }
        const passCheck = validatePasswordStrength(password);
        if (!passCheck.ok) {
          setFeedback(regFeedback, passCheck.reason, true);
          return;
        }
        const phoneCheck = validateOptionalPhone(rawPhone);
        if (!phoneCheck.ok) {
          setFeedback(regFeedback, "El teléfono debe incluir lada internacional (ej. +52 272 183 2762) o quedar vacío.", true);
          return;
        }
        if (!acceptedPrivacy) {
          setFeedback(regFeedback, "Debes aceptar el Aviso de Privacidad para crear tu cuenta.", true);
          return;
        }

        setFeedback(regFeedback, "Creando cuenta de forma segura...", false);
        try {
          const res = await apiRequest(PORTAL_CONFIG.supabaseUrl + "/auth/v1/signup", {
            method: "POST",
            headers: supabaseHeaders(),
            body: JSON.stringify({
              email: email,
              password: password,
              data: {
                full_name: fullName,
                business_name: businessName || null,
                phone_e164: phoneCheck.normalized
              }
            })
          });

          if (!res.ok) {
            setFeedback(regFeedback, "No fue posible completar el registro. Verifica tus datos o intenta recuperar tu acceso.", true);
            return;
          }

          if (res.data && res.data.access_token && res.data.user && res.data.user.id) {
            await apiRequest(PORTAL_CONFIG.supabaseUrl + "/rest/v1/profiles", {
              method: "POST",
              headers: supabaseHeaders(res.data.access_token),
              body: JSON.stringify({
                id: res.data.user.id,
                full_name: fullName,
                business_name: businessName || null,
                phone_e164: phoneCheck.normalized,
                role: "client"
              })
            });
          }

          regForm.reset();
          setFeedback(
            regFeedback,
            "✓ Solicitud registrada. Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.",
            false
          );
        } catch (err) {
          setFeedback(regFeedback, "Error de conexión al intentar registrar la cuenta.", true);
        }
      });
    }

    const recoverForm = document.getElementById("portal-recover-form");
    const recoverFeedback = document.getElementById("recover-feedback");
    if (recoverForm) {
      recoverForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!isBackendConfigured()) {
          setFeedback(recoverFeedback, "El servidor de autenticación aún está en configuración.", true);
          return;
        }

        const email = document.getElementById("recover-email").value.trim();
        if (!isValidEmail(email)) {
          setFeedback(recoverFeedback, "Ingresa un correo electrónico válido.", true);
          return;
        }

        try {
          await apiRequest(PORTAL_CONFIG.supabaseUrl + "/auth/v1/recover", {
            method: "POST",
            headers: supabaseHeaders(),
            body: JSON.stringify({ email: email })
          });
        } catch (err) {
          // Silencioso para evitar enumeración de usuarios
        }

        recoverForm.reset();
        setFeedback(
          recoverFeedback,
          "Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña.",
          false
        );
      });
    }

    const refreshBtn = document.getElementById("portal-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadClientDashboard();
      });
    }

    const logoutBtn = document.getElementById("portal-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        if (currentSession && currentSession.access_token && isBackendConfigured()) {
          try {
            await fetch(PORTAL_CONFIG.supabaseUrl + "/auth/v1/logout", {
              method: "POST",
              headers: supabaseHeaders(currentSession.access_token)
            });
          } catch (err) {
            // Revocación local garantizada
          }
        }
        currentSession = null;
        toggleDashboardView(false);
      });
    }
  });
})();