-- Migration: Create Drako IoT database schema
-- This migration creates all tables for the Drako autonomous vehicle project

-- Create usuarios table
CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  rol VARCHAR DEFAULT 'user',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dht22_data table
CREATE TABLE IF NOT EXISTS dht22_data (
  id BIGSERIAL PRIMARY KEY,
  temperatura NUMERIC NOT NULL,
  humedad NUMERIC NOT NULL,
  dispositivo_id BIGINT,
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create gy50_data table
CREATE TABLE IF NOT EXISTS gy50_data (
  id BIGSERIAL PRIMARY KEY,
  gyro_x NUMERIC NOT NULL,
  gyro_y NUMERIC NOT NULL,
  gyro_z NUMERIC NOT NULL,
  temp_raw NUMERIC,
  raw_x INTEGER,
  raw_y INTEGER,
  raw_z INTEGER,
  dispositivo_id BIGINT,
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create hcsr04_data table
CREATE TABLE IF NOT EXISTS hcsr04_data (
  id BIGSERIAL PRIMARY KEY,
  tiempo_echo INTEGER NOT NULL,
  distancia_cm NUMERIC,
  dispositivo_id BIGINT,
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create auditoria table
CREATE TABLE IF NOT EXISTS auditoria (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT,
  accion VARCHAR NOT NULL,
  tabla_afectada VARCHAR,
  registro_id BIGINT,
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dht22_data_fecha_hora ON dht22_data(fecha DESC, hora DESC);
CREATE INDEX IF NOT EXISTS idx_gy50_data_fecha_hora ON gy50_data(fecha DESC, hora DESC);
CREATE INDEX IF NOT EXISTS idx_hcsr04_data_fecha_hora ON hcsr04_data(fecha DESC, hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha DESC);