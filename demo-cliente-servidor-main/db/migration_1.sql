-- ============================================================================
-- MIGRACIÓN 1: Optimización de concurrencia y prevención de choques de agenda
-- ============================================================================
-- Ejecuta este comando en el SQL Editor de Supabase.
-- Como la tabla ya existe y tiene datos, usamos ALTER TABLE en lugar de 
-- borrar y recrear la tabla.

-- Agregamos una restricción única. Esto evitará que se inserten dos citas 
-- para el mismo profesional exactamente a la misma hora. También crea un 
-- índice por debajo, acelerando las consultas.
ALTER TABLE citas 
ADD CONSTRAINT cita_unica UNIQUE (profesional_id, fecha_hora);
