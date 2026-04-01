import { useState, useEffect, useCallback } from "react";
import {
  hasSupabaseConfig,
  missingSupabaseEnvVars,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/env";

type HealthStatus = "checking" | "healthy" | "unreachable" | "project_paused";

interface SupabaseHealthState {
  status: HealthStatus;
  error: string | null;
}

/**
 * Checks if the Supabase project is reachable.
 * Supabase free-tier projects are paused after 7 days of inactivity.
 * When paused, all API calls fail with "Failed to fetch" (DNS/connection errors).
 */
export function useSupabaseHealth() {
  const [health, setHealth] = useState<SupabaseHealthState>({
    status: "checking",
    error: null,
  });

  const checkHealth = useCallback(async () => {
    if (!hasSupabaseConfig || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      setHealth({
        status: "unreachable",
        error: `Missing Supabase env vars: ${missingSupabaseEnvVars().join(", ")}`,
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      // Hit the REST endpoint — lightweight, no auth needed
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: "HEAD",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 400 || response.status === 401) {
        // Any HTTP response means the server is up
        setHealth({ status: "healthy", error: null });
      } else if (response.status === 503 || response.status === 540) {
        setHealth({
          status: "project_paused",
          error: `Supabase returned status ${response.status}. The project is likely paused.`,
        });
      } else {
        // Server responded but with an unexpected status — still reachable
        setHealth({ status: "healthy", error: null });
      }
    } catch (err: any) {
      // Network-level failure: DNS, connection refused, timeout
      const message = err?.message || "Unknown error";

      if (err?.name === "AbortError" || message.toLowerCase().includes("timeout")) {
        setHealth({
          status: "project_paused",
          error: "Connection timed out — the Supabase project is likely paused or deleted.",
        });
      } else {
        setHealth({
          status: "unreachable",
          error: `Cannot reach Supabase: ${message}`,
        });
      }
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { ...health, retry: checkHealth };
}
