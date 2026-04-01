
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketplaceStats {
  lowPrice: number;
  medianPrice: number;
  highPrice: number;
  avgPrice: number;
  listingsCount: number;
}

interface MarketplaceScrapeResult {
  listings: MarketplaceListing[];
  stats: MarketplaceStats | null;
  code?: string | null;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" ? (value as JsonRecord) : null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Optimized cache with longer TTL for better performance
const marketplaceCache = new Map<string, { data: MarketplaceScrapeResult; timestamp: number }>();
const CACHE_TTL = 120000; // 2 minute cache for faster repeated scans

interface MarketplaceListing {
  marketplace: string;
  title: string;
  price: number;
  condition: string;
  soldDate: string;
  url?: string;
}

/* =========================
   Authentication Helper
========================= */
async function authenticateUser(req: Request): Promise<{ userId: string; planType: string } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Authentication required", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
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

  // Check subscription status using service role
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: subscription } = await adminClient
    .from("user_subscriptions")
    .select("plan_type, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .single();

  const planType = subscription?.plan_type || "free";

  // Check scan usage for non-unlimited plans
  if (planType !== "unlimited") {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: usageData } = await adminClient
      .from("live_scan_usage")
      .select("scan_count")
      .eq("user_id", data.user.id)
      .eq("month_year", currentMonth)
      .single();

    const scansUsed = usageData?.scan_count || 0;
    const scansLimit = planType === "pro" ? 50 : 5; // Free gets 5, Pro gets 50

    if (scansUsed >= scansLimit) {
      const upgradeMsg = planType === "free"
        ? "You've used all 5 free live scans this month. Upgrade to Pro for 50 scans."
        : "You've used all 50 live scans this month. Upgrade to Unlimited for unlimited scans.";
      return { error: upgradeMsg, status: 402 };
    }
  }

  return { userId: data.user.id, planType };
}

function sanitizeSearchQuery(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
}

function buildMarketplaceSearchQuery(
  itemName: string,
  brand: string | null,
  model: string | null,
): string {
  return sanitizeSearchQuery([brand, itemName, model].filter(Boolean).join(" "));
}

