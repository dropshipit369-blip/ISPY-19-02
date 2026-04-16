import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   CORS (iOS / Safari Safe)
========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =========================
   Types
========================= */
interface ItemInput {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  condition_score: number | null;
  extracted_text: string | null;
  image_url: string | null;
}

interface MarketReportInput {
  suggested_price: number | null;
  median_price: number | null;
  suggested_keywords: string[] | null;
  sold_comparables: Array<{
    title: string;
    price: number;
    marketplace: string;
    condition: string;
    timeframe: string;
    url?: string;
  }> | null;
  best_marketplace: string | null;
}

interface ListingOptions {
  marketplace: string;
  listing_format: "FIXED_PRICE" | "AUCTION";
  regenerate_field: "title" | "description" | "all";
}

interface EbayListingOutput {
  title: string;
  description: string;
  category_id: string;
  category_name: string;
  condition_id: string;
  condition_description: string;
  price: number;
  item_specifics: Record<string, string>;
  keywords: string[];
  shipping_weight_estimate: string;
}

/* =========================
   eBay Condition Mapping
========================= */
const CONDITION_MAP: Record<string, string> = {
  "new": "1000",
  "brand new": "1000",
  "sealed": "1000",
  "like new": "1500",
  "mint": "1500",
  "excellent": "1500",
  "very good": "2500",
  "great": "2500",
  "good": "3000",
  "fair": "3000",
  "acceptable": "4000",
  "used": "4000",
  "poor": "7000",
  "for parts": "7000",
  "broken": "7000",
};

const CONDITION_ID_LABELS: Record<string, string> = {
  "1000": "New",
  "1500": "Like New",
  "2000": "Excellent - Refurbished",
  "2500": "Very Good",
  "3000": "Good",
  "4000": "Acceptable",
  "7000": "For Parts or Not Working",
};

function mapConditionToEbayId(condition: string): string {
  const normalised = (condition || "good").toLowerCase().trim();
  return CONDITION_MAP[normalised] ?? "3000";
}

function getConditionLabel(conditionId: string): string {
  return CONDITION_ID_LABELS[conditionId] ?? "Good";
}

/* =========================
   Common eBay AU Categories
========================= */
const COMMON_CATEGORIES: Record<string, { id: string; name: string }> = {
  "electronics": { id: "293", name: "Computers/Tablets & Networking" },
  "phones": { id: "9355", name: "Cell Phones & Accessories" },
  "mobile phones": { id: "9355", name: "Cell Phones & Accessories" },
  "smartphones": { id: "9355", name: "Cell Phones & Accessories" },
  "cameras": { id: "625", name: "Cameras & Photo" },
  "photography": { id: "625", name: "Cameras & Photo" },
  "video games": { id: "1249", name: "Video Games & Consoles" },
  "gaming": { id: "1249", name: "Video Games & Consoles" },
  "consoles": { id: "1249", name: "Video Games & Consoles" },
  "clothing": { id: "11450", name: "Clothing, Shoes & Accessories" },
  "shoes": { id: "11450", name: "Clothing, Shoes & Accessories" },
  "fashion": { id: "11450", name: "Clothing, Shoes & Accessories" },
  "accessories": { id: "11450", name: "Clothing, Shoes & Accessories" },
  "jewellery": { id: "281", name: "Jewellery & Watches" },
  "jewelry": { id: "281", name: "Jewellery & Watches" },
  "watches": { id: "281", name: "Jewellery & Watches" },
  "home": { id: "11700", name: "Home & Garden" },
  "garden": { id: "11700", name: "Home & Garden" },
  "furniture": { id: "11700", name: "Home & Garden" },
  "kitchen": { id: "11700", name: "Home & Garden" },
  "toys": { id: "220", name: "Toys & Hobbies" },
  "hobbies": { id: "220", name: "Toys & Hobbies" },
  "collectibles": { id: "1", name: "Collectibles" },
  "antiques": { id: "20081", name: "Antiques" },
  "vintage": { id: "1", name: "Collectibles" },
  "books": { id: "267", name: "Books, Magazines" },
  "music": { id: "11233", name: "Music" },
  "vinyl": { id: "11233", name: "Music" },
  "records": { id: "11233", name: "Music" },
  "sports": { id: "888", name: "Sporting Goods" },
  "fitness": { id: "888", name: "Sporting Goods" },
  "tools": { id: "631", name: "Home Improvement" },
  "automotive": { id: "6000", name: "eBay Motors" },
  "car parts": { id: "6000", name: "eBay Motors" },
  "art": { id: "550", name: "Art" },
  "sculpture": { id: "550", name: "Art" },
  "figurines": { id: "1", name: "Collectibles" },
  "health": { id: "26395", name: "Health & Beauty" },
  "beauty": { id: "26395", name: "Health & Beauty" },
  "baby": { id: "2984", name: "Baby" },
  "pet": { id: "1281", name: "Pet Supplies" },
  "musical instruments": { id: "619", name: "Musical Instruments & Gear" },
  "craft": { id: "14339", name: "Crafts" },
  "general": { id: "99", name: "Everything Else" },
};

