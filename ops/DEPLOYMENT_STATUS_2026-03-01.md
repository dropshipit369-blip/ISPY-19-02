# iSpy Deployment Status

Date: 2026-03-01

## Frontend

- Build status: passed
- Lint status: passed
- Vercel production URL: https://ispy-profit-tool-master.vercel.app
- Latest production deployment URL: https://ispy-profit-tool-master-iu1zpg27s-kays-projects-44c6315e.vercel.app
- Vercel inspect URL: https://vercel.com/kays-projects-44c6315e/ispy-profit-tool-master/6SHNF6ZKYmT2rGGwZQhabG69eMcU
- Vercel project: ispy-profit-tool-master
- Vercel production env configured:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_SUPABASE_ANON_KEY`

## Backend

- Supabase project ref: ocohbiwrrdkoeevipbmx
- Database migrations applied:
  - `20260223000000_create_scrape_jobs.sql`
  - `20260228120000_add_market_report_verification_fields.sql`
- Edge functions deployed:
  - `analyze-item`
  - `assistant-chat`
  - `live-scan`
  - `scrape-marketplace`
  - `pricing-strategy`
  - `refine-pricing`
  - `optimize-listing`
  - `vision-plus`
- JWT/auth verification status:
  - `analyze-item` now returns normal validation errors instead of JWT failures on the live endpoint
  - `pricing-strategy` now returns normal validation errors instead of `Invalid authentication` on the live endpoint
  - `vision-plus` now returns normal validation errors instead of `Invalid authentication` on the live endpoint
- Marketplace verification status:
  - `SCRAPINGBEE_API_KEY` is configured in Supabase secrets
  - `scrape-marketplace` is verified live and now returns sold eBay comparables in production
- Current status: deployed

## Follow-up Update

- Date: 2026-02-28
- Frontend production URL: https://ispy-profit-tool-master.vercel.app
- Latest production deployment URL: https://ispy-profit-tool-master-m5cbapcq0-kays-projects-44c6315e.vercel.app
- Latest Vercel inspect URL: https://vercel.com/kays-projects-44c6315e/ispy-profit-tool-master/59NCeUjfaXhWCtkvPj5xmWpwqPqh
- New feature status:
  - `assistant-chat` is deployed and smoke-tested live
  - Floating mascot now uses the live assistant function for two-way chat, with local fallback replies if the function fails
  - Mobile camera startup now retries with lighter constraints and shows direct recovery guidance for permission, HTTPS, and device issues
  - Android Capacitor project was generated in `/android` and synced from the current `dist` output
- Android release blocker:
  - This workstation does not currently expose a Java runtime or Android SDK, so an APK/AAB could not be produced locally
  - Once Java + Android SDK are installed, run `npm run android:build`, then open Android Studio with `npm run android:open`

## Git

- Push status: complete
- Remote: `https://github.com/dropshipit369-blip/ispy---profit-tool`
- Branch: `master`

## Notes

- The frontend and backend deployments completed successfully.
- Production verification confirmed the live Vercel site responds with `HTTP 200`.
- Production verification confirmed the strategy and scan endpoints no longer fail on JWT/auth for the tested flows.
- Production verification confirmed the marketplace scraper returns live sold-comparable data.
