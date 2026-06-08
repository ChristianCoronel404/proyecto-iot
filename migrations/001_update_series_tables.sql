-- Migration: Update series tables from Maclaurin/Taylor to Sen(x)/Ln(x)
-- This migration:
-- 1. Drops the old maclaurin_series and taylor_series tables
-- 2. Creates new senx_series and lnx_series tables

-- Drop old tables (if they exist)
DROP TABLE IF EXISTS maclaurin_series CASCADE;
DROP TABLE IF EXISTS taylor_series CASCADE;

-- Create senx_series table for Sen(x) series
CREATE TABLE senx_series (
  id BIGSERIAL PRIMARY KEY,
  n INTEGER NOT NULL,
  r INTEGER NOT NULL,
  x NUMERIC NOT NULL,
  aproximacion NUMERIC NOT NULL,
  error NUMERIC NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for senx_series
CREATE INDEX idx_senx_series_fecha_hora ON senx_series(fecha DESC, hora DESC);
CREATE INDEX idx_senx_series_n_r ON senx_series(n, r);

-- Create lnx_series table for Ln(x) series
CREATE TABLE lnx_series (
  id BIGSERIAL PRIMARY KEY,
  n INTEGER NOT NULL,
  r INTEGER NOT NULL,
  x NUMERIC NOT NULL,
  aproximacion NUMERIC NOT NULL,
  error NUMERIC NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for lnx_series
CREATE INDEX idx_lnx_series_fecha_hora ON lnx_series(fecha DESC, hora DESC);
CREATE INDEX idx_lnx_series_n_r ON lnx_series(n, r);

-- The fibonacci_series table remains unchanged
-- If needed, you can verify it exists with:
-- SELECT * FROM information_schema.tables WHERE table_name = 'fibonacci_series';
