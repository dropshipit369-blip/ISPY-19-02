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
interface SoldComparable {
  title: string;
  price: number;
  marketplace: string;
  condition: string;
  timeframe: string;
  url?: string;
}

interface AnalysisResult {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  conditionScore: number;
  extractedText: string | null;
  barcode: string | null;
  marketReport: {
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
    avgDaysToSell: number;
    priceTrend: "up" | "down" | "stable";
    trendPercentage: number;
    confidenceScore: number;
    bestMarketplace: string;
    suggestedPrice: number;
    listingType: "auction" | "fixed";
    bestDayToList: string;
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedKeywords: string[];
    shippingRecommendation: string;
    soldComparables: SoldComparable[];
    dataSources: {
      ebay?: { listings: number; avgPrice: number } | null;
      amazon?: { listings: number; avgPrice: number } | null;
      etsy?: { listings: number; avgPrice: number } | null;
    };
  };
}

interface MarketplaceStats {
  lowPrice: number;
  medianPrice: number;
  highPrice: number;
  avgPrice: number;
  listingsCount: number;
}

interface VerifiedMarketplacePayload {
  success?: boolean;
  code?: string;
  connector?: string;
  sold_comparables?: SoldComparable[];
  listings?: SoldComparable[];
  stats?: MarketplaceStats | null;
  error?: string;
}

type JsonRecord = Record<string, unknown>;

/* =========================
   Validation & Normalisation
========================= */

