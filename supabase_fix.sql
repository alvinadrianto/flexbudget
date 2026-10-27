-- ============================================================
-- FlexBudget - Supabase Schema Migration (Fix UUID -> TEXT)
-- Jalankan di: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- 1. Hapus tabel lama yang menggunakan tipe UUID (profiles dan akun login tetap AMAN!)
DROP TABLE IF EXISTS public.deficit_rules CASCADE;
DROP TABLE IF EXISTS public.transfers CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.envelopes CASCADE;

-- 2. Buat ulang tabel dengan tipe TEXT untuk ID (mendukung custom ID seperti 'pool-daily-spending')

-- TABEL ENVELOPES
CREATE TABLE public.envelopes (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  type                    TEXT NOT NULL,
  period_type             TEXT NOT NULL DEFAULT 'monthly',
  period_amount           BIGINT NOT NULL DEFAULT 0,
  funding_source_id       TEXT,
  rollover_policy         TEXT NOT NULL DEFAULT 'roll_over',
  surplus_destination_id  TEXT,
  deficit_coverage_mode   TEXT NOT NULL DEFAULT 'manual',
  deficit_priority        INT NOT NULL DEFAULT 0,
  min_protected_balance   BIGINT NOT NULL DEFAULT 0,
  is_archived             BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order              INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL TRANSACTIONS
CREATE TABLE public.transactions (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount       BIGINT NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL,
  envelope_id  TEXT REFERENCES public.envelopes(id) ON DELETE SET NULL,
  description  TEXT NOT NULL DEFAULT '',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL TRANSFERS
CREATE TABLE public.transfers (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type                     TEXT NOT NULL,
  source_envelope_id       TEXT REFERENCES public.envelopes(id) ON DELETE SET NULL,
  destination_envelope_id  TEXT REFERENCES public.envelopes(id) ON DELETE SET NULL,
  amount                   BIGINT NOT NULL CHECK (amount > 0),
  description              TEXT NOT NULL DEFAULT '',
  related_transaction_id   TEXT REFERENCES public.transactions(id) ON DELETE SET NULL,
  period_key               TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- TABEL DEFICIT RULES
CREATE TABLE public.deficit_rules (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_envelope_id    TEXT NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
  source_envelope_id    TEXT NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
  priority_order        INT NOT NULL DEFAULT 0,
  max_coverage_amount   BIGINT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.envelopes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deficit_rules ENABLE ROW LEVEL SECURITY;

-- Drop policies lama jika ada
DROP POLICY IF EXISTS "Users can manage own envelopes"     ON public.envelopes;
DROP POLICY IF EXISTS "Users can manage own transactions"  ON public.transactions;
DROP POLICY IF EXISTS "Users can manage own transfers"     ON public.transfers;
DROP POLICY IF EXISTS "Users can manage own deficit rules" ON public.deficit_rules;

-- Buat policies baru
CREATE POLICY "Users can manage own envelopes"
  ON public.envelopes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own transfers"
  ON public.transfers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own deficit rules"
  ON public.deficit_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
