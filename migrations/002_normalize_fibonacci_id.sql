-- Migration: Normalize fibonacci_series.id from UUID to BIGSERIAL
-- Goal: Keep fibonacci table aligned with senx_series and lnx_series id strategy.

BEGIN;

-- Create a replacement table with BIGSERIAL id and similar structure.
CREATE TABLE IF NOT EXISTS fibonacci_series_new (
  id BIGSERIAL PRIMARY KEY,
  n INTEGER NOT NULL,
  r INTEGER NOT NULL,
  valor BIGINT,
  error NUMERIC,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  hora TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Move current data, preserving generated order by timestamp fields.
INSERT INTO fibonacci_series_new (n, r, valor, error, fecha, hora)
SELECT
  n,
  r,
  valor,
  error,
  COALESCE(fecha, CURRENT_DATE),
  COALESCE(hora, CURRENT_TIME)
FROM fibonacci_series
ORDER BY fecha, hora, n, r;

DROP TABLE fibonacci_series;
ALTER TABLE fibonacci_series_new RENAME TO fibonacci_series;

CREATE INDEX idx_fibonacci_series_fecha_hora ON fibonacci_series(fecha DESC, hora DESC);
CREATE INDEX idx_fibonacci_series_n_r ON fibonacci_series(n, r);

COMMIT;
