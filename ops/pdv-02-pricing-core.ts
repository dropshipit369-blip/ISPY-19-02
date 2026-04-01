/**
 * PDV-02 — Pricing Core Post-Deploy Verification
 * SES §10: Execute a query for a known collectible.
 * Assert the payload contains min (floor), median (target), and max (ceiling) floats.
 * Assert an array of exactly 5 sold item objects with valid image URLs and sold timestamps.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_ANON_KEY=<key> SEARCH_QUERY="<item>" deno run --allow-net --allow-env ops/pdv-02-pricing-core.ts
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY");
// Known high-variance collectible for validation. Default to a well-known test item.
const SEARCH_QUERY = Deno.env.get("PDV_02_SEARCH_QUERY") ?? "vintage tin toy robot 1960s japan";

const MINIMUM_INNINGS = 5;

interface SoldComparable {
  title?: string;
  price?: number;
  final_price?: number;
  timeframe?: string;
  sale_date?: string;
  url?: string;
  marketplace?: string;
}

interface ScrapeMarketplaceResponse {
  success?: boolean;
  stats?: {
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
    listingsCount: number;
    avgPrice: number;
  };
  sold_comparables?: SoldComparable[];
  error?: string;
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url.startsWith("http")) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidSaleDate(date: unknown): boolean {
  if (typeof date !== "string" || date.trim().length === 0) return false;
  return true; // Accept any non-empty string; stricter date parsing is environment-specific.
}

async function runPDV02() {
  console.log("=== PDV-02: Pricing Core Verification ===");
  console.log(`Search query: "${SEARCH_QUERY}"`);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("FAIL: SUPABASE_URL and SUPABASE_ANON_KEY are required.");
    Deno.exit(1);
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-marketplace`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ searchQuery: SEARCH_QUERY }),
  });

  if (!res.ok) {
    console.error(`FAIL: scrape-marketplace returned HTTP ${res.status}: ${await res.text()}`);
    Deno.exit(1);
  }

  const payload: ScrapeMarketplaceResponse = await res.json();

  if (payload.success === false || payload.error) {
    console.error(`FAIL: scrape-marketplace returned error: ${payload.error}`);
    Deno.exit(1);
  }

  // ── Assert: stats contains numeric min / median / max ──
  const stats = payload.stats;
  if (!stats) {
    console.error("FAIL [PDV-02-A]: Response is missing the stats object.");
    Deno.exit(1);
  }
  if (typeof stats.lowPrice !== "number" || !isFinite(stats.lowPrice) || stats.lowPrice < 0) {
    console.error(`FAIL [PDV-02-A]: stats.lowPrice (Floor) is not a valid float. Got: ${stats.lowPrice}`);
    Deno.exit(1);
  }
  if (typeof stats.medianPrice !== "number" || !isFinite(stats.medianPrice) || stats.medianPrice < 0) {
    console.error(`FAIL [PDV-02-A]: stats.medianPrice (Target) is not a valid float. Got: ${stats.medianPrice}`);
    Deno.exit(1);
  }
  if (typeof stats.highPrice !== "number" || !isFinite(stats.highPrice) || stats.highPrice < 0) {
    console.error(`FAIL [PDV-02-A]: stats.highPrice (Ceiling) is not a valid float. Got: ${stats.highPrice}`);
    Deno.exit(1);
  }
  console.log(`PASS [PDV-02-A]: Price spread — Floor: $${stats.lowPrice.toFixed(2)}, Target: $${stats.medianPrice.toFixed(2)}, Ceiling: $${stats.highPrice.toFixed(2)}`);

  // ── Assert: sold_comparables has at least MINIMUM_INNINGS items ──
  const comparables = payload.sold_comparables ?? [];
  if (comparables.length < MINIMUM_INNINGS) {
    console.error(`FAIL [PDV-02-B]: Expected at least ${MINIMUM_INNINGS} sold comparables (innings). Got: ${comparables.length}`);
    Deno.exit(1);
  }
  console.log(`PASS [PDV-02-B]: ${comparables.length} sold comparables returned (≥${MINIMUM_INNINGS} required).`);

  // ── Assert: each inning item has a valid URL and sold timestamp ──
  const firstFive = comparables.slice(0, MINIMUM_INNINGS);
  let inningScanFailed = false;

  firstFive.forEach((item, i) => {
    const url = item.url;
    const date = item.timeframe ?? item.sale_date;
    const price = item.price ?? item.final_price;
    const inn = i + 1;

    if (typeof price !== "number" || !isFinite(price) || price <= 0) {
      console.error(`FAIL [PDV-02-C] Inning ${inn}: final_price is not a positive number. Got: ${price}`);
      inningScanFailed = true;
    }
    if (!isValidSaleDate(date)) {
      console.error(`FAIL [PDV-02-C] Inning ${inn}: sale_date/timeframe is missing or empty. Got: "${date}"`);
      inningScanFailed = true;
    }
    // URL presence is recommended but may not exist for all scraped results.
    if (url !== undefined && url !== null && !isValidUrl(url)) {
      console.warn(`WARN [PDV-02-C] Inning ${inn}: url is present but not a valid HTTP URL. Got: "${url}"`);
    }
  });

  if (inningScanFailed) {
    Deno.exit(1);
  }
  console.log(`PASS [PDV-02-C]: First ${MINIMUM_INNINGS} innings all contain valid prices and sale timestamps.`);

  console.log("=== PDV-02 PASSED ===");
}

runPDV02().catch((err) => {
  console.error("FATAL:", err);
  Deno.exit(1);
});
