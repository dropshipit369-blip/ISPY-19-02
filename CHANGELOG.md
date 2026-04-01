# iSpy-AI Changelog & Session Memory Log

**Application:** iSpy-AI
**Application ID:** ISPY-AI-PROD-CORE-001
**Current Version:** 2.1.0-Release
**Contact:** sysadmin@ispy-ai.com

---

## v2.1.0-Release (2026-03-07)

### Summary
This release addresses critical identification hallucinations, deploys the "Innings" Evidence-Based Pricing engine, resolves App Shell performance and camera permission issues, and aligns the landing page with launch-ready legitimacy standards.

---

### Vision & Identification (Hallucination Fix)
- **`supabase/functions/vision-plus/index.ts`** — Injected Material-First system prompt into the default detection instruction. Wood, stone, ceramic, canvas items now classify under `Art/Sculpture/Handmade/Decor` rather than biological categories. Biological entity guardrail requires >95% model confidence before assigning animal/plant labels.
- **`supabase/functions/analyze-item/index.ts`** — Hardcoded `MATERIAL_FIRST_CONSTRAINTS` into the Gemini system prompt. Eliminates zero-shot failures where texture/silhouette overrides material evidence (e.g., carved wood classified as Elephant).

### Revenue Engine: "Innings" Evidence-Based Pricing UI
- **`src/components/scanner/InningsGallery.tsx`** _(new)_ — Horizontal scroll gallery rendering the Price Spread (Floor / Target / Ceiling) from verified Completed/Sold listings. Requires minimum 5 sold comparables ("innings") for full evidence mode. Displays `thumbnail_url`, `sale_date`, `final_price` per inning.
- **`src/components/scanner/ItemDetailModal.tsx`** — Replaced the static "Recent Sales" list with the new `InningsGallery` component, mapping `pricingSources` (Completed/Sold only) to the Innings data model.

### App Shell & Performance (SES §5)
- **`src/lib/camera.ts`** — Added `isCapacitorAndroidShell()` detection for Android App Shell context. Updated `getCameraEnvironmentIssue()` to enforce HTTPS or Capacitor shell before requesting camera. Added `isCameraPermissionDenied()` async helper for upstream permission state checks.
- **`src/components/scanner/LiveScanV2.tsx`** — Power-State Polling via Battery Status API: detects discharging at ≤20% battery, drops frame rate from 30 FPS → 15 FPS, and disables Vision+ heavy-rendering. Added power-save banner UI. Added `permissionDenied` state that surfaces a "Manual Search" fallback button when camera hardware is locked.

### Scan Intent Categories (UI Adjustment Log §5)
- **`src/components/scanner/IntentSelector.tsx`** — Added `home-decor` (Home Decor: homewares, furniture, decorative pieces) and `handmade-art` (Handmade & Art: sculptures, carvings, paintings) scan intent categories to improve classification of "weird and wonderful" items.

### Landing Page Legitimacy (UI Adjustment Log §2)
- **`src/pages/Landing.tsx`** — Removed fabricated metrics (10M+ items analyzed, 98% accuracy, A$2.3B sales tracked, 50K+ resellers). Replaced with real, verifiable product capability stats (3 AI models, 4 scan modes, 2 live connectors). Updated hero subheading to accurately reference "verified sold listings on eBay and leading marketplaces". Corrected "10+ Marketplaces" feature table to "2 Live Connectors — eBay Australia & 1stDibs (Completed/Sold only)". CTA button confirmed wired to `/signup` login flow.

### Dashboard & UX (UI Adjustment Log §3)
- **`src/pages/Dashboard.tsx`** — Removed the Achievements list card from the main dashboard layout. Achievements now run as background trackers; a `toast()` pop-up notification fires when an achievement is unlocked for the first time in the session. Fixed Day Streak counter timezone bug: `getDateKey()` now uses local browser timezone instead of UTC, preventing false streak resets for Australian users scanning in evening hours (before UTC midnight).

### AI Assistant (UI Adjustment Log §4)
- **`src/components/FloatingMascot.tsx`** — Removed "Two-way help" descriptor text from the assistant card header.

### CI/CD & Quality Gate (SES §7)
- **`.github/workflows/production-gate.yml`** — Added Mock-Data Validation Gate step. Pipeline now fails with a clear error message if any source, test, or integration file in `src/`, `supabase/functions/`, `tests/`, or `e2e/` contains prohibited mock/synthetic data pattern references (e.g., `mock_data`, `synthetic_data`, `MOCK_ITEM`, `FAKE_PRICE`). Updated metadata to v2.1.0-Release.

### Post-Deploy Verification Scripts (SES §10)
- **`ops/pdv-01-vision-core.ts`** _(new)_ — Injects tokenized production wooden carving image into `analyze-item`. Asserts category is within Art/Sculpture family; asserts no biological entity labels appear.
- **`ops/pdv-02-pricing-core.ts`** _(new)_ — Queries `scrape-marketplace` for a known high-variance collectible. Asserts `stats` object contains `lowPrice` (Floor), `medianPrice` (Target), `highPrice` (Ceiling) floats. Asserts ≥5 `sold_comparables` with valid prices and timestamps.
- **`ops/pdv-03-data-integrity.ts`** _(new)_ — Scans `market_reports`, `scan_logs`, and `items` tables via Supabase REST API. Asserts zero rows match any prohibited mock/synthetic data pattern.

---

## v2.0.9 (Baseline — stable rollback target)

Previous stable release. Referenced as the rollback target in the canary runbook (`ops/CANARY_ROLLOUT.md`) if conversion drops >5% or Live Scan latency exceeds 1.5s at p99.

---

## Session Notes

- **2026-03-07** — SES v2.1.0-Release implementation and UI Adjustment Log applied. Branch: `claude/ispy-ai-core-upgrades-c5H5l`.
