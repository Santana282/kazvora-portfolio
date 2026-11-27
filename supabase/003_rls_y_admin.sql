-- ============================================================================
-- KAZVORA Technologies — Script 003: Promoción de Propietario y Verificación RLS
-- Destino: Supabase SQL Editor (ejecutar DESPUÉS de que Kevin se haya registrado
--          y confirmado el correo kevinsantanaramirez282@gmail.com en portal.html)
-- ============================================================================

-- 1. Promover EXCLUSIVAMENTE la cuenta confirmada del propietario a rol 'admin'
UPDATE public.profiles p
SET role = 'admin',
    updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND lower(u.email) = 'kevinsantanaramirez282@gmail.com'
  AND u.email_confirmed_at IS NOT NULL;

-- 2. Auditoría de verificación: comprobar que las 4 tablas tienen RLS activado
--    Resultado esperado: 4 filas con rowsecurity = true
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'client_projects', 'payment_orders', 'security_audit_logs')
ORDER BY tablename;

-- 3. Auditoría de verificación: comprobar que existe exactamente 1 administrador
SELECT p.id, p.full_name, p.role, u.email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';