function lookupCategory(category: string): { id: string; name: string } {
  const normalised = (category || "general").toLowerCase().trim();
  // Direct match
  if (COMMON_CATEGORIES[normalised]) return COMMON_CATEGORIES[normalised];
  // Partial match
  for (const [key, value] of Object.entries(COMMON_CATEGORIES)) {
    if (normalised.includes(key) || key.includes(normalised)) return value;
  }
  return COMMON_CATEGORIES["general"];
}

/* =========================
   Authentication Helper
========================= */
async function authenticateUser(req: Request): Promise<{ userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("generate-ebay-listing proceeding without verified user context: no bearer token");
    return { userId: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("generate-ebay-listing auth skipped because Supabase env is incomplete");
    return { userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.warn("generate-ebay-listing proceeding without verified user context:", error?.message ?? "no user");
    return { userId: null };
  }

  return { userId: data.user.id };
}

/* =========================
   JSON Extraction Helper
========================= */
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

/* =========================
   Category Cache Lookup
========================= */
async function lookupCategoryFromCache(
  category: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await supabase
      .from("ebay_category_cache")
      .select("ebay_category_id, category_name")
      .ilike("category_name", `%${category}%`)
      .eq("marketplace_id", "EBAY_AU")
      .eq("is_leaf", true)
      .limit(1)
      .single();

    if (data) {
      return { id: data.ebay_category_id, name: data.category_name };
    }
  } catch (err) {
    console.warn("Category cache lookup failed:", err);
  }
  return null;
}

