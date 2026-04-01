
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ItemAnalysis {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  conditionScore: number;
  extractedText: string | null;
  marketReport: {
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
    avgDaysToSell: number;
    priceTrend: string;
    trendPercentage: number;
    confidenceScore: number;
    bestMarketplace: string;
    suggestedPrice: number;
    listingType: string;
    bestDayToList: string;
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedKeywords: string[];
    shippingRecommendation: string;
    dataSources: {
      ebay?: { listings: number; avgPrice: number } | null;
      amazon?: { listings: number; avgPrice: number } | null;
      etsy?: { listings: number; avgPrice: number } | null;
    };
  };
}

interface LotAnalysisResult {
  items: ItemAnalysis[];
  totalItems: number;
}

type JsonRecord = Record<string, unknown>;

const ANALYZE_LOT_BUILD = "2026-02-19-1";

/* =========================
   Authentication Helper
========================= */
async function authenticateUser(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Authentication required", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Server configuration error", status: 500 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { error: "Invalid authentication", status: 401 };
  }

  return { userId: data.user.id };
}

/** Force a value to a finite number. */
function safeNum(val: unknown, fallback: number): number {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") { const n = Number(val); if (Number.isFinite(n)) return n; }
  return fallback;
}

/** Force a value to a string or null. */
function safeStr(val: unknown, fallback: string | null = null): string | null {
  if (typeof val === "string" && val.trim().length > 0) return val.trim();
  return fallback;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" ? (value as JsonRecord) : null;
}

/** Normalise a single lot item from Gemini's output. */
function normaliseItem(raw: unknown): ItemAnalysis | null {
  const rawRecord = asRecord(raw);
  if (!rawRecord) return null;
  const title = safeStr(rawRecord.title) ?? safeStr(rawRecord.name) ?? safeStr(rawRecord.item);
  if (!title) return null;

  const mr = asRecord(rawRecord.marketReport ?? rawRecord.market_report ?? rawRecord.market);
  if (!mr) return null;

  const medianPrice = safeNum(mr.medianPrice ?? mr.median_price ?? mr.suggestedPrice ?? mr.suggested_price ?? mr.price, 0);
  const lowPrice = safeNum(mr.lowPrice ?? mr.low_price ?? mr.low, Math.max(1, medianPrice * 0.6));
  const highPrice = safeNum(mr.highPrice ?? mr.high_price ?? mr.high, medianPrice * 1.5);

  if (medianPrice <= 0 && lowPrice <= 0 && highPrice <= 0) return null;

  let priceTrend = "stable";
  const rt = String(mr.priceTrend ?? mr.price_trend ?? "stable").toLowerCase();
  if (rt.includes("up")) priceTrend = "up";
  else if (rt.includes("down")) priceTrend = "down";

  let listingType = "fixed";
  const rl = String(mr.listingType ?? mr.listing_type ?? "fixed").toLowerCase();
  if (rl.includes("auction")) listingType = "auction";

  const rawCondition = safeStr(rawRecord.condition) ?? "Good";
  const validConditions = ["New", "Like New", "Very Good", "Good", "Fair", "Poor"];
  const condition = validConditions.find(c => c.toLowerCase() === rawCondition.toLowerCase()) ?? "Good";

  let suggestedKeywords: string[] = [];
  const rk = mr.suggestedKeywords ?? mr.suggested_keywords ?? mr.keywords;
  if (Array.isArray(rk)) suggestedKeywords = rk.filter((k): k is string => typeof k === "string").slice(0, 20);

  const normSource = (source: unknown) => {
    const sourceRecord = asRecord(source);
    if (!sourceRecord || typeof sourceRecord.listings !== "number") return null;
    return {
      listings: sourceRecord.listings,
      avgPrice: safeNum(sourceRecord.avgPrice ?? sourceRecord.avg_price, 0),
    };
  };
  const rawSources = asRecord(mr.dataSources ?? mr.data_sources) ?? {};

  return {
    title,
    brand: safeStr(rawRecord.brand),
    model: safeStr(rawRecord.model),
    category: safeStr(rawRecord.category) ?? "General",
    color: safeStr(rawRecord.color),
    condition,
    conditionScore: safeNum(rawRecord.conditionScore ?? rawRecord.condition_score, 70),
    extractedText: safeStr(rawRecord.extractedText ?? rawRecord.extracted_text),
    marketReport: {
      lowPrice: Math.max(1, lowPrice),
      medianPrice: Math.max(1, medianPrice),
      highPrice: Math.max(1, highPrice),
      avgDaysToSell: safeNum(mr.avgDaysToSell ?? mr.avg_days_to_sell, 14),
      priceTrend,
      trendPercentage: safeNum(mr.trendPercentage ?? mr.trend_percentage, 0),
      confidenceScore: Math.min(100, Math.max(0, safeNum(mr.confidenceScore ?? mr.confidence_score, 50))),
      bestMarketplace: safeStr(mr.bestMarketplace ?? mr.best_marketplace) ?? "eBay",
      suggestedPrice: Math.max(1, safeNum(mr.suggestedPrice ?? mr.suggested_price, medianPrice)),
      listingType,
      bestDayToList: safeStr(mr.bestDayToList ?? mr.best_day_to_list) ?? "Sunday",
      suggestedTitle: safeStr(mr.suggestedTitle ?? mr.suggested_title) ?? title,
      suggestedDescription: safeStr(mr.suggestedDescription ?? mr.suggested_description) ?? "",
      suggestedKeywords,
      shippingRecommendation: safeStr(mr.shippingRecommendation ?? mr.shipping_recommendation) ?? "Standard shipping",
      dataSources: {
        ebay: normSource(rawSources.ebay),
        amazon: normSource(rawSources.amazon),
        etsy: normSource(rawSources.etsy),
      },
    },
  };
}

