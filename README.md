# iSpy – Profit Tool (Master App)

This master app combines the strongest parts of:
- **Resale-Intel-AI** (inventory, scans, live scan, pricing overlays)
- **Snapit** (profit strategy + refine with feedback)
- **AR Vision** (Vision+ bounding boxes to improve recognition quality)

## What You Get
- **Live Scan + Vision+**: real-time detection with optional Vision+ refinement for higher-quality recognition.
- **Single Scan Vision+**: Vision+ can refine single-item scans for higher identification accuracy.
- **Single Item Analysis**: detailed AI analysis + market report.
- **Lot Scans**: multi-item analysis at once.
- **Barcode Scan**: fast product lookup.
- **Profit Strategy Assistant**: generates pricing strategy and **lets you refine it by chatting back**.
- **Lot Builder (Strategy)**: add extra items to get bundle-aware pricing recommendations.
- **Listing Optimizer**: generates optimized titles, description, and keywords.
- **Inventory + History**: save scans, track items, and review past results.

## Tech Stack
- Vite + React + TypeScript
- Supabase (auth, DB, storage, edge functions)
- Gemini (Vision+ and pricing strategy)
- Lovable AI Gateway (existing image analysis + live scan)

---

## Local Setup

### Prerequisites
- Node.js 18+
- npm

### Install & Run
```bash
npm install
npm run dev
```

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_URL=https://your_project.supabase.co
```

### Supabase Edge Functions
Set these in your Supabase project:
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Existing AI
LOVABLE_API_KEY=...

# Optional marketplace scrape
SCRAPINGBEE_API_KEY=...

# Vision+ + Profit Strategy (new)
GEMINI_API_KEY=...
```

---

## New Supabase Functions Added
- `vision-plus` – Vision+ bounding boxes for higher-quality recognition.
- `pricing-strategy` – Generates profit strategy based on analysis + market data.
- `refine-pricing` – Updates strategy based on user feedback/chat.
- `optimize-listing` – Generates optimized titles, description, and keywords.

---

## Subscription Tiers

The app includes a complete Stripe subscription system:

### Free Tier
- 5 live scans per month
- Single item analysis
- Basic market reports
- Inventory management

### Pro Tier ($19/month)
- 50 live scans per month
- Up to 30 items per scan
- Priority AI processing
- Advanced market insights

### Unlimited Tier ($49/month)
- Unlimited live scans
- Up to 30 items per scan
- Bulk export features
- Priority support

**Setup Instructions**: See [STRIPE_SETUP.md](./STRIPE_SETUP.md)

---

## Notes
- **Vision+ is on by default** in Live Scan. Toggle it on/off from the top bar.
- Live Scan requires HTTPS or localhost to access the camera.
- Stripe subscriptions are fully integrated with automatic billing and webhook handling.

---

## Next Steps
If you want, I can:
1. Add Vision+ to **single item scans** (not just Live Scan).
2. Expand pricing strategy to use **lot pricing logic** from Snapit.
3. Add **listing optimizer** (titles + keywords + description).
