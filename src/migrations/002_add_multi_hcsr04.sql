-- ============================================================
-- Migración 002: Agrega columnas multi-sensor a hcsr04_data
-- Para bases de datos que ya tienen la tabla hcsr04_data.
-- Si ejecutaste 001 en una BD nueva, esta migración no es necesaria.
-- ============================================================

ALTER TABLE hcsr04_data
  ADD COLUMN IF NOT EXISTS distancia_izq_cm NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS distancia_der_cm NUMERIC(7,2);

COMMENT ON COLUMN hcsr04_data.distancia_izq_cm IS 'Sensor lateral izquierdo (pin 19)';
COMMENT ON COLUMN hcsr04_data.distancia_der_cm IS 'Sensor lateral derecho (pin 23)';
COMMENT ON COLUMN hcsr04_data.distancia_cm     IS 'Sensor frontal/central (pin 18)';
COMMENT ON COLUMN hcsr04_data.tiempo_echo      IS 'Duración pulso echo en µs (sensor central)';
