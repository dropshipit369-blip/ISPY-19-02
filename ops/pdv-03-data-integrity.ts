/**
 * PDV-03 — Data Integrity Post-Deploy Verification
 * SES §10: Run schema enforcement check on the staging database.
 * Assert zero mock data tags exist in the ingestion pipeline.
 * Checks market_reports and scan_logs tables for prohibited mock/synthetic data markers.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> deno run --allow-net --allow-env ops/pdv-03-data-integrity.ts
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Prohibited string patterns that indicate mock or synthetic data was ingested.
const MOCK_TAG_PATTERNS = [
  "mock_data",
  "synthetic_data",
  "sample_data",
  "fake_data",
  "dummy_data",
  "test_fixture",
  "__mock__",
  "__test__",
  "MOCK_ITEM",
  "FAKE_PRICE",
];

interface SupabaseError {
  message: string;
  code?: string;
}

async function queryTable(
  table: string,
  column: string,
  pattern: string,
): Promise<number> {
  const filter = `${column}=ilike.*${encodeURIComponent(pattern)}*`;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY ?? "",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Query on ${table} failed (${res.status}): ${body}`);
  }

  const countHeader = res.headers.get("content-range");
  if (countHeader) {
    const match = countHeader.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function runPDV03() {
  console.log("=== PDV-03: Data Integrity Verification ===");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("FAIL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for PDV-03.");
    Deno.exit(1);
  }

  // Tables and text columns to scan for prohibited mock data markers.
  const CHECKS: Array<{ table: string; column: string }> = [
    { table: "market_reports", column: "verification_message" },
    { table: "market_reports", column: "verification_source" },
    { table: "scan_logs", column: "name" },
    { table: "scan_logs", column: "brand" },
    { table: "items", column: "title" },
    { table: "items", column: "notes" },
  ];

  let totalViolations = 0;

  for (const { table, column } of CHECKS) {
    for (const pattern of MOCK_TAG_PATTERNS) {
      let count: number;
      try {
        count = await queryTable(table, column, pattern);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Non-existent tables or columns are warnings, not failures.
        if (msg.includes("does not exist") || msg.includes("42P01") || msg.includes("42703")) {
          console.warn(`SKIP: ${table}.${column} — table/column not found, skipping.`);
          continue;
        }
        console.error(`FAIL [PDV-03]: Error querying ${table}.${column} for "${pattern}": ${msg}`);
        totalViolations++;
        continue;
      }

      if (count > 0) {
        console.error(
          `FAIL [PDV-03]: Found ${count} row(s) in ${table}.${column} matching prohibited pattern "${pattern}".`,
        );
        totalViolations++;
      }
    }
  }

  if (totalViolations > 0) {
    console.error(`\nDATA INTEGRITY FAILED: ${totalViolations} prohibited mock/synthetic data violation(s) detected in the ingestion pipeline.`);
    Deno.exit(1);
  }

  console.log("PASS [PDV-03]: Zero mock or synthetic data elements detected in the ingestion pipeline.");
  console.log("=== PDV-03 PASSED ===");
}

runPDV03().catch((err) => {
  console.error("FATAL:", err);
  Deno.exit(1);
});