/** Force a value to a finite number, falling back to `fallback`. */
function safeNum(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Force a value to a string, falling back to `fallback`. */
function safeStr(val: unknown, fallback: string | null = null): string | null {
  if (typeof val === "string" && val.trim().length > 0) return val.trim();
  return fallback;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" ? (value as JsonRecord) : null;
}

/**
 * Attempts to normalise whatever shape Gemini returned into our expected
 * AnalysisResult type.  Returns `null` when normalisation is impossible.
 */
function normaliseAnalysis(raw: unknown): AnalysisResult | null {
  const rawRecord = asRecord(raw);
  if (!rawRecord) return null;

  // ── Title is the only truly required field ──
  const title = safeStr(rawRecord.title) ?? safeStr(rawRecord.name) ?? safeStr(rawRecord.item);
  if (!title) return null;

  // ── Handle the market report sub-object ──
  // Gemini might name it "marketReport", "market_report", or "market"
  const mr = asRecord(rawRecord.marketReport ?? rawRecord.market_report ?? rawRecord.market);
  if (!mr) return null;

  // ── Pull prices with resilient key matching ──
  let medianPrice = safeNum(mr.medianPrice ?? mr.median_price ?? mr.suggestedPrice ?? mr.suggested_price ?? mr.price, 0);
  let lowPrice = safeNum(mr.lowPrice ?? mr.low_price ?? mr.low, Math.max(0, medianPrice * 0.6));
  let highPrice = safeNum(mr.highPrice ?? mr.high_price ?? mr.high, medianPrice * 1.5);

  // If median is still 0, we have no pricing data – reject

  let suggestedPrice = safeNum(mr.suggestedPrice ?? mr.suggested_price, medianPrice);

  // ── Data sources (flexible key names) ──
  const rawSources = asRecord(mr.dataSources ?? mr.data_sources) ?? {};
  const normSource = (source: unknown) => {
    const sourceRecord = asRecord(source);
    if (!sourceRecord || typeof sourceRecord.listings !== "number") return null;
    return {
      listings: sourceRecord.listings,
      avgPrice: safeNum(sourceRecord.avgPrice ?? sourceRecord.avg_price, 0),
    };
  };

  const dataSources = {
    ebay: normSource(rawSources.ebay),
    amazon: normSource(rawSources.amazon),
    etsy: normSource(rawSources.etsy),
  };

  // ── Trend normalisation ──
  let priceTrend: "up" | "down" | "stable" = "stable";
  const rawTrend = String(mr.priceTrend ?? mr.price_trend ?? "stable").toLowerCase();
  if (rawTrend.includes("up")) priceTrend = "up";
  else if (rawTrend.includes("down")) priceTrend = "down";

  // ── Listing type normalisation ──
  let listingType: "auction" | "fixed" = "fixed";
  const rawListing = String(mr.listingType ?? mr.listing_type ?? "fixed").toLowerCase();
  if (rawListing.includes("auction")) listingType = "auction";

  // ── Condition normalisation ──
  const rawCondition = safeStr(rawRecord.condition) ?? "Good";
  const validConditions = ["New", "Like New", "Very Good", "Good", "Fair", "Poor"];
  const condition = validConditions.find(c => c.toLowerCase() === rawCondition.toLowerCase()) ?? "Good";

  // ── Keywords normalisation ──
  let suggestedKeywords: string[] = [];
  const rawKeywords = mr.suggestedKeywords ?? mr.suggested_keywords ?? mr.keywords;
  if (Array.isArray(rawKeywords)) {
    suggestedKeywords = rawKeywords.filter((k): k is string => typeof k === "string").slice(0, 20);
  }

  // ── Sold Comparables normalisation ──
  let soldComparables: SoldComparable[] = [];
  const rawComps = mr.soldComparables ?? mr.sold_comparables ?? mr.comparables;
  if (Array.isArray(rawComps)) {
    soldComparables = rawComps
      .filter((c: unknown) => asRecord(c) !== null)
      .map((c: unknown) => {
        const comp = asRecord(c)!;
        return {
          title: safeStr(comp.title) ?? title,
          price: Math.max(0, safeNum(comp.price, 0)),
          marketplace: safeStr(comp.marketplace) ?? "eBay",
          condition: safeStr(comp.condition) ?? "Good",
          timeframe: safeStr(comp.timeframe ?? comp.time_frame ?? comp.soldDate ?? comp.sold_date) ?? "Recently",
          url: safeStr(comp.url ?? comp.link) ?? undefined,
        };
      })
      .filter((c: SoldComparable) => c.price > 0)
      .slice(0, 10);
  }

  // ── RE-CALCULATE PRICING FROM COMPS (Source of Truth) ──
  // If we have valid comps, they MUST define the price range
  if (soldComparables.length > 0) {
    const prices = soldComparables.map(c => c.price).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];

    // Calculate median
    const mid = Math.floor(prices.length / 2);
    const computedMedian = prices.length % 2 !== 0
      ? prices[mid]
      : (prices[mid - 1] + prices[mid]) / 2;

    // Overwrite AI "guesses" with derived data
    lowPrice = min;
    highPrice = max;
    medianPrice = computedMedian;
    suggestedPrice = computedMedian; // Default suggested to median
  }

  return {
    title,
    brand: safeStr(rawRecord.brand),
    model: safeStr(rawRecord.model),
    category: safeStr(rawRecord.category) ?? "General",
    color: safeStr(rawRecord.color),
    condition,
    conditionScore: Math.max(1, Math.min(10, safeNum(rawRecord.conditionScore ?? rawRecord.condition_score, 7))),
    extractedText: safeStr(rawRecord.extractedText ?? rawRecord.extracted_text),
    barcode: safeStr(rawRecord.barcode),
    marketReport: {
      lowPrice: Math.max(0, lowPrice),
      medianPrice: Math.max(0, medianPrice),
      highPrice: Math.max(0, highPrice),
      avgDaysToSell: safeNum(mr.avgDaysToSell ?? mr.avg_days_to_sell, 14),
      priceTrend,
      trendPercentage: safeNum(mr.trendPercentage ?? mr.trend_percentage, 0),
      confidenceScore: Math.min(100, Math.max(0, safeNum(mr.confidenceScore ?? mr.confidence_score, 50))),
      bestMarketplace: safeStr(mr.bestMarketplace ?? mr.best_marketplace) ?? "eBay Australia",
      suggestedPrice: Math.max(0, suggestedPrice),
      listingType,
      bestDayToList: safeStr(mr.bestDayToList ?? mr.best_day_to_list) ?? "Sunday",
      suggestedTitle: safeStr(mr.suggestedTitle ?? mr.suggested_title) ?? title,
      suggestedDescription: safeStr(mr.suggestedDescription ?? mr.suggested_description) ?? "",
      suggestedKeywords,
      shippingRecommendation: safeStr(mr.shippingRecommendation ?? mr.shipping_recommendation) ?? "Standard shipping",
      soldComparables,
      dataSources,
    },
  };
}

