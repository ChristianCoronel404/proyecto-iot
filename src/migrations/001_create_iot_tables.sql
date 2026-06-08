-- ============================================================
-- Migración 001: Esquema base del sistema IoT (Robot Drako)
-- Ejecutar en: Supabase SQL Editor o psql con DATABASE_URL
-- ============================================================

-- ── Tabla de dispositivos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS dispositivos (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activo    BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dispositivo por defecto: el robot Drako
INSERT INTO dispositivos (id, nombre, descripcion)
VALUES (1, 'Robot Drako', 'Robot autónomo con sensores DHT22, GY-50 y HC-SR04')
ON CONFLICT (id) DO NOTHING;

-- ── Tabla de usuarios ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol           VARCHAR(20) DEFAULT 'user' CHECK (rol IN ('admin', 'user')),
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (LOWER(username));

-- ── Tabla de auditoría ────────────────────────────────────
CREATE TABLE IF NOT EXISTS auditoria (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  accion          VARCHAR(100) NOT NULL,
  tabla_afectada  VARCHAR(100),
  registro_id     INTEGER,
  descripcion     TEXT,
  fecha           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha    ON auditoria (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario  ON auditoria (usuario_id);

-- ── Sensor DHT22: temperatura y humedad ──────────────────
-- El robot usa DHT22 para monitorear temperatura de batería.
CREATE TABLE IF NOT EXISTS dht22_data (
  id            BIGSERIAL PRIMARY KEY,
  temperatura   NUMERIC(6,2)  NOT NULL,
  humedad       NUMERIC(6,2)  NOT NULL,
  dispositivo_id INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha         DATE    DEFAULT CURRENT_DATE,
  hora          TIME    DEFAULT CURRENT_TIME,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dht22_created  ON dht22_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dht22_dispositivo ON dht22_data (dispositivo_id);

-- ── Sensor GY-50: giroscopio ──────────────────────────────
-- Mide velocidad angular en 3 ejes (grados/s) y valores raw ADC.
CREATE TABLE IF NOT EXISTS gy50_data (
  id            BIGSERIAL PRIMARY KEY,
  gyro_x        NUMERIC(10,6),
  gyro_y        NUMERIC(10,6),
  gyro_z        NUMERIC(10,6),
  raw_x         INTEGER,
  raw_y         INTEGER,
  raw_z         INTEGER,
  dispositivo_id INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha         DATE    DEFAULT CURRENT_DATE,
  hora          TIME    DEFAULT CURRENT_TIME,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gy50_created     ON gy50_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gy50_dispositivo ON gy50_data (dispositivo_id);

-- ── Sensor HC-SR04: ultrasónico (3 sensores: centro, izq, der) ──
-- distancia_cm     = sensor frontal/central (obstacle detection)
-- distancia_izq_cm = sensor lateral izquierdo (wall correction)
-- distancia_der_cm = sensor lateral derecho  (wall correction)
-- tiempo_echo      = duración del pulso en µs (solo sensor central)
CREATE TABLE IF NOT EXISTS hcsr04_data (
  id               BIGSERIAL PRIMARY KEY,
  distancia_cm     NUMERIC(7,2),
  tiempo_echo      INTEGER,
  distancia_izq_cm NUMERIC(7,2),
  distancia_der_cm NUMERIC(7,2),
  dispositivo_id   INTEGER REFERENCES dispositivos(id) DEFAULT 1,
  fecha            DATE    DEFAULT CURRENT_DATE,
  hora             TIME    DEFAULT CURRENT_TIME,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hcsr04_created     ON hcsr04_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hcsr04_dispositivo ON hcsr04_data (dispositivo_id);

-- ── Permisos Supabase Row Level Security (opcional) ───────
-- Habilitar si usas autenticación de Supabase.
-- ALTER TABLE dht22_data  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE gy50_data   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hcsr04_data ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_anon_insert" ON dht22_data  FOR INSERT WITH CHECK (true);
-- CREATE POLICY "allow_anon_insert" ON gy50_data   FOR INSERT WITH CHECK (true);
-- CREATE POLICY "allow_anon_insert" ON hcsr04_data FOR INSERT WITH CHECK (true);
