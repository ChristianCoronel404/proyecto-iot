-- Migration 003: Add usuario (user identifier) column to all series tables
-- Aligns with assignment requirement: "Un identificador de usuarios para cada cliente"

ALTER TABLE fibonacci_series ADD COLUMN IF NOT EXISTS usuario VARCHAR(100) NOT NULL DEFAULT 'anon';
ALTER TABLE senx_series      ADD COLUMN IF NOT EXISTS usuario VARCHAR(100) NOT NULL DEFAULT 'anon';
ALTER TABLE lnx_series       ADD COLUMN IF NOT EXISTS usuario VARCHAR(100) NOT NULL DEFAULT 'anon';

-- Index for filtering/grouping by user
CREATE INDEX IF NOT EXISTS idx_fibonacci_series_usuario ON fibonacci_series(usuario);
CREATE INDEX IF NOT EXISTS idx_senx_series_usuario      ON senx_series(usuario);
CREATE INDEX IF NOT EXISTS idx_lnx_series_usuario       ON lnx_series(usuario);
