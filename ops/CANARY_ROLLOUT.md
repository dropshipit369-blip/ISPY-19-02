# Canary Rollout Plan (Vercel + Supabase)
Application Name: iSpy Profit Tool
Application ID: ispy-profit-tool

## Traffic Routing Strategy
1. **Stage 1 (Shadow Mode):** Deploy Edge Functions to a shadow environment. Mirror 10% of live traffic to new function without returning results to clients. Monitor for error spikes.
2. **Stage 2 (Canary 5%):** Route 5% of real user traffic to the new deployment.
3. **Stage 3 (Bake Period):** Hold at 5% for 1 hour. Automated KPI check: if Revenue Conversion drops > 2% or API errors spike > 1%, trigger automatic rollback.
4. **Stage 4 (Scale):** 25% -> 100%.

## KPI Baselines (Tolerance)
- Edge Function Error Rate: < 1%
- Perceived Latency (p95): < 300ms
- Scan-to-Paywall Conversion: > 8%