/* =========================
   Gemini Prompt Builder
========================= */
function buildPrompt(
  item: ItemInput,
  market: MarketReportInput,
  options: ListingOptions,
): string {
  const comparablesBlock = market.sold_comparables?.length
    ? `Sold comparables: ${market.sold_comparables
        .slice(0, 5)
        .map((c) => `"${c.title}" sold for A$${c.price} (${c.condition})`)
        .join("; ")}`
    : "";

  const keywordsBlock = market.suggested_keywords?.length
    ? `Suggested keywords: ${market.suggested_keywords.join(", ")}`
    : "";

  const priceGuidance = market.suggested_price
    ? `Target price: A$${market.suggested_price}`
    : market.median_price
    ? `Median sold price: A$${market.median_price}`
    : "";

  const fieldFocus =
    options.regenerate_field === "title"
      ? "Focus on generating the best possible title. Description can be brief."
      : options.regenerate_field === "description"
      ? "Focus on generating the best possible description. Title can be brief."
      : "Generate both a great title and description.";

  return `Generate an optimised eBay AU listing for this item:

Item: ${item.title}
Brand: ${item.brand || "Unbranded"}
Model: ${item.model || "N/A"}
Category: ${item.category || "General"}
Colour: ${item.color || "N/A"}
Condition: ${item.condition || "Good"}
Condition Score: ${item.condition_score ?? "N/A"}/10
${item.extracted_text ? `Text on item: ${item.extracted_text}` : ""}
${priceGuidance}
${comparablesBlock}
${keywordsBlock}
Listing format: ${options.listing_format === "AUCTION" ? "Auction" : "Fixed Price (Buy It Now)"}
${fieldFocus}

Return ONLY a JSON object with this exact structure:
{
  "title": "string (MUST be max 80 characters, keyword-optimised for eBay AU search — include brand, key features, condition indicator if used)",
  "description": "string (clean HTML: 2-3 short paragraphs describing the item, a <ul> bullet list of key specs, and close with 'Thank you for looking!')",
  "category_id": "string (closest eBay AU category ID from common categories)",
  "category_name": "string (human-readable category name)",
  "condition_id": "string (eBay condition code: 1000=New, 1500=Like New, 2000=Excellent Refurb, 2500=Very Good, 3000=Good, 4000=Acceptable, 7000=For Parts)",
  "condition_description": "string (1-2 sentence condition note for buyers)",
  "price": number (AUD, realistic based on comparables and market data),
  "item_specifics": {
    "Brand": "string",
    "Model": "string or N/A",
    "Colour": "string or N/A",
    "Type": "string (product sub-type)",
    "Material": "string or omit if not applicable",
    "Size": "string or omit if not applicable"
  },
  "keywords": ["array of 8-12 search keywords/phrases"],
  "shipping_weight_estimate": "string (e.g. '500g', '1.2kg', '3kg')"
}

RULES:
- Title MUST be 80 characters or fewer. Pack in brand, model, key feature, condition.
- Description HTML must be clean (no scripts, no styles, no iframes). Use <p>, <ul>, <li>, <strong>, <br> only.
- Description should be warm and professional — mention condition honestly, highlight features, close with "Thank you for looking!"
- category_id must be a real eBay category number.
- condition_id must be one of: 1000, 1500, 2000, 2500, 3000, 4000, 7000.
- Price in AUD. If no market data, estimate conservatively.
- item_specifics: include Brand and Type at minimum. Omit keys where value is truly unknown.
- keywords: short phrases buyers actually search for on eBay AU.
- shipping_weight_estimate: estimate from category/type (electronics heavier, clothing lighter, etc).`;
}

/* =========================
   Gemini Direct Call
========================= */
async function callGemini(
  apiKey: string,
  prompt: string,
  retries = 2,
): Promise<EbayListingOutput> {
  const model = "gemini-1.5-flash";

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Gemini attempt ${attempt + 1}/${retries}`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini API Error (${response.status}): ${errText.substring(0, 500)}`);

        // Overloaded / rate limited — throw to trigger retry or fallback
        if (response.status === 503 || response.status === 529 || response.status === 429) {
          throw new Error(`Gemini overloaded (${response.status})`);
        }
        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (!text) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          throw new Error("Content blocked by safety filters. Try different item details.");
        }
        throw new Error("Empty response from Gemini");
      }

      const parsed = extractJson(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Could not parse Gemini response as JSON");
      }

      return normaliseListingOutput(parsed as Record<string, unknown>);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Gemini attempt ${attempt + 1} failed: ${errMsg}`);
      if (attempt === retries - 1) throw err;
      const isOverloaded = errMsg.includes("503") || errMsg.includes("529") || errMsg.includes("429");
      const delay = isOverloaded ? 3000 : 1200;
      await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
    }
  }

  throw new Error("Gemini failed after all retries");
}

/* =========================
   OpenRouter Fallback
========================= */
async function callOpenRouter(
  openRouterKey: string,
  prompt: string,
): Promise<EbayListingOutput> {
  console.log("Attempting OpenRouter fallback (google/gemini-2.0-flash-001)...");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ispy-ai.vercel.app",
      "X-Title": "iSpy Profit Tool",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "system",
          content: "You are an eBay listing optimisation expert. Return ONLY valid JSON, no markdown fences.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`OpenRouter Error (${response.status}): ${errText.substring(0, 500)}`);
    throw new Error(`OpenRouter fallback failed (${response.status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter fallback");

  console.log("Got content from OpenRouter, parsing...");

  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenRouter returned invalid JSON");
  }

  return normaliseListingOutput(parsed as Record<string, unknown>);
}

