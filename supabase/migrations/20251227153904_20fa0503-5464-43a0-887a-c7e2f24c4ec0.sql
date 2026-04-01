-- =====================================================
-- PROFILES (User metadata)
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- =====================================================
-- ITEMS (Scanned / inventory items)
-- =====================================================
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  image_url TEXT NOT NULL,

  title TEXT,
  brand TEXT,
  model TEXT,
  category TEXT NOT NULL,
  color TEXT,

  condition TEXT NOT NULL,
  condition_score INTEGER CHECK (condition_score BETWEEN 1 AND 10),

  extracted_text TEXT,
  barcode TEXT,

  purchase_price NUMERIC(10,2) CHECK (purchase_price >= 0),
  sale_price NUMERIC(10,2) CHECK (sale_price >= 0),

  sold_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzing', 'listed', 'sold')),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    sale_price IS NULL
    OR purchase_price IS NULL
    OR sale_price >= purchase_price
  )
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own"
  ON public.items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "items_insert_own"
  ON public.items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items_update_own"
  ON public.items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "items_delete_own"
  ON public.items
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_items_user_created
  ON public.items (user_id, created_at DESC);

CREATE INDEX idx_items_status
  ON public.items (status);

CREATE INDEX idx_items_barcode
  ON public.items (barcode);

-- =====================================================
-- MARKET REPORTS (AI pricing intelligence)
-- =====================================================
CREATE TABLE public.market_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,

  low_price NUMERIC(10,2) CHECK (low_price >= 0),
  median_price NUMERIC(10,2) CHECK (median_price >= 0),
  high_price NUMERIC(10,2) CHECK (high_price >= 0),

  avg_days_to_sell INTEGER CHECK (avg_days_to_sell >= 0),

  price_trend TEXT CHECK (price_trend IN ('up', 'down', 'stable')),
  trend_percentage NUMERIC(5,2),

  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),

  best_marketplace TEXT,
  suggested_price NUMERIC(10,2) CHECK (suggested_price >= 0),

  listing_type TEXT CHECK (listing_type IN ('auction', 'fixed')),
  best_day_to_list TEXT,

  suggested_title TEXT,
  suggested_description TEXT,
  suggested_keywords TEXT[],

  shipping_recommendation TEXT,

  data_sources JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (
    low_price IS NULL
    OR median_price IS NULL
    OR high_price IS NULL
    OR (low_price <= median_price AND median_price <= high_price)
  )
);

ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_reports_select_via_item"
  ON public.market_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = market_reports.item_id
        AND items.user_id = auth.uid()
    )
  );

CREATE POLICY "market_reports_insert_via_item"
  ON public.market_reports
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.items
      WHERE items.id = market_reports.item_id
        AND items.user_id = auth.uid()
    )
  );

CREATE INDEX idx_market_reports_item
  ON public.market_reports (item_id, created_at DESC);

CREATE INDEX idx_market_reports_data_sources
  ON public.market_reports
  USING GIN (data_sources);

-- =====================================================
-- PRICE ALERTS
-- =====================================================
CREATE TABLE public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  target_price NUMERIC(10,2) NOT NULL CHECK (target_price >= 0),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),

  triggered BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_alerts_select_own"
  ON public.price_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "price_alerts_insert_own"
  ON public.price_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "price_alerts_update_own"
  ON public.price_alerts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "price_alerts_delete_own"
  ON public.price_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_price_alerts_user
  ON public.price_alerts (user_id, triggered);

-- =====================================================
-- UPDATED_AT AUTOMATION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- AUTO-PROFILE CREATION ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STORAGE: ITEM IMAGES
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "item_images_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'item-images');

CREATE POLICY "item_images_authenticated_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'item-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "item_images_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'item-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "item_images_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'item-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
