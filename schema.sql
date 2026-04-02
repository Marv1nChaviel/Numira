-- ══════════════════════════════════════════════════════
-- NUMIRA — Supabase Schema
-- Ejecutar en: supabase.com/dashboard/project/bercufgdcvevdgijocgf/sql
-- ══════════════════════════════════════════════════════

-- ── Tabla de transacciones ──────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  amount      DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  description TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  date        DATE        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices para performance ────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_user_date
  ON transactions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_tx_user_type
  ON transactions (user_id, type);

-- ── Row Level Security ───────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede ver/editar SUS transacciones
CREATE POLICY "Usuarios manejan sus transacciones"
  ON transactions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Trigger: actualizar updated_at ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
