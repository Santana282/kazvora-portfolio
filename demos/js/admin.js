/**
 * KAZVORA Technologies — Controlador de Consola Administrativa v2.5 (js/admin.js)
 *
 * SEGURIDAD ZERO TRUST:
 * - Cero usos de innerHTML y cero usos de localStorage (sesión estrictamente en memoria).
 * - Verifica el rol 'admin' directamente contra public.profiles en Supabase tras autenticar;
 *   cualquier cuenta 'client' es rechazada y su sesión se revoca.
 * - Validación estricta de UUID de cliente, importe entero (convertido a centavos) y estados permitidos.
 * - NUNCA modifica payment_orders desde el navegador (exclusivo del webhook en servidor).
 */
(function () {
  "use strict";

  const ENV =
    typeof window !== "undefined" &&
    window.KAZVORA_ENV &&
    typeof window.KAZVORA_ENV === "object"
      ? window.KAZVORA_ENV
      : {};

  const ADMIN_CONFIG = {
    supabaseUrl: typeof ENV.supabaseUrl === "string" ? ENV.supabaseUrl.trim().replace(/\/+$/, "") : "",
    supabaseAnonKey: typeof ENV.supabaseAnonKey === "string" ? ENV.supabaseAnonKey.trim() : ""
  };

  const ALLOWED_SERVICES = ["web", "catalogo", "citas", "software", "otro"];
  const ALLOWED_STATUSES = ["quoted", "in_progress", "review", "delivered", "cancelled"];
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let adminSession = null;

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
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(ADMIN_CONFIG.supabaseUrl) &&
      ADMIN_CONFIG.supabaseAnonKey.length >= 20
    );
  }

  function isValidEmail(email) {
    return typeof email === "string" && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function validateProjectInput(raw) {
    const clientId = typeof raw.clientId === "string" ? raw.clientId.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const serviceType = typeof raw.serviceType === "string" ? raw.serviceType.trim() : "";
    const amountMxn = Number(raw.amountMxn);

    if (!UUID_PATTERN.test(clientId)) {
      return { ok: false, reason: "Selecciona un cliente registrado válido." };
    }
    if (title.length < 3 || title.length > 120) {
      return { ok: false, reason: "El título debe tener entre 3 y 120 caracteres." };
    }
    if (!ALLOWED_SERVICES.includes(serviceType)) {
      return { ok: false, reason: "Tipo de servicio no permitido." };
    }
    if (!Number.isSafeInteger(amountMxn) || amountMxn < 100 || amountMxn > 500000) {
      return { ok: false, reason: "El importe debe ser un número entero entre $100 y $500,000 MXN." };
    }

    return {
      ok: true,
      payload: {
        client_id: clientId,
        title: title,
        service_type: serviceType,
        total_amount_cents: amountMxn * 100,
        currency: "MXN",
        status: "quoted"
      }
    };
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
      apikey: ADMIN_CONFIG.supabaseAnonKey
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

  function toggleAdminView(isAdmin) {
    const authSec = document.getElementById("admin-auth-section");
    const dashSec = document.getElementById("admin-dashboard");
    if (authSec) authSec.hidden = isAdmin;
    if (dashSec) dashSec.hidden = !isAdmin;
  }

  function renderClients(profiles) {
    const tbody = document.getElementById("admin-clients-body");
    const select = document.getElementById("proj-client-select");

    if (select) {
      clearContainer(select);
      const placeholder = createEl("option", "", "Selecciona un cliente...");
      placeholder.setAttribute("value", "");
      select.appendChild(placeholder);

      if (Array.isArray(profiles)) {
        profiles.forEach(function (p) {
          if (p.role === "client") {
            const label = p.full_name + (p.business_name ? " (" + p.business_name + ")" : "");
            const opt = createEl("option", "", label);
            opt.setAttribute("value", p.id);
            select.appendChild(opt);
          }
        });
      }
    }

    if (!tbody) return;
    clearContainer(tbody);

    if (!Array.isArray(profiles) || profiles.length === 0) {
      const tr = createEl("tr");
      const td = createEl("td", "", "No hay perfiles registrados todavía.");
      td.setAttribute("colspan", "3");
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    profiles.forEach(function (p) {
      const tr = createEl("tr");
      const tdName = createEl("td");
      tdName.appendChild(createEl("strong", "", p.full_name || "Sin nombre"));
      if (p.business_name) {
        tdName.appendChild(document.createTextNode(" · " + p.business_name));
      }
      tr.appendChild(tdName);
      tr.appendChild(createEl("td", "", p.phone_e164 || "—"));
      tr.appendChild(createEl("td", "", p.role || "client"));
      tbody.appendChild(tr);
    });
  }

  async function updateProjectStatus(projectId, nextStatus) {
    const feedback = document.getElementById("admin-dashboard-feedback");
    if (!adminSession || !UUID_PATTERN.test(projectId) || !ALLOWED_STATUSES.includes(nextStatus)) {
      return;
    }

    setFeedback(feedback, "Actualizando estado en PostgreSQL...", false);
    try {
      const res = await apiRequest(
        ADMIN_CONFIG.supabaseUrl + "/rest/v1/client_projects?id=eq." + encodeURIComponent(projectId),
        {
          method: "PATCH",
          headers: supabaseHeaders(adminSession.access_token),
          body: JSON.stringify({ status: nextStatus, updated_at: new Date().toISOString() })
        }
      );

      if (!res.ok) {
        setFeedback(feedback, "No se pudo actualizar el estado del proyecto.", true);
        return;
      }

      setFeedback(feedback, "✓ Estado actualizado correctamente.", false);
      await loadAdminData();
    } catch (err) {
      setFeedback(feedback, "Error de red al actualizar el proyecto.", true);
    }
  }

  function renderProjects(projects) {
    const tbody = document.getElementById("admin-projects-body");
    if (!tbody) return;
    clearContainer(tbody);

    if (!Array.isArray(projects) || projects.length === 0) {
      const tr = createEl("tr");
      const td = createEl("td", "", "Aún no existen cotizaciones registradas.");
      td.setAttribute("colspan", "5");
      tr.appendChild(td);
      tbody.appendChild(tr);
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
      const tr = createEl("tr");
      tr.appendChild(createEl("td", "", proj.title || "—"));
      tr.appendChild(createEl("td", "", proj.service_type || "—"));
      tr.appendChild(createEl("td", "", formatCentsMXN(proj.total_amount_cents)));
      tr.appendChild(createEl("td", "", statusLabels[proj.status] || proj.status));

      const tdControl = createEl("td");
      const sel = createEl("select");
      sel.setAttribute("aria-label", "Cambiar estado de " + (proj.title || "proyecto"));
      ALLOWED_STATUSES.forEach(function (st) {
        const opt = createEl("option", "", statusLabels[st]);
        opt.setAttribute("value", st);
        if (st === proj.status) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function () {
        updateProjectStatus(proj.id, sel.value);
      });
      tdControl.appendChild(sel);
      tr.appendChild(tdControl);

      tbody.appendChild(tr);
    });
  }

  function renderPayments(orders) {
    const tbody = document.getElementById("admin-payments-body");
    if (!tbody) return;
    clearContainer(tbody);

    if (!Array.isArray(orders) || orders.length === 0) {
      const tr = createEl("tr");
      const td = createEl("td", "", "Sin órdenes de pago registradas.");
      td.setAttribute("colspan", "4");
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    orders.forEach(function (ord) {
      const tr = createEl("tr");
      const dateStr = typeof ord.created_at === "string" ? ord.created_at.slice(0, 10) : "—";
      tr.appendChild(createEl("td", "", dateStr));
      tr.appendChild(createEl("td", "", ord.provider || "—"));
      tr.appendChild(createEl("td", "", formatCentsMXN(ord.amount_cents)));
      const tdSt = createEl("td");
      const badgeCls =
        ord.status === "paid"
          ? "payment-badge payment-paid"
          : ord.status === "pending"
          ? "payment-badge payment-pending"
          : "payment-badge payment-other";
      tdSt.appendChild(createEl("span", badgeCls, ord.status || "pending"));
      tr.appendChild(tdSt);
      tbody.appendChild(tr);
    });
  }

  async function loadAdminData() {
    if (!adminSession || !adminSession.access_token) return;
    const feedback = document.getElementById("admin-dashboard-feedback");

    try {
      const headers = supabaseHeaders(adminSession.access_token);
      const [cliRes, projRes, payRes] = await Promise.all([
        apiRequest(ADMIN_CONFIG.supabaseUrl + "/rest/v1/profiles?select=id,full_name,business_name,phone_e164,role&order=created_at.desc", { headers: headers }),
        apiRequest(ADMIN_CONFIG.supabaseUrl + "/rest/v1/client_projects?select=id,client_id,title,service_type,status,total_amount_cents&order=created_at.desc", { headers: headers }),
        apiRequest(ADMIN_CONFIG.supabaseUrl + "/rest/v1/payment_orders?select=id,provider,amount_cents,status,created_at&order=created_at.desc", { headers: headers })
      ]);

      renderClients(cliRes.ok ? cliRes.data : []);
      renderProjects(projRes.ok ? projRes.data : []);
      renderPayments(payRes.ok ? payRes.data : []);
    } catch (err) {
      setFeedback(feedback, "Error al sincronizar datos con Supabase.", true);
    }
  }

  window.KAZVORA_ADMIN_UTILS = {
    isBackendConfigured: isBackendConfigured,
    validateProjectInput: validateProjectInput,
    ALLOWED_SERVICES: ALLOWED_SERVICES.slice(),
    ALLOWED_STATUSES: ALLOWED_STATUSES.slice()
  };

  document.addEventListener("DOMContentLoaded", function () {
    const authSection = document.getElementById("admin-auth-section");
    if (!authSection) return;

    if (!isBackendConfigured()) {
      const notice = document.getElementById("admin-backend-notice");
      if (notice) notice.hidden = false;
      document.querySelectorAll("#admin-auth-section button[type='submit']").forEach(function (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
      });
    }

    const loginForm = document.getElementById("admin-login-form");
    const loginFeedback = document.getElementById("admin-login-feedback");
    if (loginForm) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!isBackendConfigured()) {
          setFeedback(loginFeedback, "Conecta primero Supabase en js/config.js.", true);
          return;
        }

        const email = document.getElementById("admin-email").value.trim();
        const password = document.getElementById("admin-password").value;

        if (!isValidEmail(email) || password.length < 10) {
          setFeedback(loginFeedback, "Credenciales inválidas.", true);
          return;
        }

        setFeedback(loginFeedback, "Verificando identidad y permisos en servidor...", false);
        try {
          const authRes = await apiRequest(ADMIN_CONFIG.supabaseUrl + "/auth/v1/token?grant_type=password", {
            method: "POST",
            headers: supabaseHeaders(),
            body: JSON.stringify({ email: email, password: password })
          });

          if (!authRes.ok || !authRes.data || !authRes.data.access_token || !authRes.data.user) {
            setFeedback(loginFeedback, "Acceso denegado. Verifica tus credenciales.", true);
            return;
          }

          // Verificar rol real en PostgreSQL (nunca confiar solo en estar autenticado)
          const roleRes = await apiRequest(
            ADMIN_CONFIG.supabaseUrl +
              "/rest/v1/profiles?id=eq." +
              encodeURIComponent(authRes.data.user.id) +
              "&select=full_name,role&limit=1",
            { headers: supabaseHeaders(authRes.data.access_token) }
          );

          const myProfile = roleRes.ok && Array.isArray(roleRes.data) ? roleRes.data[0] : null;
          if (!myProfile || myProfile.role !== "admin") {
            await fetch(ADMIN_CONFIG.supabaseUrl + "/auth/v1/logout", {
              method: "POST",
              headers: supabaseHeaders(authRes.data.access_token)
            }).catch(function () {});
            setFeedback(loginFeedback, "Acceso restringido: tu cuenta no tiene rol administrativo.", true);
            return;
          }

          adminSession = authRes.data;
          loginForm.reset();

          const userLabel = document.getElementById("admin-user-label");
          const userEmail = document.getElementById("admin-user-email");
          if (userLabel) userLabel.textContent = myProfile.full_name + " (Admin)";
          if (userEmail) userEmail.textContent = authRes.data.user.email || "";

          toggleAdminView(true);
          await loadAdminData();
        } catch (err) {
          setFeedback(loginFeedback, "Error de conexión con Supabase.", true);
        }
      });
    }

    const createForm = document.getElementById("admin-create-project-form");
    const projFeedback = document.getElementById("admin-project-feedback");
    if (createForm) {
      createForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!adminSession || !adminSession.access_token) return;

        const check = validateProjectInput({
          clientId: document.getElementById("proj-client-select").value,
          title: document.getElementById("proj-title").value,
          serviceType: document.getElementById("proj-service-type").value,
          amountMxn: document.getElementById("proj-amount-mxn").value
        });

        if (!check.ok) {
          setFeedback(projFeedback, check.reason, true);
          return;
        }

        setFeedback(projFeedback, "Registrando cotización en base de datos...", false);
        try {
          const res = await apiRequest(ADMIN_CONFIG.supabaseUrl + "/rest/v1/client_projects", {
            method: "POST",
            headers: Object.assign({ Prefer: "return=minimal" }, supabaseHeaders(adminSession.access_token)),
            body: JSON.stringify(check.payload)
          });

          if (!res.ok) {
            setFeedback(projFeedback, "No fue posible crear el proyecto (verifica permisos RLS).", true);
            return;
          }

          createForm.reset();
          setFeedback(projFeedback, "✓ Cotización registrada y visible en el portal del cliente.", false);
          await loadAdminData();
        } catch (err) {
          setFeedback(projFeedback, "Error de red al guardar la cotización.", true);
        }
      });
    }

    const refreshBtn = document.getElementById("admin-refresh-btn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        loadAdminData();
      });
    }

    const logoutBtn = document.getElementById("admin-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        if (adminSession && adminSession.access_token && isBackendConfigured()) {
          await fetch(ADMIN_CONFIG.supabaseUrl + "/auth/v1/logout", {
            method: "POST",
            headers: supabaseHeaders(adminSession.access_token)
          }).catch(function () {});
        }
        adminSession = null;
        toggleAdminView(false);
      });
    }
  });
})();