/* =========================
   Output Normalisation
========================= */
function normaliseListingOutput(
  raw: Record<string, unknown>,
): EbayListingOutput {
  // Title: enforce 80 char max
  let title = String(raw.title || "Untitled Item").trim();
  if (title.length > 80) {
    // Truncate at last word boundary before 80 chars
    title = title.substring(0, 80).replace(/\s+\S*$/, "").trim();
    if (!title) title = String(raw.title || "Untitled Item").substring(0, 80);
  }

  // Description: ensure string
  const description = String(raw.description || "<p>Item as described. Thank you for looking!</p>");

  // Category
  const categoryId = String(raw.category_id || raw.categoryId || "99");
  const categoryName = String(raw.category_name || raw.categoryName || "Everything Else");

  // Condition
  let conditionId = String(raw.condition_id || raw.conditionId || "3000");
  if (!CONDITION_ID_LABELS[conditionId]) conditionId = "3000";
  const conditionDescription = String(
    raw.condition_description || raw.conditionDescription || getConditionLabel(conditionId),
  );

  // Price
  let price = Number(raw.price) || 0;
  if (!Number.isFinite(price) || price < 0) price = 0;

  // Item specifics
  const rawSpecifics = (raw.item_specifics || raw.itemSpecifics || {}) as Record<string, unknown>;
  const itemSpecifics: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawSpecifics)) {
    if (value && String(value).trim() && String(value).toLowerCase() !== "n/a") {
      itemSpecifics[key] = String(value).trim();
    }
  }

  // Keywords
  let keywords: string[] = [];
  const rawKeywords = raw.keywords || raw.keyword || [];
  if (Array.isArray(rawKeywords)) {
    keywords = rawKeywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0).slice(0, 15);
  }

  // Shipping weight
  const shippingWeight = String(raw.shipping_weight_estimate || raw.shippingWeightEstimate || "500g");

  return {
    title,
    description,
    category_id: categoryId,
    category_name: categoryName,
    condition_id: conditionId,
    condition_description: conditionDescription,
    price,
    item_specifics: itemSpecifics,
    keywords,
    shipping_weight_estimate: shippingWeight,
  };
}

/* =========================
   Apply Hardcoded Fallbacks
========================= */
function applyFallbacks(
  listing: EbayListingOutput,
  item: ItemInput,
  market: MarketReportInput,
): EbayListingOutput {
  // Condition ID fallback — if AI returned something invalid, map from item.condition
  if (!CONDITION_ID_LABELS[listing.condition_id]) {
    listing.condition_id = mapConditionToEbayId(item.condition);
    listing.condition_description = getConditionLabel(listing.condition_id);
  }

  // Price fallback — use market data if AI returned 0
  if (listing.price <= 0) {
    listing.price = market.suggested_price || market.median_price || 0;
  }

  // Category fallback — if AI returned generic "99", try our local lookup
  if (listing.category_id === "99" || !listing.category_id) {
    const fallback = lookupCategory(item.category);
    listing.category_id = fallback.id;
    listing.category_name = fallback.name;
  }

  // Item specifics: ensure Brand is populated
  if (!listing.item_specifics["Brand"] && item.brand) {
    listing.item_specifics["Brand"] = item.brand;
  }
  if (!listing.item_specifics["Model"] && item.model) {
    listing.item_specifics["Model"] = item.model;
  }
  if (!listing.item_specifics["Colour"] && item.color) {
    listing.item_specifics["Colour"] = item.color;
  }

  // Title length enforcement (double-check)
  if (listing.title.length > 80) {
    listing.title = listing.title.substring(0, 80).replace(/\s+\S*$/, "").trim();
  }

  return listing;
}

