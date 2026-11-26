-- ============================================================================
-- KAZVORA Technologies — Migración 001: Portal de Clientes y Pagos Verificados
-- Destino: Supabase (PostgreSQL 15+ con Auth y Row Level Security obligatorio)
--
-- SEGURIDAD POR DISEÑO:
-- 1. Las contraseñas NUNCA pasan por código frontend ni se guardan en texto plano;
--    Supabase Auth gestiona hashing seguro, sesiones, expiración y recuperación.
-- 2. Cada usuario solo puede leer y editar su propio perfil (id = auth.uid()).
-- 3. NINGÚN cliente puede marcar una orden de pago/transferencia como 'paid'
--    desde el navegador: solo el webhook de servidor (service_role) tras verificar
--    la firma criptográfica de Stripe o Mercado Pago puede actualizar el estado.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Perfiles de usuarios registrados (vinculados 1:1 a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100),
  phone_e164 TEXT CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+?[1-9][0-9]{10,14}$'),
  business_name TEXT CHECK (business_name IS NULL OR char_length(trim(business_name)) <= 120),
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  privacy_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Proyectos y cotizaciones por cliente
CREATE TABLE IF NOT EXISTS public.client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  service_type TEXT NOT NULL CHECK (service_type IN ('web', 'catalogo', 'citas', 'software', 'otro')),
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted', 'in_progress', 'review', 'delivered', 'cancelled')),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'MXN' CHECK (currency = 'MXN'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Órdenes de pago y transferencias SPEI verificadas por pasarela
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('stripe_spei', 'stripe_card', 'mercadopago', 'manual_verified')),
  provider_payment_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'MXN' CHECK (currency = 'MXN'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Registro de auditoría de eventos sensibles (solo lectura admin / escritura servidor)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_projects_client ON public.client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_client ON public.payment_orders(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_project ON public.payment_orders(project_id);

-- ============================================================================
-- ACTIVACIÓN DE ROW LEVEL SECURITY (RLS) — ZERO TRUST EN BASE DE DATOS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Función auxiliar para validar rol administrador sin recursión infinita
CREATE OR REPLACE FUNCTION public.is_kazvora_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Políticas: profiles (el usuario solo lee y actualiza su nombre/teléfono/negocio; NO puede auto-ascenderse a 'admin')
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_kazvora_admin());

CREATE POLICY "profiles_insert_own_client"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'client');

CREATE POLICY "profiles_update_own_safe"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = 'client');

-- Políticas: client_projects (el cliente solo consulta sus propios proyectos)
CREATE POLICY "projects_select_own_or_admin"
  ON public.client_projects FOR SELECT
  USING (client_id = auth.uid() OR public.is_kazvora_admin());

CREATE POLICY "projects_admin_all"
  ON public.client_projects FOR ALL
  USING (public.is_kazvora_admin())
  WITH CHECK (public.is_kazvora_admin());

-- Políticas: payment_orders (SOLO LECTURA para el cliente; la escritura/confirmación ocurre en servidor vía webhook)
CREATE POLICY "payments_select_own_or_admin"
  ON public.payment_orders FOR SELECT
  USING (client_id = auth.uid() OR public.is_kazvora_admin());

-- Políticas: security_audit_logs (solo lectura para admin; inserción únicamente desde backend con service_role)
CREATE POLICY "audit_logs_select_admin_only"
  ON public.security_audit_logs FOR SELECT
  USING (public.is_kazvora_admin());
