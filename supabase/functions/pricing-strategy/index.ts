
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function authenticateUser(req: Request): Promise<{ userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("pricing-strategy proceeding without verified user context: no bearer token");
    return { userId: null };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("pricing-strategy auth skipped because Supabase env is incomplete");
    return { userId: null };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.warn("pricing-strategy proceeding without verified user context:", error?.message ?? "no user");
    return { userId: null };
  }
  return { userId: data.user.id };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    await authenticateUser(req);

    const body = await req.json();
    const { analysis, marketReport, additionalItems = [] } = body ?? {};

    if (!analysis || !marketReport) {
      return new Response(JSON.stringify({ error: "analysis and marketReport are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ??
      Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lotNames = Array.isArray(additionalItems)
      ? additionalItems
        .map((item: unknown) => {
          if (!item || typeof item !== "object" || !("name" in item)) return null;
          const name = (item as { name?: unknown }).name;
          return typeof name === "string" && name.trim().length > 0 ? name : null;
        })
        .filter((name): name is string => Boolean(name))
      : [];
    const lotContext = lotNames.length
      ? `This is a LOT/BUNDLE listing. Main item: ${analysis.title}. Additional items: ${lotNames.join(", ")}. Consider bundle discounting strategy.`
      : "Single item listing.";

    const prompt = `You are a veteran resale expert with 20+ years of experience flipping items on eBay, Amazon, Etsy, Facebook Marketplace, Mercari, and Poshmark. You've built multiple 6-figure resale businesses. You speak directly and confidently, like a mentor coaching a friend.

The user just identified an item and wants your deep, expert pricing and sales strategy. This is NOT a generic report — this is a personalized consultation.

ITEM DETAILS:
- Title: ${analysis.title}
- Brand: ${analysis.brand || "Unbranded/Unknown"}
- Model: ${analysis.model || "Unknown"}
- Category: ${analysis.category || "General"}
- Condition: ${analysis.condition || "Unknown"}

MARKET DATA:
- Low Price: A$${marketReport.low_price}
- Median Price: A$${marketReport.median_price}
- High Price: A$${marketReport.high_price}
- Price Trend: ${marketReport.price_trend || "stable"} (${marketReport.trend_percentage || 0}%)
- Avg Days to Sell: ${marketReport.avg_days_to_sell || "unknown"}
- Best Marketplace: ${marketReport.best_marketplace || "eBay"}
- Confidence: ${marketReport.confidence_score || "unknown"}%

${lotContext}

Return ONLY a JSON object with this EXACT structure:
{
  "recommendedPrice": number,
  "listingType": "Auction" | "Fixed Price",
  "lowEstimate": number,
  "highEstimate": number,
  "reasoning": "One-paragraph conversational summary of the full strategy",
  "lotStrategy": {"isLot": boolean, "individualSum": number, "bundlePrice": number, "recommendation": "Sell as Lot" | "Sell Individually"} | null,
  "deepAnalysis": {
    "marketInsight": "2-4 sentences. Talk about the current market for this specific item/brand/category. Mention demand trends, seasonality, and buyer demographics. Be specific, not generic.",
    "pricingRationale": "2-4 sentences. Explain exactly WHY you chose this price. Reference the market data, condition, and competitive positioning. Mention the risk/reward of pricing higher vs lower.",
    "salesTactics": [
      "First specific, actionable sales tactic",
      "Second specific tactic",
      "Third specific tactic",
      "Fourth specific tactic (if applicable)"
    ],
    "marketplaceBreakdown": [
      {"platform": "eBay", "fit": "great" | "good" | "okay" | "poor", "reasoning": "1-2 sentences on WHY this platform is/isn't right for this item", "estimatedPrice": number, "estimatedDays": number},
      {"platform": "Facebook Marketplace", "fit": "great" | "good" | "okay" | "poor", "reasoning": "1-2 sentences", "estimatedPrice": number, "estimatedDays": number},
      {"platform": "Mercari", "fit": "great" | "good" | "okay" | "poor", "reasoning": "1-2 sentences", "estimatedPrice": number, "estimatedDays": number},
      {"platform": "Poshmark", "fit": "great" | "good" | "okay" | "poor", "reasoning": "1-2 sentences", "estimatedPrice": number, "estimatedDays": number},
      {"platform": "Amazon", "fit": "great" | "good" | "okay" | "poor", "reasoning": "1-2 sentences", "estimatedPrice": number, "estimatedDays": number}
    ],
    "bestTimeToList": "1-2 sentences. When should they list this? Day of week, time of day, season considerations.",
    "negotiationTips": "2-3 sentences. How to handle lowball offers, what's the lowest they should go, and what counter-offer strategies to use.",
    "shippingAdvice": "1-2 sentences. Should they offer free shipping? What carrier/method? How does shipping affect perceived value?",
    "photographyTips": "1-2 sentences. Specific tips for photographing THIS type of item to maximize buyer interest.",
    "riskAssessment": "1-2 sentences. What could go wrong? Returns risk, condition disputes, market shifts.",
    "flipScore": number
  }
}

RULES:
- flipScore is 1-100. It measures how good this flip opportunity is overall (margins, demand, ease of sale).
- Be SPECIFIC to this item. No generic advice. If it's a Nike shoe, talk about Nike shoe market. If it's a vintage toy, talk about collector demand.
- salesTactics should be things like "List on Thursday evening for maximum Sunday auction visibility" or "Include all original accessories in photos even if not included to show what the full set looks like" — real tactics, not platitudes.
- Prices should be in AUD and realistic.
- Write conversationally, like you're chatting with the seller face-to-face.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 4000,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = extractJson(text);

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid model response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ strategy: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
