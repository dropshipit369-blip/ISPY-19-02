/**
 * Supabase Connection Diagnostics
 *
 * This utility helps diagnose Supabase connection issues.
 * Run this in the browser console to debug authentication problems.
 */
import {
  missingSupabaseEnvVars,
  SUPABASE_KEY_SOURCE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  SUPABASE_URL_SOURCE,
} from "@/integrations/supabase/env";

export async function runSupabaseDiagnostics() {
  console.log("Starting Supabase diagnostics...\n");

  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_PUBLISHABLE_KEY;

  // 1. Check environment variables
  console.log("1) Environment Variables:");
  console.log(`   URL source: ${SUPABASE_URL_SOURCE || "Missing"}`);
  console.log(`   Key source: ${SUPABASE_KEY_SOURCE || "Missing"}`);
  console.log(`   VITE_SUPABASE_URL / VITE_SUPABASE_PROJECT_ID: ${supabaseUrl ? "Set" : "Missing"}`);
  console.log(`   VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY: ${supabaseKey ? "Set" : "Missing"}`);

  if (!supabaseUrl || !supabaseKey) {
    console.error(`Missing environment variables: ${missingSupabaseEnvVars().join(", ")}`);
    return;
  }

  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key (first 20 chars): ${supabaseKey.substring(0, 20)}...\n`);

  // 2. Test basic network connectivity to Supabase
  console.log("2) Network Connectivity:");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${supabaseUrl}/functions/v1/health`, {
      signal: controller.signal,
    }).catch((e) => {
      clearTimeout(timeoutId);
      throw e;
    });
    clearTimeout(timeoutId);

    console.log("   Can reach Supabase URL");
    console.log(`   Status: ${response.status} ${response.statusText}\n`);
  } catch (error: any) {
    console.error("   Cannot reach Supabase URL");
    console.error(`   Error: ${error.message}`);
    console.error(`   Type: ${error.name}\n`);
    console.log("   This could mean:");
    console.log("      - Network is blocking the request");
    console.log("      - CORS issue");
    console.log("      - Supabase is down");
    console.log("      - Wrong URL in environment variables\n");
  }

  // 3. Check CORS headers
  console.log("3) CORS Headers:");
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
      },
    });
    const corsHeaders = {
      allowOrigin: response.headers.get("access-control-allow-origin"),
      allowMethods: response.headers.get("access-control-allow-methods"),
      allowHeaders: response.headers.get("access-control-allow-headers"),
    };
    console.log(`   Access-Control-Allow-Origin: ${corsHeaders.allowOrigin || "Not set"}`);
    console.log(`   Access-Control-Allow-Methods: ${corsHeaders.allowMethods || "Not set"}`);
    console.log(`   Access-Control-Allow-Headers: ${corsHeaders.allowHeaders || "Not set"}\n`);
  } catch (error: any) {
    console.error(`   CORS check failed: ${error.message}\n`);
  }

  // 4. Test authentication endpoint reachability
  console.log("4) Authentication Test:");
  console.log("   Testing with dummy credentials (expected auth failure)");
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "test123",
      }),
    });
    console.log(`   Auth endpoint reachable (Status: ${response.status})`);
    if (response.status === 400) {
      console.log("   Invalid credentials response returned as expected\n");
    }
  } catch (error: any) {
    console.error(`   Auth endpoint unreachable: ${error.message}\n`);
  }

  // 5. Summary
  console.log("Summary and recommendations:");
  console.log("   If checks passed, hard-refresh the browser and retry");
  console.log("   If network checks failed, test internet/firewall/VPN");
  console.log("   If CORS is blocked, verify Supabase project settings");
  console.log("   If auth failed, confirm the Supabase project is active\n");

  console.log("For support, run this in console and share the output:");
  console.log("import { runSupabaseDiagnostics } from '@/utils/supabase-diagnostics';");
  console.log("await runSupabaseDiagnostics();");
}

// Export a version that can be called from browser console
if (typeof window !== "undefined") {
  (window as any).runSupabaseDiagnostics = runSupabaseDiagnostics;
}
