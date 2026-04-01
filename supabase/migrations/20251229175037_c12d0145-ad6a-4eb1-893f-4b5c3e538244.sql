-- ============================
-- Scan Logs Table (Live Scan)
-- ============================
CREATE TABLE public.scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core item identity
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,

  -- Pricing intelligence (USD)
  low_price NUMERIC(10,2) CHECK (low_price >= 0),
  median_price NUMERIC(10,2) CHECK (median_price >= 0),
  high_price NUMERIC(10,2) CHECK (high_price >= 0),

  -- Market confidence & trend
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  trend TEXT CHECK (trend IN ('up', 'down', 'stable')),

  -- Raw AI + marketplace data
  pricing_sources JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Audit / timeline
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Data sanity
  CHECK (
    low_price IS NULL
    OR median_price IS NULL
    OR high_price IS NULL
    OR (low_price <= median_price AND median_price <= high_price)
  )
);

-- ============================
-- Row Level Security
-- ============================
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

-- Read own scans
CREATE POLICY "scan_logs_select_own"
ON public.scan_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Insert own scans
CREATE POLICY "scan_logs_insert_own"
ON public.scan_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Delete own scans
CREATE POLICY "scan_logs_delete_own"
ON public.scan_logs
FOR DELETE
USING (auth.uid() = user_id);

-- ============================
-- Performance Indexes
-- ============================

-- Primary user history lookup
CREATE INDEX idx_scan_logs_user_scanned_at
ON public.scan_logs (user_id, scanned_at DESC);

-- Category filtering (analytics / insights)
CREATE INDEX idx_scan_logs_category
ON public.scan_logs (category);

-- Trend-based queries
CREATE INDEX idx_scan_logs_trend
ON public.scan_logs (trend);

-- JSONB GIN index for marketplace lookups
CREATE INDEX idx_scan_logs_pricing_sources
ON public.scan_logs
USING GIN (pricing_sources);

-- ============================
-- Optional: Automatic cleanup
-- Uncomment if you want rolling retention
-- ============================
-- CREATE POLICY "scan_logs_update_own"
-- ON public.scan_logs
-- FOR UPDATE
-- USING (auth.uid() = user_id);
