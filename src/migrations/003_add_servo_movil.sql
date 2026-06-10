-- ============================================================
-- Migración 003: Adaptar hcsr04_data para robot Drako
-- El robot usa 2 HC-SR04: sensor fijo (frontal) + sensor móvil
-- montado sobre un servo/pseudomotor (0-180°).
-- ============================================================

ALTER TABLE hcsr04_data
  ADD COLUMN IF NOT EXISTS distancia_movil_cm NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS angulo_servo       SMALLINT
    CHECK (angulo_servo BETWEEN 0 AND 180);

COMMENT ON COLUMN hcsr04_data.distancia_cm      IS 'Sensor fijo — siempre apunta al frente';
COMMENT ON COLUMN hcsr04_data.distancia_movil_cm IS 'Sensor móvil — montado sobre el servo';
COMMENT ON COLUMN hcsr04_data.angulo_servo       IS 'Ángulo del pseudomotor/servo en grados (0=DER, 90=FRENTE, 180=IZQ)';
COMMENT ON COLUMN hcsr04_data.distancia_izq_cm   IS 'Legado: sensor lateral izquierdo (proyecto.py con 3 sensores)';
COMMENT ON COLUMN hcsr04_data.distancia_der_cm   IS 'Legado: sensor lateral derecho (proyecto.py con 3 sensores)';

CREATE INDEX IF NOT EXISTS idx_hcsr04_angulo ON hcsr04_data (angulo_servo)
  WHERE angulo_servo IS NOT NULL;
