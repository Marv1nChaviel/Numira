-- ══════════════════════════════════════════════════════
-- NUMIRA — Schema v2 (Mejoras)
-- Ejecutar en: supabase.com/dashboard/project/bercufgdcvevdgijocgf/sql
-- ══════════════════════════════════════════════════════

-- ── Campo recurrente en transacciones ───────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT FALSE;

-- ── Presupuestos por categoría ───────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category   TEXT        NOT NULL,
  amount     DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_budgets" ON budgets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Metas de ahorro ──────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name           TEXT        NOT NULL,
  emoji          TEXT        DEFAULT '🎯',
  target_amount  DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(12,2) DEFAULT 0 NOT NULL,
  deadline       DATE,
  color          TEXT        DEFAULT '#8b5cf6',
  completed      BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_goals" ON savings_goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
