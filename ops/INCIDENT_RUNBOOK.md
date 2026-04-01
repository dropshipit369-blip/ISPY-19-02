# Incident Runbook
Application Name: iSpy Profit Tool
Application ID: ispy-profit-tool

## Alert: High API Spend / Scraper Abuse
**Trigger:** Supabase Log Drain detects >100 scrape requests per minute from a single user.
**Action:** 1. Suspend the user's Supabase Auth token manually via Supabase Studio. 2. Verify API Gateway (Kong) JWT validation is enabled.

## Alert: Stripe Webhook Failures
**Trigger:** `payment_intent.succeeded` events returning 500s.
**Action:** 1. Check Edge Function logs for `stripe-webhook`. 2. Replay the failed events from the Stripe Dashboard. The webhook logic is strictly idempotent and will process missed upgrades.
