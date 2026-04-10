import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SoldComparable {
  title: string;
  price: number;
  marketplace: "eBay";
  condition: string;
  timeframe: string;
  url?: string;
}

interface MarketplaceStats {
  lowPrice: number;
  medianPrice: number;
  highPrice: number;
  avgPrice: number;
  listingsCount: number;
}

class MarketplaceScrapeError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "MarketplaceScrapeError";
    this.code = code;
    this.status = status;
  }
}

const sanitizeSearchQuery = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 200);
};

const parseMarketPrice = (value: string | null | undefined) => {
  if (!value) return null;
  const numeric = value.replace(/[^0-9.]/g, "");
  if (!numeric) return null;
  const parsed = Number.parseFloat(numeric);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const validateComparable = (comparable: SoldComparable) => {
  if (!comparable.title.trim()) return false;
  if (!Number.isFinite(comparable.price) || comparable.price <= 0) return false;
  if (comparable.url && !comparable.url.startsWith("http")) return false;
  return true;
};

const textFromFirst = (row: Element, selectors: string[]) => {
  for (const selector of selectors) {
    const value = row.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return "";
};

const hrefFromFirst = (row: Element, selectors: string[]) => {
  for (const selector of selectors) {
    const href = row.querySelector(selector)?.getAttribute("href");
    if (href) return href;
  }
  return undefined;
};

const normalizeComparableText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/Opens in a new window or tab$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const collectComparableFromRow = (row: Element, comparables: SoldComparable[]) => {
  const rowText = row.textContent?.toLowerCase() || "";
  if (rowText.includes("sponsored")) return;

  const title = normalizeComparableText(textFromFirst(row, [".s-item__title", ".s-card__title"]));
  const priceText = normalizeComparableText(textFromFirst(row, [
    ".s-item__price .POSITIVE",
    ".s-item__price",
    ".s-card__price",
  ]));
  const url = hrefFromFirst(row, ["a.s-item__link", "a.s-card__link"]);
  const subtitle = normalizeComparableText(textFromFirst(row, [".s-item__subtitle", ".s-card__subtitle"]));

  if (!title || title === "Shop on eBay") return;

  const price = parseMarketPrice(priceText);
  if (!price) return;

  const comparable: SoldComparable = {
    title,
    price,
    marketplace: "eBay",
    condition: subtitle || "Used",
    timeframe: "Completed sale",
    url,
  };

  if (validateComparable(comparable)) {
    comparables.push(comparable);
  }
};

const extractComparablesFromRowBlocks = (html: string) => {
  const rowBlocks = html.match(/<li[^>]*class="[^"]*(?:s-card|s-item)[^"]*"[\s\S]*?<\/li>/g) ?? [];
  const comparables: SoldComparable[] = [];

  for (const rowBlock of rowBlocks) {
    const rowDoc = new DOMParser().parseFromString(rowBlock, "text/html");
    const row = rowDoc?.querySelector("li, div, body");
    if (!row) continue;
    collectComparableFromRow(row, comparables);
  }

  return comparables;
};

const extractVerifiedComparables = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) {
    throw new MarketplaceScrapeError(
      "Schema drift: Unable to parse eBay response HTML.",
      "schema_drift",
      502,
    );
  }

  const rows = Array.from(doc.querySelectorAll("li.s-item, li.s-card, div.s-card"));
  const comparables: SoldComparable[] = [];

  for (const row of rows) {
    collectComparableFromRow(row, comparables);
  }

  if (comparables.length === 0) {
    comparables.push(...extractComparablesFromRowBlocks(html));
  }

  if (comparables.length === 0) {
    throw new MarketplaceScrapeError(
      "Insufficient Market Data - Manual Entry Required.",
      "no_market_data",
      404,
    );
  }

  return comparables;
};

const hashQuery = async (query: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(query);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { searchQuery } = await req.json();
    const normalizedSearchQuery = sanitizeSearchQuery(searchQuery);

    if (!normalizedSearchQuery) {
      throw new MarketplaceScrapeError(
        "A non-empty searchQuery is required.",
        "invalid_input",
        400,
      );
    }

    // SHA-256 hash the query for cache key
    const queryHash = await hashQuery(normalizedSearchQuery);

    // Check cache
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cached } = await supabase
      .from("marketplace_cache")
      .select("results_json")
      .eq("query_hash", queryHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ ...cached.results_json, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scrapingBeeKey = Deno.env.get("SCRAPINGBEE_API_KEY");
    if (!scrapingBeeKey) {
      throw new MarketplaceScrapeError(
        "SCRAPINGBEE_API_KEY is not configured.",
        "configuration_error",
        500,
      );
    }

    const ebayUrl = `https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(
      normalizedSearchQuery,
    )}&_LH_Sold=1&_LH_Complete=1`;
    const targetUrl = encodeURIComponent(ebayUrl);
    const agentUrl =
      `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${targetUrl}&render_js=true&premium_proxy=true`;

    const response = await fetch(agentUrl);
    if (!response.ok) {
      throw new MarketplaceScrapeError(
        `ScrapingBee request failed with status ${response.status}.`,
        "upstream_error",
        502,
      );
    }

    const html = await response.text();
    const allVerifiedComparables = extractVerifiedComparables(html);
    const soldComparables = allVerifiedComparables.slice(0, 12);
    const verifiedPrices = allVerifiedComparables.map((comparable) => comparable.price);
    const stats: MarketplaceStats = {
      lowPrice: Math.min(...verifiedPrices),
      medianPrice: median(verifiedPrices),
      highPrice: Math.max(...verifiedPrices),
      avgPrice: verifiedPrices.reduce((sum, price) => sum + price, 0) / verifiedPrices.length,
      listingsCount: allVerifiedComparables.length,
    };

    const resultsPayload = {
      success: true,
      connector: "scrapingbee",
      query: normalizedSearchQuery,
      verified_prices: verifiedPrices,
      sold_comparables: soldComparables,
      listings: soldComparables,
      stats,
      sample_count: soldComparables.length,
    };

    // Upsert into cache — fire and forget, don't block response
    supabase.from("marketplace_cache").upsert({
      query_hash: queryHash,
      search_query: normalizedSearchQuery,
      results_json: resultsPayload,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).then(() => {}).catch(() => {});

    return new Response(
      JSON.stringify(resultsPayload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scrape marketplace data.";
    const code = error instanceof MarketplaceScrapeError ? error.code : "unknown_error";
    const status = error instanceof MarketplaceScrapeError ? error.status : 400;
    return new Response(
      JSON.stringify({ success: false, error: message, code }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