/* =========================
   HTTP Handler
========================= */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    await authenticateUser(req);

    const body = await req.json();
    const { item, market_report, options } = body ?? {};

    // ── Validate inputs ──
    if (!item || !item.title) {
      return new Response(
        JSON.stringify({ error: "item with title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeItem: ItemInput = {
      title: String(item.title).trim().substring(0, 200),
      brand: item.brand ? String(item.brand).trim().substring(0, 100) : null,
      model: item.model ? String(item.model).trim().substring(0, 100) : null,
      category: String(item.category || "General").trim(),
      color: item.color ? String(item.color).trim().substring(0, 50) : null,
      condition: String(item.condition || "Good").trim(),
      condition_score: typeof item.condition_score === "number" ? item.condition_score : null,
      extracted_text: item.extracted_text ? String(item.extracted_text).trim().substring(0, 500) : null,
      image_url: item.image_url ? String(item.image_url).trim() : null,
    };

    const safeMarket: MarketReportInput = {
      suggested_price: typeof market_report?.suggested_price === "number" ? market_report.suggested_price : null,
      median_price: typeof market_report?.median_price === "number" ? market_report.median_price : null,
      suggested_keywords: Array.isArray(market_report?.suggested_keywords)
        ? market_report.suggested_keywords.filter((k: unknown) => typeof k === "string").slice(0, 20)
        : null,
      sold_comparables: Array.isArray(market_report?.sold_comparables)
        ? market_report.sold_comparables.slice(0, 10)
        : null,
      best_marketplace: market_report?.best_marketplace ? String(market_report.best_marketplace) : null,
    };

    const safeOptions: ListingOptions = {
      marketplace: String(options?.marketplace || "EBAY_AU"),
      listing_format: options?.listing_format === "AUCTION" ? "AUCTION" : "FIXED_PRICE",
      regenerate_field: (["title", "description", "all"].includes(options?.regenerate_field)
        ? options.regenerate_field
        : "all") as "title" | "description" | "all",
    };

    // ── Try category cache before AI call ──
    const cachedCategory = await lookupCategoryFromCache(safeItem.category);

    // ── Build prompt ──
    const prompt = buildPrompt(safeItem, safeMarket, safeOptions);

    // ── Get API keys ──
    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!geminiKey && !openRouterKey) {
      return new Response(
        JSON.stringify({ error: "No AI service configured. Set GOOGLE_GEMINI_API_KEY or OPENROUTER_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Call AI with fallback chain ──
    let listing: EbayListingOutput;

    if (geminiKey) {
      try {
        listing = await callGemini(geminiKey, prompt);
      } catch (geminiError) {
        const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
        console.warn(`Gemini direct failed: ${geminiMsg}`);

        if (openRouterKey) {
          console.log("Falling back to OpenRouter...");
          listing = await callOpenRouter(openRouterKey, prompt);
        } else {
          console.error("No OPENROUTER_API_KEY set — cannot fallback. Re-throwing Gemini error.");
          throw geminiError;
        }
      }
    } else {
      // No Gemini key, go straight to OpenRouter
      listing = await callOpenRouter(openRouterKey!, prompt);
    }

    // ── Apply hardcoded fallbacks ──
    listing = applyFallbacks(listing, safeItem, safeMarket);

    // ── Override category from cache if available and AI returned generic ──
    if (cachedCategory && (listing.category_id === "99" || listing.category_id === "0")) {
      listing.category_id = cachedCategory.id;
      listing.category_name = cachedCategory.name;
    }

    return new Response(
      JSON.stringify({ listing }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-ebay-listing error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