function clampMarketValues(result: AnalysisResult): AnalysisResult {
  const m = result.marketReport;

  m.lowPrice = Math.max(0, m.lowPrice);
  m.medianPrice = Math.max(m.lowPrice, m.medianPrice);
  m.highPrice = Math.max(m.medianPrice, m.highPrice);
  m.confidenceScore = Math.min(100, Math.max(0, m.confidenceScore));

  if (!result.brand && !result.barcode && !result.extractedText) {
    m.confidenceScore = Math.max(10, m.confidenceScore - 30);
  }

  return result;
}

function sanitizeSearchQuery(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
}

function buildMarketplaceSearchQuery(result: AnalysisResult): string {
  return sanitizeSearchQuery([result.brand, result.title, result.model].filter(Boolean).join(" "));
}

function markMarketDataManualRequired(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    marketReport: {
      ...result.marketReport,
      lowPrice: 0,
      medianPrice: 0,
      highPrice: 0,
      avgDaysToSell: 0,
      priceTrend: "stable",
      trendPercentage: 0,
      confidenceScore: 0,
      bestMarketplace: "Manual Entry Required",
      suggestedPrice: 0,
      listingType: "fixed",
      bestDayToList: "",
      suggestedTitle: "",
      suggestedDescription: "",
      suggestedKeywords: [],
      shippingRecommendation: "",
      soldComparables: [],
      dataSources: {
        ebay: null,
        amazon: null,
        etsy: null,
      },
    },
  };
}

function applyVerifiedMarketplaceData(
  result: AnalysisResult,
  payload: VerifiedMarketplacePayload,
): AnalysisResult {
  const soldComparables = (payload.sold_comparables ?? payload.listings ?? [])
    .filter((comparable) => typeof comparable?.price === "number" && comparable.price > 0)
    .slice(0, 12);

  if (!payload.stats || soldComparables.length === 0) {
    return markMarketDataManualRequired(result);
  }

  return clampMarketValues({
    ...result,
    marketReport: {
      ...result.marketReport,
      lowPrice: payload.stats.lowPrice,
      medianPrice: payload.stats.medianPrice,
      highPrice: payload.stats.highPrice,
      avgDaysToSell: 0,
      priceTrend: "stable",
      trendPercentage: 0,
      confidenceScore: Math.max(result.marketReport.confidenceScore, 92),
      bestMarketplace: "eBay Australia",
      suggestedPrice: payload.stats.medianPrice,
      soldComparables,
      dataSources: {
        ebay: {
          listings: payload.stats.listingsCount,
          avgPrice: payload.stats.avgPrice,
        },
        amazon: null,
        etsy: null,
      },
    },
  });
}

