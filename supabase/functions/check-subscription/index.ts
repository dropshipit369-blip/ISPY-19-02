
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Product IDs mapping - to be set in Stripe Dashboard
const PLAN_MAPPING: Record<string, string> = {
  // Map Stripe product IDs to plan types
  // These will be matched against the subscription's product ID
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  const freeTierResponse = (scansUsed = 0) =>
    new Response(JSON.stringify({
      subscribed: false,
      plan_type: "free",
      subscription_end: null,
      scans_used: scansUsed,
      scans_limit: 5,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      return new Response(JSON.stringify({ error: `Authentication error: ${userError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User not authenticated or email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usageData } = await supabaseClient
      .from("live_scan_usage")
      .select("scan_count")
      .eq("user_id", user.id)
      .eq("month_year", currentMonth)
      .single();
    const scansUsed = usageData?.scan_count || 0;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("STRIPE_SECRET_KEY not set, returning free tier");
      return freeTierResponse(scansUsed);
    }

    let customers: Stripe.Response<Stripe.ApiList<Stripe.Customer>>;
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      customers = await stripe.customers.list({ email: user.email, limit: 1 });

      if (customers.data.length === 0) {
        logStep("No customer found, returning free tier");

        // Ensure user has a subscription record
        await supabaseClient.from("user_subscriptions").upsert({
          user_id: user.id,
          plan_type: "free",
          status: "active",
        }, { onConflict: "user_id" });

        return freeTierResponse(scansUsed);
      }

      const customerId = customers.data[0].id;
      logStep("Found Stripe customer", { customerId });

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      let planType = "free";
      let subscriptionEnd = null;
      let subscribed = false;

      if (subscriptions.data.length > 0) {
        const subscription = subscriptions.data[0];
        subscribed = true;
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

        // Get the price amount to determine plan type
        const priceId = subscription.items.data[0].price.id;
        const price = await stripe.prices.retrieve(priceId);
        const amount = price.unit_amount || 0;

        // A$19 = Pro, A$49 = Unlimited
        if (amount >= 4900) {
          planType = "unlimited";
        } else if (amount >= 1900) {
          planType = "pro";
        }

        logStep("Active subscription found", {
          subscriptionId: subscription.id,
          planType,
          amount,
          endDate: subscriptionEnd
        });

        // Update subscription in database
        await supabaseClient.from("user_subscriptions").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan_type: planType,
          status: "active",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd,
        }, { onConflict: "user_id" });
      } else {
        logStep("No active subscription");

        await supabaseClient.from("user_subscriptions").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          plan_type: "free",
          status: "inactive",
        }, { onConflict: "user_id" });
      }

      const scansLimit = planType === "unlimited" ? -1 : (planType === "pro" ? 50 : 5);

      return new Response(JSON.stringify({
        subscribed,
        plan_type: planType,
        subscription_end: subscriptionEnd,
        scans_used: scansUsed,
        scans_limit: scansLimit,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (stripeError) {
      const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
      logStep("Stripe check failed, returning free tier", { message });
      return freeTierResponse(scansUsed);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({
      error: errorMessage,
      subscribed: false,
      plan_type: "free",
      subscription_end: null,
      scans_used: 0,
      scans_limit: 5,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
