-- ==============================================================================
-- FlexBudget - Database Schema and Row Level Security (RLS)
-- Production Postgres Migration for Supabase
-- ==============================================================================

-- 1. PROFILES & USER SETTINGS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    opening_balance BIGINT NOT NULL DEFAULT 0, -- Stored as integer Rupiah
    currency TEXT NOT NULL DEFAULT 'IDR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. ENVELOPES (BUDGET CATEGORIES, ALLOCATIONS, SAVINGS, POOLS)
CREATE TABLE IF NOT EXISTS public.envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'spending_daily',
        'spending_weekly',
        'spending_monthly',
        'spending_custom',
        'savings',
        'emergency_fund',
        'funding_pool',
        'reserve'
    )),
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
    period_amount BIGINT NOT NULL DEFAULT 0 CHECK (period_amount >= 0),
    funding_source_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL,
    rollover_policy TEXT NOT NULL DEFAULT 'roll_over' CHECK (rollover_policy IN (
        'roll_over',
        'reserve_savings',
        'reserve_emergency',
        'return_to_pool',
        'manual_review'
    )),
    surplus_destination_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL,
    deficit_coverage_mode TEXT NOT NULL DEFAULT 'manual' CHECK (deficit_coverage_mode IN ('manual', 'auto')),
    deficit_priority INTEGER NOT NULL DEFAULT 0,
    min_protected_balance BIGINT NOT NULL DEFAULT 0 CHECK (min_protected_balance >= 0),
    is_archived BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. FINANCIAL TRANSACTIONS (INCOME & EXPENSES)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount BIGINT NOT NULL CHECK (amount > 0), -- Strictly positive integer IDR
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    envelope_id UUID REFERENCES public.envelopes(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TRANSFERS LEDGER (ALLOCATION, RELEASE, DEFICIT COVERAGE, SURPLUS ROUTING)
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'allocation',
        'pool_release',
        'deficit_coverage',
        'surplus_routing',
        'manual_transfer',
        'reversal'
    )),
    source_envelope_id UUID REFERENCES public.envelopes(id) ON DELETE RESTRICT,
    destination_envelope_id UUID REFERENCES public.envelopes(id) ON DELETE RESTRICT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    related_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    period_key TEXT, -- Idempotency key (e.g. 'release:2026-10-26:envelope-id')
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_envelope_movement CHECK (
        source_envelope_id IS NOT NULL OR destination_envelope_id IS NOT NULL
    )
);

-- 5. DEFICIT COVERAGE RULES (CONFIGURABLE AUTOMATIC COVERAGE ORDER)
CREATE TABLE IF NOT EXISTS public.deficit_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_envelope_id UUID NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
    source_envelope_id UUID NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
    priority_order INTEGER NOT NULL DEFAULT 0,
    max_coverage_amount BIGINT CHECK (max_coverage_amount > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_target_source UNIQUE (user_id, target_envelope_id, source_envelope_id)
);

-- 6. PERIOD CLOSE REVIEWS (AUDIT & IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.period_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    envelope_id UUID NOT NULL REFERENCES public.envelopes(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_key TEXT NOT NULL, -- e.g. '2026-10-26', '2026-W43', '2026-10'
    spent_amount BIGINT NOT NULL DEFAULT 0,
    surplus_amount BIGINT NOT NULL DEFAULT 0,
    deficit_amount BIGINT NOT NULL DEFAULT 0,
    action_taken TEXT NOT NULL,
    notes TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_period_review UNIQUE (user_id, envelope_id, period_key)
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_envelopes_user_id ON public.envelopes(user_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_type ON public.envelopes(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_envelope ON public.transactions(user_id, envelope_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user ON public.transfers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_source ON public.transfers(user_id, source_envelope_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON public.transfers(user_id, destination_envelope_id);
CREATE INDEX IF NOT EXISTS idx_transfers_period_key ON public.transfers(user_id, period_key);
CREATE INDEX IF NOT EXISTS idx_deficit_rules_target ON public.deficit_rules(user_id, target_envelope_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Mandatory: Restrict SELECT, INSERT, UPDATE, DELETE to authenticated owner only
-- ==============================================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" 
    ON public.profiles FOR DELETE 
    USING (auth.uid() = id);


-- ENVELOPES
ALTER TABLE public.envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own envelopes" 
    ON public.envelopes FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own envelopes" 
    ON public.envelopes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own envelopes" 
    ON public.envelopes FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own envelopes" 
    ON public.envelopes FOR DELETE 
    USING (auth.uid() = user_id);


-- TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" 
    ON public.transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" 
    ON public.transactions FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" 
    ON public.transactions FOR DELETE 
    USING (auth.uid() = user_id);


-- TRANSFERS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" 
    ON public.transfers FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfers" 
    ON public.transfers FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfers" 
    ON public.transfers FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfers" 
    ON public.transfers FOR DELETE 
    USING (auth.uid() = user_id);


-- DEFICIT RULES
ALTER TABLE public.deficit_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deficit rules" 
    ON public.deficit_rules FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deficit rules" 
    ON public.deficit_rules FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deficit rules" 
    ON public.deficit_rules FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deficit rules" 
    ON public.deficit_rules FOR DELETE 
    USING (auth.uid() = user_id);


-- PERIOD REVIEWS
ALTER TABLE public.period_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own period reviews" 
    ON public.period_reviews FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own period reviews" 
    ON public.period_reviews FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own period reviews" 
    ON public.period_reviews FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own period reviews" 
    ON public.period_reviews FOR DELETE 
    USING (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, opening_balance)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        0
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
