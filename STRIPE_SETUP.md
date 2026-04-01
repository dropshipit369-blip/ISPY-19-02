# Stripe Subscription Integration Guide

This guide walks through the complete Stripe subscription setup for the iSpy Profit Tool.

## Overview

The subscription system includes:
- **Free Tier**: 5 live scans/month
- **Pro Tier**: $19/month, 50 live scans/month
- **Unlimited Tier**: $49/month, unlimited live scans

## Prerequisites

1. **Stripe Account**: https://dashboard.stripe.com/register
2. **Supabase Project**: Already configured
3. **Environment Variables**: Follow the `.env.example` file

## Step 1: Create Products & Prices in Stripe

1. Go to https://dashboard.stripe.com/products
2. Create two products:

### Product 1: Pro Plan
- **Name**: Pro Plan
- **Description**: 50 live scans per month
- **Pricing**:
  - Price: $19.00
  - Billing period: Monthly
  - Copy the **Price ID** (price_xxxxxxxxxxxx) to `.env` as `STRIPE_PRO_PRICE_ID`

### Product 2: Unlimited Plan
- **Name**: Unlimited Plan
- **Description**: Unlimited live scans
- **Pricing**:
  - Price: $49.00
  - Billing period: Monthly
  - Copy the **Price ID** (price_xxxxxxxxxxxx) to `.env` as `STRIPE_UNLIMITED_PRICE_ID`

## Step 2: Deploy Stripe Webhook Function

The webhook handler syncs Stripe events with your database.

```bash
# Deploy the webhook function to Supabase
supabase functions deploy stripe-webhook
```

## Step 3: Configure Webhook Endpoint

1. Get your deployed webhook URL:
   ```
   https://<project-id>.supabase.co/functions/v1/stripe-webhook
   ```

2. Go to https://dashboard.stripe.com/webhooks
3. Click "Add endpoint"
4. Paste the webhook URL
5. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click "Add endpoint"
7. Copy the **Signing Secret** (whsec_xxxxxxxxxxxx) to `.env` as `STRIPE_WEBHOOK_SECRET`

## Step 4: Set Environment Variables

Update your Supabase project with the Stripe credentials:

```bash
# For local development, update .env file:
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
STRIPE_PRO_PRICE_ID=price_xxxxxxxxxxxx
STRIPE_UNLIMITED_PRICE_ID=price_xxxxxxxxxxxx

# For Supabase (production), add these in:
# Dashboard > Project Settings > Edge Functions > Environment variables
```

## Step 5: Test Locally (Optional)

Using Stripe CLI to test webhooks locally:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login to your Stripe account
stripe login

# Forward events to your local webhook endpoint
stripe listen --forward-to localhost:3000/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
```

## Step 6: Database Tables

The following tables are created automatically by migrations:

- **user_subscriptions**: Tracks user subscription status
  - user_id
  - stripe_customer_id
  - stripe_subscription_id
  - plan_type (free, pro, unlimited)
  - status (active, inactive, canceled, past_due)
  - current_period_start
  - current_period_end

- **live_scan_usage**: Tracks monthly scan counts
  - user_id
  - scan_count
  - items_identified
  - month_year (YYYY-MM)

## How It Works

### User Flow

1. User clicks "Upgrade" on `/membership` page
2. Frontend calls `create-checkout` Supabase function
3. Function creates Stripe Checkout session
4. User redirected to Stripe payment form
5. After successful payment, Stripe sends webhook event
6. `stripe-webhook` function processes event and updates database
7. `check-subscription` function confirms subscription status
8. User gets access to premium features

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create customer + subscription record |
| `invoice.paid` | Update subscription status to active |
| `invoice.payment_failed` | Mark subscription as past_due |
| `customer.subscription.updated` | Sync subscription changes |
| `customer.subscription.deleted` | Mark subscription as canceled |

## File Structure

```
supabase/functions/
├── check-subscription/    # Check user's subscription status
├── create-checkout/       # Create Stripe checkout session
├── customer-portal/       # Create billing portal session
└── stripe-webhook/        # Handle Stripe events (NEW)
```

## Testing Checklist

- [ ] Stripe products created with correct pricing
- [ ] Webhook endpoint configured in Stripe
- [ ] Environment variables set in `.env`
- [ ] Edge functions deployed: `supabase functions deploy`
- [ ] Test checkout flow in development
- [ ] Verify subscription appears in Supabase database
- [ ] Test customer portal (manage subscription)
- [ ] Test cancellation flow
- [ ] Verify scan limits enforced based on plan

## Troubleshooting

### Webhook not receiving events
- Check webhook endpoint URL is correct
- Verify signing secret matches in `.env`
- Check Supabase function logs: `supabase functions describe stripe-webhook`

### Checkout session fails
- Verify price IDs are correct in `.env`
- Check Stripe API key is valid
- Ensure Stripe account is in test or live mode consistently

### Subscription not syncing to database
- Check webhook is receiving events in Stripe dashboard
- Verify Supabase edge function has correct permissions
- Check `user_subscriptions` table for errors

### User can't access premium features
- Verify `check-subscription` function returns correct plan_type
- Check `live_scan_usage` table tracks scans correctly
- Ensure `useSubscription` hook is being used in components

## Security Notes

- **Never** commit `.env` file with real API keys
- Use Stripe test keys for development
- Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secret
- Use `SUPABASE_SERVICE_ROLE_KEY` only in edge functions
- Rotate keys regularly in production

## Support

For issues or questions:
1. Check Stripe docs: https://stripe.com/docs
2. Check Supabase docs: https://supabase.com/docs
3. Review function logs: `supabase functions describe <function-name>`
