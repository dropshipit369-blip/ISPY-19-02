create table if not exists marketplace_cache (
  query_hash   text        primary key,
  results_json jsonb       not null,
  search_query text        not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

-- Only the service role (edge functions) writes to this table.
-- No RLS needed — edge functions use service role key.
-- Index for fast expiry checks on cache lookups.
create index if not exists marketplace_cache_expires_at_idx
  on marketplace_cache (expires_at);
