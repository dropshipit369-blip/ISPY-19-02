ALTER TABLE public.market_reports
ADD COLUMN IF NOT EXISTS sold_comparables JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verification_status TEXT
  CHECK (verification_status IN ('verified', 'manual_required')),
ADD COLUMN IF NOT EXISTS verification_source TEXT,
ADD COLUMN IF NOT EXISTS verification_message TEXT,
ADD COLUMN IF NOT EXISTS verified_comps_count INTEGER NOT NULL DEFAULT 0
  CHECK (verified_comps_count >= 0);