async function fetchVerifiedMarketplaceData(searchQuery: string): Promise<VerifiedMarketplacePayload> {
  const normalizedSearchQuery = sanitizeSearchQuery(searchQuery);
  if (!normalizedSearchQuery) {
    throw new Error("Insufficient Market Data - Manual Entry Required.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Marketplace verification connector is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/scrape-marketplace`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ searchQuery: normalizedSearchQuery }),
    },
  );

  const responseText = await response.text();
  let payload: VerifiedMarketplacePayload = {};

  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(`Marketplace verification returned invalid JSON (${response.status}).`);
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Marketplace verification failed (${response.status}).`);
  }

  return payload;
}

/* =========================
   Authentication Helper
========================= */
async function authenticateUser(req: Request): Promise<{ userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("analyze-item auth skipped because Supabase env is incomplete");
    return { userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    console.warn("analyze-item proceeding without verified user context:", error?.message ?? "no user");
    return { userId: null };
  }

  return { userId: data.user.id };
}

/* =========================
   Cached Learning Context
========================= */
let cachedLearningContext = "";
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

async function getLearningContextAsync(): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: feedback } = await supabase
      .from("scan_feedback")
      .select("original_name, corrected_name, corrected_brand, corrected_category")
      .eq("feedback_type", "correction")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!feedback || feedback.length === 0) return;

    const corrections = feedback
      .filter(f => f.corrected_name || f.corrected_brand || f.corrected_category)
      .map(f => {
        const parts = [];
        if (f.corrected_name) parts.push(`"${f.original_name}" → "${f.corrected_name}"`);
        if (f.corrected_brand) parts.push(`brand: ${f.corrected_brand}`);
        if (f.corrected_category) parts.push(`category: ${f.corrected_category}`);
        return parts.join(", ");
      })
      .filter(Boolean)
      .slice(0, 10);

    if (corrections.length > 0) {
      cachedLearningContext = `\nLEARNED: ${corrections.join("; ")}\n`;
    }
    lastFetchTime = Date.now();
  } catch (err) {
    console.warn("Learning fetch failed:", err);
  }
}

function getLearningContext(): string {
  // Refresh cache in background if stale (non-blocking)
  if (Date.now() - lastFetchTime > CACHE_TTL) {
    getLearningContextAsync();
  }
  return cachedLearningContext;
}

/* =========================
   Response Schema for Gemini
========================= */
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    brand: { type: "STRING", nullable: true },
    model: { type: "STRING", nullable: true },
    category: { type: "STRING" },
    color: { type: "STRING", nullable: true },
    condition: { type: "STRING", enum: ["New", "Like New", "Very Good", "Good", "Fair", "Poor"] },
    conditionScore: { type: "NUMBER" },
    extractedText: { type: "STRING", nullable: true },
    barcode: { type: "STRING", nullable: true },
    marketReport: {
      type: "OBJECT",
      properties: {
        lowPrice: { type: "NUMBER" },
        medianPrice: { type: "NUMBER" },
        highPrice: { type: "NUMBER" },
        avgDaysToSell: { type: "NUMBER" },
        priceTrend: { type: "STRING", enum: ["up", "down", "stable"] },
        trendPercentage: { type: "NUMBER" },
        confidenceScore: { type: "NUMBER" },
        bestMarketplace: { type: "STRING" },
        suggestedPrice: { type: "NUMBER" },
        listingType: { type: "STRING", enum: ["auction", "fixed"] },
        bestDayToList: { type: "STRING" },
        suggestedTitle: { type: "STRING" },
        suggestedDescription: { type: "STRING" },
        suggestedKeywords: { type: "ARRAY", items: { type: "STRING" } },
        shippingRecommendation: { type: "STRING" },
        soldComparables: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              price: { type: "NUMBER" },
              marketplace: { type: "STRING" },
              condition: { type: "STRING" },
              timeframe: { type: "STRING" },
              url: { type: "STRING", nullable: true },
            },
            required: ["title", "price", "marketplace", "condition", "timeframe"],
          },
        },
        dataSources: {
          type: "OBJECT",
          properties: {
            ebay: {
              type: "OBJECT",
              nullable: true,
              properties: {
                listings: { type: "NUMBER" },
                avgPrice: { type: "NUMBER" },
              },
              required: ["listings", "avgPrice"],
            },
            amazon: {
              type: "OBJECT",
              nullable: true,
              properties: {
                listings: { type: "NUMBER" },
                avgPrice: { type: "NUMBER" },
              },
              required: ["listings", "avgPrice"],
            },
            etsy: {
              type: "OBJECT",
              nullable: true,
              properties: {
                listings: { type: "NUMBER" },
                avgPrice: { type: "NUMBER" },
              },
              required: ["listings", "avgPrice"],
            },
          },
        },
      },
      required: [
        "lowPrice", "medianPrice", "highPrice", "avgDaysToSell",
        "priceTrend", "trendPercentage", "confidenceScore",
        "bestMarketplace", "suggestedPrice", "listingType",
        "bestDayToList", "suggestedTitle", "suggestedDescription",
        "suggestedKeywords", "shippingRecommendation", "soldComparables", "dataSources",
      ],
    },
  },
  required: [
    "title", "category", "condition", "conditionScore", "marketReport",
  ],
};

/* =========================
   System Prompt (Compact)
========================= */
// SES §3: Material-First system prompt for Gemini vision inference.
// Eliminates hallucinations where texture/silhouette overrides material evidence.
const MATERIAL_FIRST_CONSTRAINTS = `
IDENTIFICATION RULES — APPLY BEFORE ALL ELSE:
1. MATERIAL/TEXTURE OVER SHAPE: Determine the physical medium first (wood, stone, ceramic, canvas, fabric, resin, plastic, metal, paper).
   - If a shape resembles a biological entity but the material is NOT biological, classify under Art/Sculpture/Handmade/Collectibles, NOT as the animal or plant.
   - Example: carved wood shaped like an elephant → category "Art/Sculpture", title "Carved Wooden Elephant Figurine" — NOT category "Animal".
   - Example: ceramic dog figurine → category "Collectibles/Figurines", NOT "Animal".
2. BIOLOGICAL ENTITY CONFIDENCE GUARDRAIL: Only assign an "Animal" or living-entity category if you have >95% confidence the subject is a live, real biological organism (not carved, moulded, printed, stuffed, or sculpted). Confidence ≤95% → reclassify to Vintage/Collectibles, Art/Sculpture, Toy, or Decor.
3. ELECTRONICS GUARDRAIL: Only categorise as "Electronics" when a brand, model number, or clearly identifiable functional device is visible. Ambiguous shapes must NOT be guessed as electronics.
`;

const getSystemPrompt = (additionalContext?: string, learningContext?: string) =>
  `You are a professional resale appraiser. Analyze the item in the image and provide a detailed assessment for resale.${learningContext || ""}${additionalContext ? ` Additional context from user: ${additionalContext}` : ""}
${MATERIAL_FIRST_CONSTRAINTS}
Return a JSON object matching the exact schema provided. Use AUD. Do not fabricate sold listings or live market prices.

CRITICAL:
- Apply material-first identification rules strictly before naming or categorising any item.
- Focus on accurate identification, condition, keywords, and listing copy.
- If you do not have verified sold-market data from the image alone, leave "soldComparables" as an empty array.
- When soldComparables is empty, set lowPrice, medianPrice, highPrice, and suggestedPrice to 0.
- Never invent marketplace links, sold dates, or sold prices.

The suggestedPrice and medianPrice MUST be derived from these comparables. The lowPrice should match the lowest comparable and highPrice should match the highest. Vary the prices realistically — not all the same price. Use your knowledge of current market values.`;

const getVerifiedSystemPrompt = (additionalContext?: string, learningContext?: string) =>
  getSystemPrompt(additionalContext, learningContext).replace(
    /\nThe suggestedPrice[\s\S]*?current market values\./,
    "",
  );

/* =========================
   AI Call (Speed Optimized)
========================= */
async function callAI(
  apiKey: string,
  imageUrl: string,
  additionalContext?: string,
  learningContext?: string,
  retries = 2
): Promise<AnalysisResult> {
  const model = "gemini-2.0-flash";
  const systemPrompt = getVerifiedSystemPrompt(additionalContext, learningContext);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Gemini API Call Attempt ${attempt + 1}/${retries}`);

      // Build request body with structured JSON output
      const requestBody: {
        contents: Array<{ parts: Array<Record<string, unknown>> }>;
        system_instruction: { parts: Array<{ text: string }> };
        generation_config: Record<string, unknown>;
      } = {
        contents: [
          {
            parts: [
              {
                text: "Analyze this item for resale pricing and identification.",
              },
            ],
          },
        ],
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        generation_config: {
          max_output_tokens: 2048,
          temperature: 0.4,
          response_mime_type: "application/json",
          response_schema: GEMINI_RESPONSE_SCHEMA,
        },
      };

      // Add image to parts
      if (imageUrl.startsWith("data:")) {
        // Detect actual mime type from data URL
        const mimeMatch = imageUrl.match(/^data:(image\/\w+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = imageUrl.split(",")[1];
        requestBody.contents[0].parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        });
      } else {
        requestBody.contents[0].parts.push({
          file_data: {
            mime_type: "image/jpeg",
            file_uri: imageUrl,
          },
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const responseText = await response.text();
      console.log(`Gemini Response Status: ${response.status}`);

      if (!response.ok) {
        console.error(`Gemini API Error (${response.status}): ${responseText.substring(0, 500)}`);

        // If the schema-constrained request fails, retry WITHOUT response_schema
        if (response.status === 400 && responseText.includes("schema")) {
          console.log("Schema-constrained request failed, retrying without schema...");
          return await callAIWithoutSchema(apiKey, imageUrl, additionalContext, learningContext);
        }

        // For 503/529 (overloaded), use longer backoff before retry
        if (response.status === 503 || response.status === 529) {
          console.log(`Gemini overloaded (${response.status}), will retry with backoff...`);
          throw new Error(`AI service temporarily unavailable (${response.status})`);
        }

        // For 429 (rate limit), flag for retry
        if (response.status === 429) {
          console.log("Gemini rate limited (429), will retry with backoff...");
          throw new Error(`AI service rate limited (429)`);
        }

        throw new Error(`Gemini API returned ${response.status}`);
      }

      const data = JSON.parse(responseText);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        // Check for safety blocks or other issues
        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          throw new Error("Image was blocked by safety filters. Try a different photo.");
        }
        console.error("No content in response:", JSON.stringify(data).substring(0, 500));
        throw new Error("Empty response from AI service");
      }

      console.log("Got content from Gemini, parsing...");

      // Parse the JSON response
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try to extract JSON if wrapped in markdown fences
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) {
          parsed = JSON.parse(fenced[1]);
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }

      // Normalise into our expected structure (resilient to Gemini quirks)
      const normalised = normaliseAnalysis(parsed);
      if (!normalised) {
        console.error("Normalisation failed for:", JSON.stringify(parsed).substring(0, 400));
        throw new Error("AI returned an incomplete analysis — please try again");
      }

      return clampMarketValues(normalised);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Attempt ${attempt + 1} failed:`, errMsg);
      if (attempt === retries - 1) throw err;
      // Longer backoff for overloaded/rate-limited responses
      const isOverloaded = errMsg.includes("503") || errMsg.includes("529") || errMsg.includes("429");
      const baseDelay = isOverloaded ? 3000 : 1200;
      await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
    }
  }

  throw new Error("AI analysis failed after all retries. Please try again.");
}

/**
 * Fallback: call Gemini WITHOUT response_schema (free-form JSON).
 * Used when the structured-output request is rejected by the API.
 */
async function callAIWithoutSchema(
  apiKey: string,
  imageUrl: string,
  additionalContext?: string,
  learningContext?: string,
): Promise<AnalysisResult> {
  const model = "gemini-2.0-flash";
  const systemPrompt = getVerifiedSystemPrompt(additionalContext, learningContext) +
    `\n\nReturn ONLY valid JSON (no markdown). Use this exact structure:
{"title":"...", "brand":"...", "model":"...", "category":"...", "color":"...", "condition":"Good", "conditionScore":7, "extractedText":"...", "barcode":null, "marketReport":{"lowPrice":0, "medianPrice":0, "highPrice":0, "avgDaysToSell":14, "priceTrend":"stable", "trendPercentage":0, "confidenceScore":50, "bestMarketplace":"eBay", "suggestedPrice":0, "listingType":"fixed", "bestDayToList":"Sunday", "suggestedTitle":"...", "suggestedDescription":"...", "suggestedKeywords":[], "shippingRecommendation":"Standard shipping", "soldComparables":[], "dataSources":{"ebay":null, "amazon":null, "etsy":null}}}`;

  const requestBody: {
    contents: Array<{ parts: Array<Record<string, unknown>> }>;
    system_instruction: { parts: Array<{ text: string }> };
    generation_config: Record<string, unknown>;
  } = {
    contents: [
      {
        parts: [
          { text: "Analyze this item for resale pricing and identification. Return ONLY valid JSON." },
        ],
      },
    ],
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    generation_config: {
      max_output_tokens: 2048,
      temperature: 0.4,
    },
  };

  if (imageUrl.startsWith("data:")) {
    const mimeMatch = imageUrl.match(/^data:(image\/\w+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = imageUrl.split(",")[1];
    requestBody.contents[0].parts.push({
      inline_data: { mime_type: mimeType, data: base64Data },
    });
  } else {
    requestBody.contents[0].parts.push({
      file_data: { mime_type: "image/jpeg", file_uri: imageUrl },
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI service error (${response.status}): ${errText.substring(0, 200)}`);
  }

  const data = JSON.parse(await response.text());
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Empty response from AI service");

  let parsed: unknown;
  try {
    let jsonStr = content;
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1];
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("AI returned invalid JSON — please try again");
  }

  const normalised = normaliseAnalysis(parsed);
  if (!normalised) {
    throw new Error("AI returned an incomplete analysis — please try again");
  }

  return clampMarketValues(normalised);
}

