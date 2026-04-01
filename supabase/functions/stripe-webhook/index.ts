
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const payload = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      throw new Error("Missing stripe-signature header");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
      logStep("Event verified", { type: event.type });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("checkout.session.completed", {
          sessionId: session.id,
          customerId: session.customer,
          email: session.customer_email
        });

        // Get customer ID
        let customerId = session.customer as string;
        if (!customerId && session.customer_email) {
          const customers = await stripe.customers.list({
            email: session.customer_email,
            limit: 1,
          });
          if (customers.data.length === 0) {
            throw new Error(`No customer found for email: ${session.customer_email}`);
          }
          customerId = customers.data[0].id;
        }

        // Get the subscription from the session
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 1,
        });

        if (subscriptions.data.length === 0) {
          throw new Error(`No subscription found for customer ${customerId}`);
        }

        const subscription = subscriptions.data[0];
        logStep("Subscription created", {
          subscriptionId: subscription.id,
          customerId
        });

        // Determine plan type from price
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount || 0;

        let planType = "pro";
        if (amount >= 4900) {
          planType = "unlimited";
        }

        // Get user by email
        const email = session.customer_email;
        const { data: authUsers } = await supabaseClient.auth.admin.listUsers();
        const user = authUsers.users.find(u => u.email === email);

        if (!user) {
          throw new Error(`No user found for email: ${email}`);
        }

        logStep("User found", { userId: user.id, email });

        // Update user_subscriptions
        await supabaseClient.from("user_subscriptions").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan_type: planType,
          status: "active",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, { onConflict: "user_id" });

        logStep("Subscription stored in database", { userId: user.id, planType });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("invoice.paid", { invoiceId: invoice.id });

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );

          // Determine plan type
          const priceId = subscription.items.data[0].price.id;
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount || 0;

          let planType = "pro";
          if (amount >= 4900) {
            planType = "unlimited";
          }

          // Update subscription status
          const { data: subs } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subs) {
            await supabaseClient
              .from("user_subscriptions")
              .update({
                plan_type: planType,
                status: "active",
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq("user_id", subs.user_id);

            logStep("Subscription updated after payment", {
              userId: subs.user_id,
              planType
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("invoice.payment_failed", { invoiceId: invoice.id });

        if (invoice.subscription) {
          // Update subscription status to past_due
          const { data: subs } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", invoice.subscription)
            .single();

          if (subs) {
            await supabaseClient
              .from("user_subscriptions")
              .update({
                status: "past_due",
              })
              .eq("user_id", subs.user_id);

            logStep("Subscription marked as past_due", { userId: subs.user_id });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("customer.subscription.deleted", {
          subscriptionId: subscription.id
        });

        // Mark subscription as canceled
        await supabaseClient
          .from("user_subscriptions")
          .update({
            plan_type: "free",
            status: "canceled",
          })
          .eq("stripe_subscription_id", subscription.id);

        logStep("Subscription marked as canceled");
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("customer.subscription.updated", {
          subscriptionId: subscription.id,
          status: subscription.status
        });

        // Determine plan type
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount || 0;

        let planType = "pro";
        let dbStatus = "active";

        if (amount >= 4900) {
          planType = "unlimited";
        }

        // Map Stripe status to our status
        if (subscription.status === "past_due") {
          dbStatus = "past_due";
        } else if (subscription.status === "canceled") {
          dbStatus = "canceled";
          planType = "free";
        }

        // Update subscription
        await supabaseClient
          .from("user_subscriptions")
          .update({
            plan_type: planType,
            status: dbStatus,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        logStep("Subscription updated", { planType, status: dbStatus });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
