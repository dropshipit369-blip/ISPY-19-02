CREATE TABLE IF NOT EXISTS marketplace_cache (
  query_hash TEXT PRIMARY KEY,
  search_query TEXT NOT NULL,
  results_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_marketplace_cache_expires ON marketplace_cache(expires_at);