// Scrape marketplace using the verified ScrapingBee-backed edge function
async function scrapeMarketplaceData(
  itemName: string,
  brand: string | null,
  model: string | null
): Promise<MarketplaceScrapeResult> {
  const searchQuery = buildMarketplaceSearchQuery(itemName, brand, model);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!searchQuery || !supabaseUrl || !serviceRoleKey) {
    console.log("Marketplace verification connector not configured, skipping scrape");
    return { listings: [], stats: null };
  }

  // Check cache
  const cacheKey = searchQuery.toLowerCase();
  const cached = marketplaceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log("Using cached marketplace data for:", searchQuery);
    return cached.data;
  }

  try {
    console.log("Verifying sold eBay comps for:", searchQuery);
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/scrape-marketplace`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ searchQuery }),
    });

    const responseText = await response.text();
    const payload = responseText ? JSON.parse(responseText) : {};
    if (!response.ok) {
      console.error("Marketplace verification error:", response.status, responseText);
      return {
        listings: [],
        stats: null,
        code: typeof payload.code === "string" ? payload.code : "unknown_error",
      };
    }

    const rawListings = Array.isArray(payload.sold_comparables)
      ? payload.sold_comparables
      : Array.isArray(payload.listings)
        ? payload.listings
        : [];
    const listings: MarketplaceListing[] = rawListings
      .map((listing) => {
        const listingRecord = asRecord(listing) ?? {};
        const title = optionalString(listingRecord.title);
        const price = Number(listingRecord.price);

        if (!title || !Number.isFinite(price) || price <= 0) {
          return null;
        }

        return {
          marketplace: optionalString(listingRecord.marketplace) ?? "eBay",
          title,
          price,
          condition: optionalString(listingRecord.condition) ?? "Good",
          soldDate: optionalString(listingRecord.soldDate ?? listingRecord.timeframe) ?? "Recently",
          url: optionalString(listingRecord.url) ?? undefined,
        };
      })
      .filter((listing): listing is MarketplaceListing => Boolean(listing));
    const stats = payload.stats && typeof payload.stats === "object"
      ? {
        lowPrice: Number(payload.stats.lowPrice) || 0,
        medianPrice: Number(payload.stats.medianPrice) || 0,
        highPrice: Number(payload.stats.highPrice) || 0,
        avgPrice: Number(payload.stats.avgPrice) || 0,
        listingsCount: Number(payload.stats.listingsCount) || listings.length,
      }
      : null;

    const result = { listings, stats, code: null };
    marketplaceCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error("Marketplace scrape error:", error);
    return { listings: [], stats: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    // Authenticate user and check subscription
    const authResult = await authenticateUser(req);
    if ("error" in authResult) {
      return new Response(
        JSON.stringify({ error: authResult.error, items: [] }),
        { status: authResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authenticated user: ${authResult.userId}, plan: ${authResult.planType}`);

    const body = await req.json();
    const { image, enableMarketplaceScrape = false, intent } = body;

    const INTENT_CONTEXT: Record<string, string> = {
      'toys-collectables': 'Focus on toys, action figures, LEGO sets, Funko Pops, board games, trading cards, vintage toys, and collectables. Look for set numbers, series names, character names, and edition details.',
      'clothing-vintage': 'Focus on clothing, fashion, and accessories. Look for brand labels, tags, size labels, designer names, vintage decade indicators, streetwear brands, and fabric details.',
      'shoes': 'Focus on footwear including sneakers, boots, heels, and athletic shoes. Look for brand logos, model names, colourways, size labels, and collaboration details.',
      'electronics': 'Focus on electronics, gadgets, and technology. Look for brand logos, model numbers, serial numbers, storage capacity, and generation/version details.',
      'bulk-mixed': 'Identify every individual resalable item visible. Scan broadly — toys, electronics, clothing, books, homewares, and anything else with resale value.',
      'military-medals': 'Focus on militaria, medals, badges, uniforms, insignia, and historical items. Look for regiment names, campaign medals, dates, rank insignia, and country of origin.',
      'books-media': 'Focus on books, vinyl records, CDs, DVDs, video games, and other media. Look for author, title, edition number, publisher, label, and any first-edition indicators.',
      'home-decor': 'Focus on homewares, furniture, decorative pieces, ceramics, glassware, and vintage household items. Look for maker\'s marks, pottery stamps, designer signatures, and material details.',
      'handmade-art': 'Focus on original artwork, sculptures, carvings, pottery, and handmade craft items. Look for artist signatures, medium, subject matter, and any provenance details.',
    };

    const intentInstruction = intent && INTENT_CONTEXT[intent as string]
      ? `\n\nCATEGORY FOCUS — The user has selected "${intent}". ${INTENT_CONTEXT[intent as string]} Prioritise items in this category and use precise, category-appropriate terminology.`
      : '';

    // Input validation
    if (!image) {
      return new Response(
        JSON.stringify({ error: "No image provided", items: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Size validation for base64 images (5MB limit)
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024 * 1.37; // ~6.85MB for base64
    if (image.startsWith("data:") && image.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: "Image too large (max 5MB)", items: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate image format
    if (!image.startsWith("data:image") && !image.startsWith("http")) {
      return new Response(
        JSON.stringify({ error: "Invalid image format", items: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ??
      Deno.env.get("GEMINI_API_KEY");
    if (!API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY not configured");

    console.log("Starting HIGH-PERFORMANCE live scan...");
    const startTime = Date.now();

    // ADVANCED AI PROMPT - Detailed vision analysis
    const prompt = `You are an expert resale appraiser and product historian with encyclopaedic knowledge of collectibles, electronics, fashion, footwear, antiques, books, militaria, and every major resale market worldwide.

ANALYZE this image with MAXIMUM PRECISION. Identify EVERY resalable item visible.${intentInstruction}

For EACH item, provide ALL of the following fields:
1. name — Exact specific product name (e.g. "Nike Air Jordan 1 Retro High OG Chicago 2015", not just "sneakers")
2. brand — Exact brand/label visible
3. model — Model number or sub-name if identifiable
4. manufacturer — Full company name that manufactured it (e.g. "Nintendo Co., Ltd.", "Sony Group Corporation")
5. category — One of: electronics/clothing/shoes/collectibles/furniture/toys/books/jewelry/sports/tools/home/other
6. condition — One of: new/like-new/good/fair/poor (based on visible wear)
7. rarity — One of: common/uncommon/rare/very-rare (based on market scarcity)
8. yearMade — Approximate year or decade (e.g. "2015", "1980s")
9. originStory — ONE sentence of fascinating context or history (max 20 words, makes the item feel special)
10. salesStrategy — ONE actionable selling tip (max 20 words, specific platform + key descriptor)
11. bestMarketplace — Best single platform to sell: eBay/StockX/Depop/Vinted/Etsy/Facebook/Amazon
12. optimalSearchTerms — Array of 3 exact search phrases buyers type (specific, high-converting)
13. boundingBox — Normalised coordinates 0.0–1.0: {x, y, width, height}
14. confidence — 0–100 based on identification certainty
15. trend — up/down/stable (current market demand direction)
16. lowPrice, medianPrice, highPrice — Set all to 0 (verified sold-market pricing added separately)

CRITICAL RULES:
- Be HYPER-SPECIFIC: "Sony WH-1000XM4 Wireless Headphones" not "headphones"; "LEGO Star Wars Millennium Falcon 75192" not "toy"
- Scan for ALL visible text, logos, colourways, serial/model numbers, edition marks, tags, stamps
- NEVER return persons, humans, animals, or body parts as items
- Skip packaging, trash, generic consumables with zero resale value
- optimalSearchTerms must be buyer search phrases, not descriptions

Return ONLY valid minified JSON (no markdown, no prose):
{"items":[{"key":"k1","name":"","brand":"","model":"","manufacturer":"","category":"","condition":"","rarity":"","yearMade":"","originStory":"","salesStrategy":"","bestMarketplace":"","optimalSearchTerms":[],"confidence":0,"trend":"stable","lowPrice":0,"medianPrice":0,"highPrice":0,"boundingBox":{"x":0.1,"y":0.1,"width":0.3,"height":0.4},"pricingSources":[]}]}`;

    // Call AI for item identification - Using Gemini 2.0 Flash

    // Prepare image part
      let imagePart: Record<string, unknown>;

    if (image.startsWith("data:")) {
      // Base64 data URI
      const base64Data = image.split(",")[1];
      const mimeType = image.match(/data:([^;]+)/)?.[1] || "image/jpeg";
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
          file_uri: image,
        },
      };
    }

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: { text: prompt } },
        contents: [{ parts: [imagePart] }],
        generation_config: {
          // Lower temperature → faster, more deterministic JSON output
          temperature: 0.1,
          // Enough tokens for 5 richly-described items without over-allocating
          max_output_tokens: 2400,
          // Force JSON-only output for reliable parsing
          response_mime_type: "application/json",
        },
      }),
    });

    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({
          error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage.",
          items: [],
          creditsExhausted: true,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!aiRes.ok) {
      const text = await aiRes.text();
      throw new Error(`AI error ${aiRes.status}: ${text}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse AI response
    let parsed: { items: unknown[] };
    try {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { items: [] };
    } catch {
      parsed = { items: [] };
    }

    if (!Array.isArray(parsed.items)) parsed.items = [];

    // Strip any items the AI mistakenly classified as living beings — these are
    // never valid resale items and cause the "says person instead of book" bug.
    const NON_RESALABLE_NAMES = /\b(person|human|man|woman|boy|girl|child|baby|people|animal|cat|dog|bird|fish)\b/i;
    parsed.items = parsed.items.filter((item) => {
      const rec = asRecord(item) ?? {};
      const name = typeof rec.name === 'string' ? rec.name : '';
      return !NON_RESALABLE_NAMES.test(name);
    });

    const parsedItems = parsed.items.map((item) => asRecord(item) ?? {});

    let marketplaceConnectorEnabled = Boolean(
      Deno.env.get("SUPABASE_URL") &&
      (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")),
    );
    const shouldScrape = enableMarketplaceScrape && marketplaceConnectorEnabled && parsedItems.length > 0;

    const applyManualPricing = (item: JsonRecord, message: string) => {
      item.lowPrice = 0;
      item.medianPrice = 0;
      item.highPrice = 0;
      item.avgDaysToSell = 0;
      item.pricingSources = [];
      item.marketplaceData = {
        source: null,
        verificationStatus: "manual_required",
        message,
      };
    };

    if (shouldScrape) {
      const scrapePromises = parsedItems.map(async (item) => {
        const itemName = optionalString(item.name) ?? "Unknown Item";
        try {
          // Prefer AI-generated optimal search terms for higher-precision pricing.
          // Fall back to the standard brand+name+model query if not available.
          const optimalTerms = Array.isArray(item.optimalSearchTerms) ? item.optimalSearchTerms : [];
          const primarySearchTerm = optionalString(optimalTerms[0]);
          const marketData = primarySearchTerm
            ? await scrapeMarketplaceData(primarySearchTerm, null, null)
            : await scrapeMarketplaceData(itemName, optionalString(item.brand), optionalString(item.model));
          return { item, marketData };
        } catch (err) {
          console.error("Scrape failed for:", itemName, err);
          return { item, marketData: { listings: [], stats: null } };
        }
      });

      const results = await Promise.allSettled(scrapePromises);

      results.forEach((result) => {
        if (result.status !== "fulfilled") return;

        const { item, marketData } = result.value;
        if (marketData.stats && marketData.listings.length > 0) {
          item.lowPrice = marketData.stats.lowPrice;
          item.medianPrice = marketData.stats.medianPrice;
          item.highPrice = marketData.stats.highPrice;
          item.avgDaysToSell = 14;
          item.pricingSources = marketData.listings.slice(0, 8);
          item.marketplaceData = {
            source: "scrapingbee",
            verificationStatus: "verified",
            listingsFound: marketData.stats.listingsCount,
            avgPrice: marketData.stats.avgPrice,
          };
        } else {
          if (marketData.code === "configuration_error") {
            marketplaceConnectorEnabled = false;
          }
          applyManualPricing(item, "Insufficient Market Data - Manual Entry Required.");
        }
      });
    } else {
      const message = enableMarketplaceScrape
        ? "Insufficient Market Data - Manual Entry Required. Marketplace verification connector is not configured."
        : "Insufficient Market Data - Manual Entry Required.";
      parsedItems.forEach((item) => applyManualPricing(item, message));
    }

    // Post-process all items for consistency
    const VALID_RARITY = new Set(["common", "uncommon", "rare", "very-rare"]);
    const VALID_MARKETPLACES = new Set(["eBay", "StockX", "Depop", "Vinted", "Etsy", "Facebook", "Amazon", "Grailed", "Poshmark"]);

    const normalizedItems = parsedItems.map((item, index: number) => {
      const itemName = optionalString(item.name) ?? "Unknown Item";
      const box = asRecord(item.boundingBox) ?? {};
      const trendCandidate = typeof item.trend === "string" ? item.trend : "";
      const trend = ["up", "down", "stable"].includes(trendCandidate) ? trendCandidate : "stable";
      const rarityCand = typeof item.rarity === "string" ? item.rarity.toLowerCase() : "";
      const rarity = VALID_RARITY.has(rarityCand) ? rarityCand : "common";
      const bestMarketplaceCand = optionalString(item.bestMarketplace) ?? "";
      const bestMarketplace = VALID_MARKETPLACES.has(bestMarketplaceCand) ? bestMarketplaceCand : null;
      const optimalSearchTerms = Array.isArray(item.optimalSearchTerms)
        ? (item.optimalSearchTerms as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 3)
        : [];

      return {
        key: optionalString(item.key) ?? `item-${index}-${Date.now()}`,
        name: itemName,
        brand: optionalString(item.brand),
        model: optionalString(item.model),
        manufacturer: optionalString(item.manufacturer),
        category: optionalString(item.category) ?? "General",
        condition: optionalString(item.condition) ?? "good",
        rarity,
        yearMade: optionalString(item.yearMade),
        originStory: optionalString(item.originStory),
        salesStrategy: optionalString(item.salesStrategy),
        bestMarketplace,
        optimalSearchTerms,
        lowPrice: Math.max(0, Number(item.lowPrice) || 0),
        medianPrice: Math.max(0, Number(item.medianPrice) || 0),
        highPrice: Math.max(0, Number(item.highPrice) || 0),
        avgDaysToSell: Math.max(0, Number(item.avgDaysToSell) || 0),
        confidence: Math.min(100, Math.max(0, Number(item.confidence) || 50)),
        trend,
        boundingBox: {
          x: Math.min(1, Math.max(0, Number(box.x) || 0.1)),
          y: Math.min(1, Math.max(0, Number(box.y) || 0.1)),
          width: Math.min(1, Math.max(0.05, Number(box.width) || 0.2)),
          height: Math.min(1, Math.max(0.05, Number(box.height) || 0.2)),
        },
        pricingSources: Array.isArray(item.pricingSources)
          ? item.pricingSources.slice(0, 5).map((source) => {
            const sourceRecord = asRecord(source) ?? {};
            return {
              marketplace: optionalString(sourceRecord.marketplace) ?? "eBay",
              title: optionalString(sourceRecord.title) ?? itemName,
              price: Math.max(0, Number(sourceRecord.price) || 0),
              condition: optionalString(sourceRecord.condition) ?? "Good",
              soldDate: optionalString(sourceRecord.soldDate) ?? "Recently",
              url: optionalString(sourceRecord.url) ?? undefined,
            };
          })
          : [],
        marketplaceData: asRecord(item.marketplaceData) ?? null,
      };
    });

    const duration = Date.now() - startTime;
    const scrapedCount = normalizedItems.filter(
      (item) => asRecord(item.marketplaceData)?.verificationStatus === "verified",
    ).length;
    console.log(`Detected ${normalizedItems.length} items (${scrapedCount} with marketplace data) in ${duration}ms`);

    return new Response(JSON.stringify({
      ...parsed,
      items: normalizedItems,
      marketplaceScrapeEnabled: marketplaceConnectorEnabled,
      scrapedItems: scrapedCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Live scan error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage, items: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
