-- ============================================================
-- Migración 004: Tabla separada por cada componente del robot Drako
--
-- Componentes físicos del robot:
--   · 2 × HC-SR04 (ultrasónico fijo + ultrasónico móvil)
--   · 1 × GY-50 / L3G4200D (giroscopio)    ← ya existe: gy50_data
--   · 1 × Servo SG90 (pseudomotor)
--   · 2 × Motor DC amarillo (Motor A der. + Motor B izq.)
--   · 1 × DHT22 (temperatura/humedad)      ← ya existe: dht22_data
--
-- NOTA: gy50_data y dht22_data ya tienen sus tablas.
--       Esta migración agrega las 5 tablas faltantes.
-- ============================================================

-- ── HC-SR04 FIJO ─────────────────────────────────────────────
-- Siempre apunta al frente. No se mueve.
-- Pines: TRIG=Pin(16), ECHO=Pin(17)
CREATE TABLE IF NOT EXISTS hcsr04_fijo_data (
  id              BIGSERIAL PRIMARY KEY,
  distancia_cm    NUMERIC(7,2),                   -- cm medidos
  tiempo_echo_us  INTEGER,                         -- duración pulso en µs
  dispositivo_id  INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha           DATE      DEFAULT CURRENT_DATE,
  hora            TIME      DEFAULT CURRENT_TIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hcsr04_fijo_created
  ON hcsr04_fijo_data (created_at DESC);

COMMENT ON TABLE  hcsr04_fijo_data              IS 'Sensor ultrasónico frontal fijo (TRIG=16, ECHO=17)';
COMMENT ON COLUMN hcsr04_fijo_data.distancia_cm IS 'Distancia medida en centímetros';
COMMENT ON COLUMN hcsr04_fijo_data.tiempo_echo_us IS 'Tiempo de vuelo del pulso en microsegundos';

-- ── HC-SR04 MÓVIL ────────────────────────────────────────────
-- Montado sobre el servo. Su ángulo varía con el pseudomotor.
-- Pines: TRIG=Pin(18), ECHO=Pin(23)
CREATE TABLE IF NOT EXISTS hcsr04_movil_data (
  id              BIGSERIAL PRIMARY KEY,
  distancia_cm    NUMERIC(7,2),
  tiempo_echo_us  INTEGER,
  angulo_servo    SMALLINT   CHECK (angulo_servo BETWEEN 0 AND 180),
  dispositivo_id  INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha           DATE      DEFAULT CURRENT_DATE,
  hora            TIME      DEFAULT CURRENT_TIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hcsr04_movil_created
  ON hcsr04_movil_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hcsr04_movil_angulo
  ON hcsr04_movil_data (angulo_servo);

COMMENT ON TABLE  hcsr04_movil_data                IS 'Sensor ultrasónico móvil sobre servo (TRIG=18, ECHO=23)';
COMMENT ON COLUMN hcsr04_movil_data.angulo_servo   IS '0=DER, 90=FRENTE, 180=IZQ';

-- ── SERVO / PSEUDOMOTOR ──────────────────────────────────────
-- Control del ángulo del servo que mueve el HC-SR04 móvil.
-- Pin: PWM(Pin(19), freq=50Hz)
-- Fórmula duty: int(26 + (angulo / 180.0) * (128 - 26))
-- Rango duty: 26 (0°) → 128 (180°)
CREATE TABLE IF NOT EXISTS servo_data (
  id              BIGSERIAL PRIMARY KEY,
  angulo_grados   SMALLINT   NOT NULL CHECK (angulo_grados BETWEEN 0 AND 180),
  duty_ciclo      SMALLINT   CHECK (duty_ciclo BETWEEN 26 AND 128),
  dispositivo_id  INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha           DATE      DEFAULT CURRENT_DATE,
  hora            TIME      DEFAULT CURRENT_TIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servo_created
  ON servo_data (created_at DESC);

COMMENT ON TABLE  servo_data              IS 'Pseudomotor/servo SG90 (PWM pin 19, 50Hz)';
COMMENT ON COLUMN servo_data.angulo_grados IS '0=DER, 90=FRENTE, 180=IZQ';
COMMENT ON COLUMN servo_data.duty_ciclo    IS 'Valor duty PWM: 26 (0°) a 128 (180°)';

-- ── MOTOR DERECHO (Motor A) ───────────────────────────────────
-- Motor DC amarillo lado derecho del robot.
-- Pines: ENA=PWM(Pin(14), freq=1000Hz), IN1=Pin(26), IN2=Pin(27)
-- SPEED nominal = 22000 | TURN_SPEED = 45000  (duty_u16: 0–65535)
CREATE TABLE IF NOT EXISTS motor_der_data (
  id              BIGSERIAL PRIMARY KEY,
  velocidad_pwm   INTEGER    NOT NULL CHECK (velocidad_pwm BETWEEN 0 AND 65535),
  direccion       VARCHAR(10) NOT NULL CHECK (direccion IN ('adelante', 'atras', 'stop')),
  dispositivo_id  INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha           DATE      DEFAULT CURRENT_DATE,
  hora            TIME      DEFAULT CURRENT_TIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_motor_der_created
  ON motor_der_data (created_at DESC);

COMMENT ON TABLE  motor_der_data              IS 'Motor DC derecho — Motor A (ENA=pin14, IN1=26, IN2=27)';
COMMENT ON COLUMN motor_der_data.velocidad_pwm IS 'Duty cycle duty_u16 (0=parado, 65535=máximo)';
COMMENT ON COLUMN motor_der_data.direccion     IS 'adelante | atras | stop';

-- ── MOTOR IZQUIERDO (Motor B) ─────────────────────────────────
-- Motor DC amarillo lado izquierdo del robot.
-- Pines: ENB=PWM(Pin(25), freq=1000Hz), IN3=Pin(32), IN4=Pin(33)
CREATE TABLE IF NOT EXISTS motor_izq_data (
  id              BIGSERIAL PRIMARY KEY,
  velocidad_pwm   INTEGER    NOT NULL CHECK (velocidad_pwm BETWEEN 0 AND 65535),
  direccion       VARCHAR(10) NOT NULL CHECK (direccion IN ('adelante', 'atras', 'stop')),
  dispositivo_id  INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha           DATE      DEFAULT CURRENT_DATE,
  hora            TIME      DEFAULT CURRENT_TIME,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_motor_izq_created
  ON motor_izq_data (created_at DESC);

COMMENT ON TABLE  motor_izq_data              IS 'Motor DC izquierdo — Motor B (ENB=pin25, IN3=32, IN4=33)';
COMMENT ON COLUMN motor_izq_data.velocidad_pwm IS 'Duty cycle duty_u16 (0=parado, 65535=máximo)';
COMMENT ON COLUMN motor_izq_data.direccion     IS 'adelante | atras | stop';

-- ── Actualizar descripción del dispositivo ─────────────────────
UPDATE dispositivos
SET descripcion = 'Robot autónomo Drako: DHT22, GY-50, HC-SR04 fijo, HC-SR04 móvil, Servo, Motor-DER, Motor-IZQ'
WHERE id = 1;
