-- ============================================================================
-- One-Tap eBay Listing: Database Schema (Smart Clipboard approach)
-- Tables: listing_drafts, listing_templates, listings, ebay_category_cache
-- No OAuth/API integration — uses AI generation + clipboard + deep link
-- ============================================================================

-- 1. listing_templates — Reusable listing templates
CREATE TABLE IF NOT EXISTS public.listing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ebay',
  category_id TEXT,
  category_name TEXT,
  description_template TEXT,
  default_condition_id TEXT DEFAULT '3000',
  default_shipping JSONB DEFAULT '{"domestic": {"service": "AU_StandardDelivery", "cost": 0, "free": true}, "international": null}'::jsonb,
  item_specifics_template JSONB DEFAULT '{}'::jsonb,
  default_return_policy JSONB DEFAULT '{"accepted": true, "period": "30_DAYS", "refund_method": "MONEY_BACK"}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. listing_drafts — AI-generated listing drafts
CREATE TABLE IF NOT EXISTS public.listing_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.listing_templates(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'ebay',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'copied', 'published', 'failed', 'ended')),

  -- Listing content
  title TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  category_name TEXT,
  condition_id TEXT DEFAULT '3000',
  condition_description TEXT,

  -- Pricing
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  quantity INTEGER NOT NULL DEFAULT 1,
  listing_format TEXT NOT NULL DEFAULT 'FIXED_PRICE' CHECK (listing_format IN ('FIXED_PRICE', 'AUCTION')),
  auction_start_price NUMERIC(10,2),
  auction_reserve_price NUMERIC(10,2),
  duration TEXT DEFAULT 'GTC',

  -- Photos (ordered array of URLs)
  photos JSONB DEFAULT '[]'::jsonb,

  -- Item specifics (brand, model, color, size, material, etc.)
  item_specifics JSONB DEFAULT '{}'::jsonb,

  -- Shipping
  shipping JSONB DEFAULT '{"domestic": {"service": "AU_StandardDelivery", "cost": 0, "free": true}}'::jsonb,

  -- Return policy
  return_policy JSONB DEFAULT '{"accepted": true, "period": "30_DAYS", "refund_method": "MONEY_BACK"}'::jsonb,

  -- Location
  location TEXT DEFAULT 'Australia',
  postcode TEXT,

  -- Tracking (for smart clipboard flow)
  copied_at TIMESTAMPTZ,
  ebay_sell_page_opened BOOLEAN NOT NULL DEFAULT false,

  -- AI generation metadata
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT,
  ai_generation_params JSONB,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- 3. listings — Published listings tracking (marked by user after pasting to eBay)
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  draft_id UUID REFERENCES public.listing_drafts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'ebay',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'ended', 'relisted')),

  -- Pricing
  listed_price NUMERIC(10,2),
  sold_price NUMERIC(10,2),
  fees_estimated NUMERIC(10,2),
  profit_estimated NUMERIC(10,2),
  profit_actual NUMERIC(10,2),

  -- Timestamps
  listed_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ebay_category_cache — eBay category tree cache (shared across users)
CREATE TABLE IF NOT EXISTS public.ebay_category_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ebay_category_id TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  parent_category_id TEXT,
  category_path TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  is_leaf BOOLEAN NOT NULL DEFAULT false,
  item_specifics_schema JSONB DEFAULT '{}'::jsonb,
  marketplace_id TEXT NOT NULL DEFAULT 'EBAY_AU',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- listing_templates
CREATE INDEX IF NOT EXISTS idx_listing_templates_user_id ON public.listing_templates(user_id);

-- listing_drafts
CREATE INDEX IF NOT EXISTS idx_listing_drafts_user_id ON public.listing_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_drafts_item_id ON public.listing_drafts(item_id);
CREATE INDEX IF NOT EXISTS idx_listing_drafts_status ON public.listing_drafts(status);
CREATE INDEX IF NOT EXISTS idx_listing_drafts_user_status ON public.listing_drafts(user_id, status);

