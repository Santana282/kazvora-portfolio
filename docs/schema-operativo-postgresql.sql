-- ============================================================================
-- KAZVORA Technologies — Esquema Base de Producción (PostgreSQL 15+ / Supabase)
-- Módulo: Panel de Organización Operativa (Multi-Tenant con Row Level Security)
-- Propósito: Plano técnico listo para migrar la Demo #3 a un cliente real.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizaciones / Comercios (aislamiento estricto multi-tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Miembros y roles (Principio de mínimo privilegio)
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- 3. Productos e Inventario (precios en centavos para evitar errores de punto flotante)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku TEXT NOT NULL CHECK (sku ~ '^[A-Z0-9-]{3,16}$'),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  category TEXT NOT NULL CHECK (char_length(trim(category)) BETWEEN 2 AND 40),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  min_stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (min_stock_qty >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sku)
);

-- 4. Bitácora inmutable de movimientos (ventas, entradas, ajustes)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment')),
  qty_delta INTEGER NOT NULL CHECK (qty_delta <> 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_movements_org_created ON inventory_movements(organization_id, created_at DESC);

-- 5. Activación obligatoria de Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Nota de despliegue:
-- Definir las políticas CREATE POLICY vinculando organization_members.user_id = auth.uid()
-- y validar con pruebas de aislamiento entre dos usuarios de distintas organizaciones
-- antes de exponer cualquier endpoint en producción.