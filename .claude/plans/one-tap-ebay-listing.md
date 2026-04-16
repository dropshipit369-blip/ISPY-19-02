# One-Tap eBay Listing — Implementation Plan

## Context
Upgrade ispy-ai from CSV export to direct eBay API integration. Phase 1 focuses on eBay AU only. Users scan items, AI generates optimized listings, one tap publishes to eBay.

## Branch: `feature/one-tap-ebay-listing`

## Tasks

### Task 1: Database Migration (no deps)
- Create 5 new tables: `ebay_credentials`, `listing_drafts`, `listing_templates`, `listings`, `ebay_category_cache`
- RLS policies: user-owned rows only, category_cache read-only for all auth users
- Indexes on user_id, item_id, status, ebay_listing_id
- Seed top 50 AU eBay category mappings
- **File:** `supabase/migrations/20260416000000_ebay_listing_tables.sql`

### Task 2: TypeScript Types (depends on T1)
- Add interfaces: `EbayCredentials`, `ListingDraft`, `ListingTemplate`, `Listing`, `EbayCategoryCache`
- Add to `src/lib/types.ts`
- Update `src/integrations/supabase/types.ts` with new table definitions

### Task 3: eBay OAuth Edge Function (no deps)
- `supabase/functions/ebay-auth/index.ts`
- Handles: initiate (returns eBay consent URL), callback (exchanges code for tokens), refresh (auto-refresh expired tokens)
- Stores encrypted tokens in `ebay_credentials` table
- eBay REST API OAuth 2.0 for EBAY_AU sandbox+prod
- Env vars: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`

### Task 4: Enhanced Listing Generation Edge Function (no deps)
- `supabase/functions/generate-ebay-listing/index.ts`
- Extends existing `optimize-listing` with eBay-specific output
- Generates: title (80 char max, keyword-optimized), description (HTML), eBay category ID suggestion, item specifics, condition mapping
- Uses Gemini with structured output
- Accepts item data + market_report + optional image for vision analysis

### Task 5: eBay Publish Edge Function (depends on T1, T3)
- `supabase/functions/publish-to-ebay/index.ts`
- Calls eBay Inventory API (createOrReplaceInventoryItem + createOffer + publishOffer)
- Handles: single publish, batch publish (up to 25)
- Updates `listing_drafts` status → published, creates `listings` record
- Error handling with retry logic
- Reads user's eBay tokens from `ebay_credentials`

### Task 6: useEbayConnection Hook (depends on T3)
- `src/hooks/useEbayConnection.ts`
- Check if user has active eBay connection
- Initiate OAuth flow (opens popup/redirect)
- Handle callback, store tokens
- Disconnect flow
- Auto-refresh tokens on expiry

### Task 7: useListingDraft Hook (depends on T1, T2)
- `src/hooks/useListingDraft.ts`
- CRUD operations for listing_drafts table
- Auto-save drafts
- Generate listing content via `generate-ebay-listing` edge function
- Template application
- Batch operations (create multiple drafts from selected items)

### Task 8: ListingDraftEditor Component (depends on T6, T7)
- `src/components/listings/ListingDraftEditor.tsx`
- Full review/edit modal for a listing draft
- Editable: title, description (rich text), price, condition, category, photos, item specifics, shipping
- AI regenerate button for title/description
- Photo reorder, crop preview
- Template save/apply
- Side-by-side: edit form + live eBay preview

### Task 9: EbayPublishFlow Component (depends on T5, T8)
- `src/components/listings/EbayPublishFlow.tsx`
- One-tap publish button with confirmation
- Progress indicator for batch publishing
- Success/error states with retry
- Updates item status to "listed"

### Task 10: Listings Page Integration (depends on T6, T8, T9)
- Update `src/pages/Listings.tsx`
- Add eBay connection status banner
- Replace CSV export with "List on eBay" action
- Show listing status (draft/publishing/published/failed)
- Add batch select + batch publish
- Keep CSV export as fallback option

### Task 11: Subscription Gating (depends on T10)
- Free tier: 3 listings/month
- Pro tier: unlimited listings
- Gate listing creation in useListingDraft hook
- Show upgrade prompt when limit reached
- Track listing_count in live_scan_usage or new column

## Execution Order
1. T1 (migration) — start immediately
2. T2 (types) — after T1
3. T3, T4 in parallel — no deps
4. T5 — after T1, T3
5. T6 — after T3
6. T7 — after T1, T2
7. T8 — after T6, T7
8. T9 — after T5, T8
9. T10 — after T6, T8, T9
10. T11 — after T10
