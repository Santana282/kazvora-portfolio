-- ============================================================================
-- KAZVORA Technologies — Migración 002: Creación Automática de Perfil al Registrarse
-- Destino: Supabase (ejecutar inmediatamente después de 001_portal_clientes_pagos.sql)
--
-- POR QUÉ ES OBLIGATORIA ESTA MIGRACIÓN:
-- Cuando la confirmación de correo electrónico está activa en Supabase Auth
-- (práctica obligatoria de seguridad), el endpoint /auth/v1/signup crea el
-- usuario en auth.users SIN emitir todavía un access_token de sesión.
-- Este trigger en base de datos garantiza que public.profiles se cree
-- atómicamente con role = 'client' y datos saneados, sin depender del navegador.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_business_name TEXT;
  v_phone TEXT;
BEGIN
  v_full_name := trim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  IF char_length(v_full_name) < 2 THEN
    v_full_name := 'Cliente KAZVORA';
  ELSIF char_length(v_full_name) > 100 THEN
    v_full_name := left(v_full_name, 100);
  END IF;

  v_business_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'business_name', '')), '');
  IF v_business_name IS NOT NULL AND char_length(v_business_name) > 120 THEN
    v_business_name := left(v_business_name, 120);
  END IF;

  v_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone_e164', '')), '');
  IF v_phone IS NOT NULL AND v_phone !~ '^\+?[1-9][0-9]{10,14}$' THEN
    v_phone := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, business_name, phone_e164, role)
  VALUES (NEW.id, v_full_name, v_business_name, v_phone, 'client')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();