-- listings
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON public.listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_item_id ON public.listings(item_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON public.listings(user_id, status);

-- ebay_category_cache
CREATE INDEX IF NOT EXISTS idx_ebay_category_cache_parent ON public.ebay_category_cache(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_ebay_category_cache_name ON public.ebay_category_cache(category_name);
CREATE INDEX IF NOT EXISTS idx_ebay_category_cache_leaf ON public.ebay_category_cache(is_leaf) WHERE is_leaf = true;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- listing_templates: users see only their own
ALTER TABLE public.listing_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own listing templates"
  ON public.listing_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listing templates"
  ON public.listing_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listing templates"
  ON public.listing_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listing templates"
  ON public.listing_templates FOR DELETE
  USING (auth.uid() = user_id);

-- listing_drafts: users see only their own
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own listing drafts"
  ON public.listing_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listing drafts"
  ON public.listing_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listing drafts"
  ON public.listing_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listing drafts"
  ON public.listing_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- listings: users see only their own
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own listings"
  ON public.listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings"
  ON public.listings FOR DELETE
  USING (auth.uid() = user_id);

-- ebay_category_cache: all authenticated users can read (shared cache)
ALTER TABLE public.ebay_category_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read category cache"
  ON public.ebay_category_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage category cache (edge functions use service role)
CREATE POLICY "Service role can manage category cache"
  ON public.ebay_category_cache FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_listing_templates_updated_at
  BEFORE UPDATE ON public.listing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_listing_drafts_updated_at
  BEFORE UPDATE ON public.listing_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- SEED: Top 50 eBay AU category mappings for common resale items
-- ============================================================================

INSERT INTO public.ebay_category_cache (ebay_category_id, category_name, category_path, level, is_leaf, marketplace_id) VALUES
  ('15687', 'Cell Phones & Smartphones', 'Cell Phones & Accessories > Cell Phones & Smartphones', 2, true, 'EBAY_AU'),
  ('171485', 'Cell Phone Cases, Covers & Skins', 'Cell Phones & Accessories > Cases, Covers & Skins', 2, true, 'EBAY_AU'),
  ('9355', 'Cameras & Photography', 'Cameras & Photography', 1, false, 'EBAY_AU'),
  ('31388', 'Digital Cameras', 'Cameras & Photography > Digital Cameras', 2, true, 'EBAY_AU'),
  ('3676', 'Computer Components & Parts', 'Computers/Tablets & Networking > Components & Parts', 2, false, 'EBAY_AU'),
  ('175673', 'Laptops & Netbooks', 'Computers/Tablets & Networking > Laptops & Netbooks', 2, true, 'EBAY_AU'),
  ('171961', 'Tablets & eBook Readers', 'Computers/Tablets & Networking > Tablets & eBook Readers', 2, true, 'EBAY_AU'),
  ('139971', 'Video Games', 'Video Games & Consoles > Video Games', 2, true, 'EBAY_AU'),
  ('139973', 'Video Game Consoles', 'Video Games & Consoles > Consoles', 2, true, 'EBAY_AU'),
  ('112529', 'Video Game Accessories', 'Video Games & Consoles > Accessories', 2, true, 'EBAY_AU'),
  ('11450', 'Clothing, Shoes & Accessories', 'Clothing, Shoes & Accessories', 1, false, 'EBAY_AU'),
  ('15724', 'Mens Clothing', 'Clothing, Shoes & Accessories > Men > Clothing', 2, true, 'EBAY_AU'),
  ('63862', 'Womens Clothing', 'Clothing, Shoes & Accessories > Women > Clothing', 2, true, 'EBAY_AU'),
  ('93427', 'Mens Shoes', 'Clothing, Shoes & Accessories > Men > Shoes', 2, true, 'EBAY_AU'),
  ('3034', 'Womens Shoes', 'Clothing, Shoes & Accessories > Women > Shoes', 2, true, 'EBAY_AU'),
  ('4251', 'Sunglasses', 'Clothing, Shoes & Accessories > Sunglasses', 2, true, 'EBAY_AU'),
  ('169291', 'Watches, Parts & Accessories', 'Jewelry & Watches > Watches, Parts & Accessories', 2, false, 'EBAY_AU'),
  ('31387', 'Wristwatches', 'Jewelry & Watches > Watches > Wristwatches', 3, true, 'EBAY_AU'),
  ('281', 'Jewelry', 'Jewelry & Watches > Jewelry', 2, false, 'EBAY_AU'),
  ('11116', 'Toys & Hobbies', 'Toys & Hobbies', 1, false, 'EBAY_AU'),
  ('220', 'Action Figures', 'Toys & Hobbies > Action Figures', 2, true, 'EBAY_AU'),
  ('2536', 'Collectibles', 'Collectibles', 1, false, 'EBAY_AU'),
  ('64482', 'Sports Trading Cards', 'Sports Memorabilia, Cards & Fan Shop > Sports Trading Cards', 2, true, 'EBAY_AU'),
  ('183050', 'Non-Sport Trading Cards', 'Collectibles > Non-Sport Trading Cards', 2, true, 'EBAY_AU'),
  ('267', 'Books, Magazines', 'Books, Magazines', 1, false, 'EBAY_AU'),
  ('261186', 'Books', 'Books, Magazines > Books', 2, true, 'EBAY_AU'),
  ('11233', 'Music', 'Music', 1, false, 'EBAY_AU'),
  ('176984', 'Vinyl Records', 'Music > Vinyl Records', 2, true, 'EBAY_AU'),
  ('176983', 'CDs', 'Music > CDs', 2, true, 'EBAY_AU'),
  ('11232', 'DVDs & Movies', 'DVDs & Movies', 1, false, 'EBAY_AU'),
  ('617', 'DVDs & Blu-ray Discs', 'DVDs & Movies > DVDs & Blu-ray Discs', 2, true, 'EBAY_AU'),
  ('293', 'Consumer Electronics', 'Consumer Electronics', 1, false, 'EBAY_AU'),
  ('112529', 'Headphones', 'Consumer Electronics > Portable Audio & Headphones > Headphones', 3, true, 'EBAY_AU'),
  ('73839', 'TV, Video & Home Audio', 'Consumer Electronics > TV, Video & Home Audio', 2, false, 'EBAY_AU'),
  ('48458', 'Speakers', 'Consumer Electronics > TV, Video & Home Audio > Home Speakers', 3, true, 'EBAY_AU'),
  ('12576', 'Sporting Goods', 'Sporting Goods', 1, false, 'EBAY_AU'),
  ('888', 'Health & Beauty', 'Health & Beauty', 1, false, 'EBAY_AU'),
  ('1249', 'Guitar', 'Musical Instruments & Gear > Guitars & Basses > Guitars', 3, true, 'EBAY_AU'),
  ('181', 'Home & Garden', 'Home & Garden', 1, false, 'EBAY_AU'),
  ('20710', 'Kitchen, Dining & Bar', 'Home & Garden > Kitchen, Dining & Bar', 2, false, 'EBAY_AU'),
  ('11700', 'Home Decor', 'Home & Garden > Home Decor', 2, false, 'EBAY_AU'),
  ('3197', 'Furniture', 'Home & Garden > Furniture', 2, false, 'EBAY_AU'),
  ('2984', 'Baby', 'Baby', 1, false, 'EBAY_AU'),
  ('1281', 'Pet Supplies', 'Pet Supplies', 1, false, 'EBAY_AU'),
  ('6000', 'Parts & Accessories', 'eBay Motors > Parts & Accessories', 2, false, 'EBAY_AU'),
  ('58058', 'Smart Watches', 'Cell Phones & Accessories > Smart Watches', 2, true, 'EBAY_AU'),
  ('171957', 'Drones', 'Cameras & Photography > Drones', 2, true, 'EBAY_AU'),
  ('179', 'LEGO', 'Toys & Hobbies > Building Toys > LEGO Building Toys', 3, true, 'EBAY_AU'),
  ('64353', 'Golf Equipment', 'Sporting Goods > Golf > Golf Clubs & Equipment', 3, true, 'EBAY_AU'),
  ('631', 'Power Tools', 'Home & Garden > Tools & Workshop Equipment > Power Tools', 3, true, 'EBAY_AU')
ON CONFLICT (ebay_category_id) DO NOTHING;