/** Normalise the full lot response. */
function normaliseLotAnalysis(raw: unknown): LotAnalysisResult | null {
  const rawRecord = asRecord(raw);
  if (!rawRecord && !Array.isArray(raw)) return null;
  const rawItems = rawRecord?.items ?? rawRecord?.results ?? (Array.isArray(raw) ? raw : null);
  if (!Array.isArray(rawItems) || rawItems.length === 0) return null;
  const items = rawItems.map(normaliseItem).filter(Boolean) as ItemAnalysis[];
  if (items.length === 0) return null;
  return { items, totalItems: items.length };
}

function clampMarketValues(item: ItemAnalysis): ItemAnalysis {
  const m = item.marketReport;
  m.lowPrice = Math.max(1, m.lowPrice);
  m.medianPrice = Math.max(m.lowPrice, m.medianPrice);
  m.highPrice = Math.max(m.medianPrice, m.highPrice);
  m.confidenceScore = Math.min(100, Math.max(0, m.confidenceScore));

  if (!item.brand && !item.extractedText) {
    m.confidenceScore = Math.max(10, m.confidenceScore - 30);
  }

  return item;
}

const getSystemPrompt = () => `Analyze ALL items for resale. Return JSON only:
{"items":[{"title":"Item Name","brand":null,"model":null,"category":"Category","color":null,"condition":"Good","conditionScore":70,"extractedText":null,"marketReport":{"lowPrice":10,"medianPrice":20,"highPrice":30,"avgDaysToSell":7,"priceTrend":"stable","trendPercentage":0,"confidenceScore":75,"bestMarketplace":"eBay","suggestedPrice":20,"listingType":"fixed","bestDayToList":"Sunday","suggestedTitle":"Title","suggestedDescription":"Description","suggestedKeywords":["keyword"],"shippingRecommendation":"USPS","dataSources":{"ebay":{"listings":10,"avgPrice":20},"amazon":null,"etsy":null}}}],"totalItems":1}

Rules: Resale prices only, skip junk, identify ALL distinct sellable items.`;