/**
 * Fallback: call via OpenRouter when Gemini direct is unavailable.
 * Uses the same model (gemini-2.0-flash) through OpenRouter's paid infra,
 * which avoids Google's free-tier rate limits.
 */
async function callAIViaOpenRouter(
  openRouterKey: string,
  imageUrl: string,
  additionalContext?: string,
  learningContext?: string,
): Promise<AnalysisResult> {
  console.log("Attempting OpenRouter fallback (google/gemini-2.0-flash-001)...");
  const systemPrompt = getVerifiedSystemPrompt(additionalContext, learningContext) +
    `\n\nReturn ONLY valid JSON (no markdown). Use this exact structure:
{"title":"...", "brand":"...", "model":"...", "category":"...", "color":"...", "condition":"Good", "conditionScore":7, "extractedText":"...", "barcode":null, "marketReport":{"lowPrice":0, "medianPrice":0, "highPrice":0, "avgDaysToSell":14, "priceTrend":"stable", "trendPercentage":0, "confidenceScore":50, "bestMarketplace":"eBay", "suggestedPrice":0, "listingType":"fixed", "bestDayToList":"Sunday", "suggestedTitle":"...", "suggestedDescription":"...", "suggestedKeywords":[], "shippingRecommendation":"Standard shipping", "soldComparables":[], "dataSources":{"ebay":null, "amazon":null, "etsy":null}}}`;

  // Build the image content part for OpenRouter (OpenAI-compatible format)
  let imageContent: Record<string, unknown>;
  if (imageUrl.startsWith("data:")) {
    imageContent = { type: "image_url", image_url: { url: imageUrl } };
  } else {
    imageContent = { type: "image_url", image_url: { url: imageUrl } };
  }

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
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this item for resale pricing and identification. Return ONLY valid JSON." },
            imageContent,
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`OpenRouter API Error (${response.status}): ${errText.substring(0, 500)}`);
    throw new Error(`OpenRouter fallback failed (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter fallback");

  console.log("Got content from OpenRouter, parsing...");

  let parsed: unknown;
  try {
    let jsonStr = content;
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1];
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("OpenRouter returned invalid JSON");
  }

  const normalised = normaliseAnalysis(parsed);
  if (!normalised) {
    throw new Error("OpenRouter returned incomplete analysis");
  }

  return clampMarketValues(normalised);
}

/* =========================
   HTTP Handler
========================= */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    // Authenticate user
    const authResult = await authenticateUser(req);
    console.log(
      authResult.userId
        ? `Authenticated user: ${authResult.userId}`
        : "Analyze-item continuing without verified user context",
    );

    const body = await req.json();
    const { image, imageBase64, imageUrl, additionalContext } = body;

    // Input validation - size limits
    const MAX_BASE64_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_CONTEXT_LENGTH = 500;

    if (imageBase64 && imageBase64.length > MAX_BASE64_SIZE * 1.37) { // Base64 is ~37% larger
      return new Response(
        JSON.stringify({ error: "Image too large (max 5MB)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Sanitize additional context
    const safeContext = additionalContext
      ? String(additionalContext).trim().substring(0, MAX_CONTEXT_LENGTH).replace(/[<>]/g, '')
      : undefined;

    const imageData =
      image ||
      (imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl);

    // Validate image format
    if (
      !imageData ||
      (!imageData.startsWith("data:image") &&
        !imageData.startsWith("http"))
    ) {
      return new Response(
        JSON.stringify({ error: "Valid image is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // URL domain validation for external images
    if (imageData.startsWith("http")) {
      try {
        const url = new URL(imageData);
        const ALLOWED_DOMAINS = ['supabase.co', 'storage.googleapis.com', 'localhost'];
        const isAllowed = ALLOWED_DOMAINS.some(domain => url.hostname.endsWith(domain));
        if (!isAllowed) {
          console.warn(`External URL from non-whitelisted domain: ${url.hostname}`);
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid image URL" }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const apiKey =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ??
      Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "AI service not configured. Set GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY in Supabase function secrets.",
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get cached learning context (non-blocking refresh)
    const learningContext = getLearningContext();
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

    let result: AnalysisResult;
    try {
      result = await callAI(apiKey, imageData, safeContext, learningContext);
    } catch (geminiError) {
      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.warn(`Gemini direct failed: ${geminiMsg}`);

      // Fallback to OpenRouter if available
      if (openRouterKey) {
        console.log("Falling back to OpenRouter...");
        result = await callAIViaOpenRouter(openRouterKey, imageData, safeContext, learningContext);
      } else {
        console.error("No OPENROUTER_API_KEY set — cannot fallback. Re-throwing Gemini error.");
        throw geminiError;
      }
    }
    const marketSearchQuery = buildMarketplaceSearchQuery(result);
    let verificationStatus: "verified" | "manual_required" = "manual_required";
    let verificationSource: string | null = null;
    let verificationMessage: string | null = "Insufficient Market Data - Manual Entry Required.";

    try {
      const verifiedMarketplaceData = await fetchVerifiedMarketplaceData(marketSearchQuery);
      result = applyVerifiedMarketplaceData(result, verifiedMarketplaceData);

      if (result.marketReport.soldComparables.length > 0) {
        verificationStatus = "verified";
        verificationSource = verifiedMarketplaceData.connector ?? "scrapingbee";
        verificationMessage = null;
      } else {
        result = markMarketDataManualRequired(result);
      }
    } catch (verificationError) {
      const message = verificationError instanceof Error
        ? verificationError.message
        : "Marketplace verification failed.";
      result = markMarketDataManualRequired(result);
      verificationMessage = message.startsWith("Insufficient Market Data - Manual Entry Required.")
        ? message
        : `Insufficient Market Data - Manual Entry Required. ${message}`;
    }

    const verifiedCompsCount = verificationStatus === "verified"
      ? result.marketReport.dataSources.ebay?.listings ?? result.marketReport.soldComparables.length
      : 0;

    return new Response(
      JSON.stringify({
        analysis: {
          title: result.title,
          brand: result.brand,
          model: result.model,
          category: result.category,
          color: result.color,
          condition: result.condition,
          condition_score: result.conditionScore,
          extracted_text: result.extractedText,
          barcode: result.barcode,
        },
        marketReport: {
          low_price: verificationStatus === "verified" ? result.marketReport.lowPrice : null,
          median_price: verificationStatus === "verified" ? result.marketReport.medianPrice : null,
          high_price: verificationStatus === "verified" ? result.marketReport.highPrice : null,
          avg_days_to_sell: verificationStatus === "verified" && result.marketReport.avgDaysToSell > 0
            ? result.marketReport.avgDaysToSell
            : null,
          price_trend: null,
          trend_percentage: null,
          confidence_score: verificationStatus === "verified" ? result.marketReport.confidenceScore : null,
          best_marketplace: verificationStatus === "verified" ? result.marketReport.bestMarketplace : null,
          suggested_price: verificationStatus === "verified" ? result.marketReport.suggestedPrice : null,
          listing_type: verificationStatus === "verified" ? result.marketReport.listingType : null,
          best_day_to_list: verificationStatus === "verified" ? result.marketReport.bestDayToList : null,
          suggested_title: verificationStatus === "verified" ? result.marketReport.suggestedTitle : null,
          suggested_description: verificationStatus === "verified" ? result.marketReport.suggestedDescription : null,
          suggested_keywords: verificationStatus === "verified" ? result.marketReport.suggestedKeywords : [],
          shipping_recommendation: verificationStatus === "verified" ? result.marketReport.shippingRecommendation : null,
          data_sources: verificationStatus === "verified" ? result.marketReport.dataSources : {},
          sold_comparables: result.marketReport.soldComparables,
          verification_status: verificationStatus,
          verification_source: verificationSource,
          verification_message: verificationMessage,
          verified_comps_count: verifiedCompsCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in analyze-item function:", errorMsg);

    // Return user-friendly error messages
    let userMessage = errorMsg;
    if (errorMsg.includes("JSON") || errorMsg.includes("parse")) {
      userMessage = "The AI service returned an unexpected response. Please try again.";
    } else if (errorMsg.includes("SAFETY")) {
      userMessage = "This image couldn't be processed. Please try a different photo.";
    } else if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limited")) {
      userMessage = "AI service is temporarily busy. Please wait a moment and try again.";
    } else if (errorMsg.includes("503") || errorMsg.includes("529") || errorMsg.includes("unavailable")) {
      userMessage = "AI service is temporarily overloaded. Please wait 30 seconds and try again.";
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: corsHeaders }
    );
  }
});
