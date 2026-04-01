/**
 * PDV-01 — Vision Core Post-Deploy Verification
 * SES §10: Ingest a tokenized production image of a wooden carving.
 * Assert the response returns "Art/Sculpture" category.
 * Assert it does NOT return "Elephant", "Dog", or any biological entity.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_ANON_KEY=<key> deno run --allow-net --allow-env ops/pdv-01-vision-core.ts
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY");
// Tokenized production image slug — resolved at runtime from the PDV asset store.
const TOKENIZED_IMAGE_TOKEN = Deno.env.get("PDV_01_IMAGE_TOKEN");

const BIOLOGICAL_ENTITY_LABELS = [
  "elephant", "dog", "cat", "bird", "horse", "animal", "fish",
  "plant", "flower", "tree", "insect", "bear", "lion", "tiger",
];

const EXPECTED_CATEGORIES = [
  "art", "sculpture", "handmade", "collectible", "decor", "figurine",
  "vintage", "antique", "carving",
];

interface AnalysisResponse {
  analysis?: {
    category?: string;
    title?: string;
  };
  error?: string;
}

async function fetchTokenizedImageDataUrl(token: string): Promise<string> {
  // In production: resolve token against the PDV asset store endpoint.
  // This endpoint returns a data-URI of the tokenized image slice.
  const url = `${SUPABASE_URL}/functions/v1/pdv-asset?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`PDV asset fetch failed (${res.status}): ${await res.text()}`);
  const { dataUrl } = await res.json();
  if (!dataUrl?.startsWith("data:image")) throw new Error("PDV asset did not return a valid data:image URL.");
  return dataUrl;
}

async function runPDV01() {
  console.log("=== PDV-01: Vision Core Verification ===");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("FAIL: SUPABASE_URL and SUPABASE_ANON_KEY are required.");
    Deno.exit(1);
  }

  if (!TOKENIZED_IMAGE_TOKEN) {
    console.error("FAIL: PDV_01_IMAGE_TOKEN is required. Set this env var to the tokenized wooden carving asset.");
    Deno.exit(1);
  }

  console.log("Fetching tokenized production image slice...");
  let imageDataUrl: string;
  try {
    imageDataUrl = await fetchTokenizedImageDataUrl(TOKENIZED_IMAGE_TOKEN);
  } catch (err) {
    console.error(`FAIL: Could not retrieve tokenized image — ${err instanceof Error ? err.message : err}`);
    Deno.exit(1);
  }

  console.log("Submitting to analyze-item endpoint...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!res.ok) {
    console.error(`FAIL: analyze-item returned HTTP ${res.status}: ${await res.text()}`);
    Deno.exit(1);
  }

  const payload: AnalysisResponse = await res.json();

  if (payload.error) {
    console.error(`FAIL: analyze-item returned error: ${payload.error}`);
    Deno.exit(1);
  }

  const category = (payload.analysis?.category ?? "").toLowerCase();
  const title = (payload.analysis?.title ?? "").toLowerCase();

  // Assert: category must be within the expected Art/Sculpture/Collectibles family
  const categoryPass = EXPECTED_CATEGORIES.some((c) => category.includes(c));
  if (!categoryPass) {
    console.error(`FAIL [PDV-01-A]: Expected category to be in [${EXPECTED_CATEGORIES.join(", ")}]. Got: "${payload.analysis?.category}"`);
    Deno.exit(1);
  }
  console.log(`PASS [PDV-01-A]: category="${payload.analysis?.category}" is within expected Art/Sculpture family.`);

  // Assert: neither category nor title must reference a biological entity
  const bioLabelFound = BIOLOGICAL_ENTITY_LABELS.find(
    (label) => category.includes(label) || title.includes(label),
  );
  if (bioLabelFound) {
    console.error(`FAIL [PDV-01-B]: Hallucinated biological entity detected — label "${bioLabelFound}" found in category="${payload.analysis?.category}" title="${payload.analysis?.title}".`);
    Deno.exit(1);
  }
  console.log(`PASS [PDV-01-B]: No biological entity labels detected in category or title.`);

  console.log("=== PDV-01 PASSED ===");
}

runPDV01().catch((err) => {
  console.error("FATAL:", err);
  Deno.exit(1);
});