async function callAI(
  apiKey: string,
  imageUrl: string,
  retries = 3
): Promise<LotAnalysisResult> {
  // Use Gemini 2.0 Flash
  const model = "gemini-2.0-flash";
  const systemPrompt = getSystemPrompt();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const backoffMs = Math.min(500 * Math.pow(2, attempt), 3000);

    try {
      console.log(`Attempt ${attempt + 1}/${retries} using model: ${model}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

      // Prepare image part
      let imagePart: Record<string, unknown>;

      if (imageUrl.startsWith("data:")) {
        // Base64 data URI
        const base64Data = imageUrl.split(",")[1];
        const mimeType = imageUrl.match(/data:([^;]+)/)?.[1] || "image/jpeg";
        imagePart = {
          inline_data: {
            mime_type: mimeType,
            data: base64Data,
          },
        };
      } else {
        // URL reference
        imagePart = {
          file_data: {
            mime_type: "image/jpeg",
            file_uri: imageUrl,
          },
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: {
                text: systemPrompt,
              },
            },
            contents: [
              {
                parts: [
                  { text: "Analyze all items in this image for resale value." },
                  imagePart,
                ],
              },
            ],
            generation_config: {
              max_output_tokens: 3000,
              temperature: 0.3,
              response_mime_type: "application/json",
            },
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`HTTP ${response.status}: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      let content =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.choices?.[0]?.message?.content;

      if (!content || content.trim() === "") {
        console.error("Empty content received from AI");
        throw new Error("Empty AI response - retrying with different model");
      }

      // Clean up the response
      content = content.trim();
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) content = fenced[1].trim();

      // Try to fix common JSON issues
      content = content.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Could not parse AI response as JSON");
      }
      const normalised = normaliseLotAnalysis(parsed);
      if (!normalised) {
        console.error("Normalisation failed:", JSON.stringify(parsed).slice(0, 300));
        throw new Error("AI returned an incomplete lot analysis — please try again");
      }

      console.log(`Successfully analyzed ${normalised.items.length} items`);
      return {
        items: normalised.items.map(clampMarketValues),
        totalItems: normalised.items.length
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Attempt ${attempt + 1} failed:`, lastError.message);

      if (attempt < retries - 1) {
        console.log(`Waiting ${backoffMs}ms before retry...`);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  throw lastError || new Error("Lot analysis failed after all retries");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    // Authenticate user
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: corsHeaders }
      );
    }

    console.log(`Authenticated user: ${authResult.userId}`);

    const { image, imageBase64, imageUrl } = await req.json();

    const imageData =
      image ||
      (imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : imageUrl);

    const MAX_BASE64_SIZE = 4 * 1024 * 1024; // 4MB source image budget
    const MAX_DATA_URL_SIZE = Math.floor(MAX_BASE64_SIZE * 1.37);

    if (imageBase64 && imageBase64.length > MAX_DATA_URL_SIZE) {
      return new Response(
        JSON.stringify({
          error:
            "Lot image is too large for analysis on this plan/device. Try a lower-resolution photo or crop to fewer items.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

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

    if (imageData.startsWith("data:") && imageData.length > MAX_DATA_URL_SIZE) {
      return new Response(
        JSON.stringify({
          error:
            "Lot image payload is too large. Use a closer shot with fewer items or reduce photo resolution.",
        }),
        { status: 400, headers: corsHeaders }
      );
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

    console.log(`Analyzing lot image for multiple items... build=${ANALYZE_LOT_BUILD}`);

    const result = await callAI(apiKey, imageData);

    const formattedItems = result.items.map((item) => ({
      analysis: {
        title: item.title,
        brand: item.brand,
        model: item.model,
        category: item.category,
        color: item.color,
        condition: item.condition,
        condition_score: item.conditionScore,
        extracted_text: item.extractedText,
      },
      marketReport: {
        low_price: item.marketReport.lowPrice,
        median_price: item.marketReport.medianPrice,
        high_price: item.marketReport.highPrice,
        avg_days_to_sell: item.marketReport.avgDaysToSell,
        price_trend: item.marketReport.priceTrend,
        trend_percentage: item.marketReport.trendPercentage,
        confidence_score: item.marketReport.confidenceScore,
        best_marketplace: item.marketReport.bestMarketplace,
        suggested_price: item.marketReport.suggestedPrice,
        listing_type: item.marketReport.listingType,
        best_day_to_list: item.marketReport.bestDayToList,
        suggested_title: item.marketReport.suggestedTitle,
        suggested_description: item.marketReport.suggestedDescription,
        suggested_keywords: item.marketReport.suggestedKeywords,
        shipping_recommendation: item.marketReport.shippingRecommendation,
        data_sources: item.marketReport.dataSources,
      },
    }));

    return new Response(
      JSON.stringify({
        items: formattedItems,
        totalItems: result.totalItems,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in analyze-lot function:", error);
    const rawMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const normalized = rawMessage.toLowerCase();
    const friendlyMessage =
      normalized.includes("memory") ||
        normalized.includes("resource exhausted") ||
        normalized.includes("payload") ||
        normalized.includes("too large")
        ? "Unable to complete lot analysis due to memory limits. Try a lower-resolution image or fewer items in frame."
        : rawMessage;
    return new Response(
      JSON.stringify({
        error: friendlyMessage,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
