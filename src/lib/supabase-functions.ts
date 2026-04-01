import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export async function invokeSupabaseFunction<TData = unknown>(
  functionName: string,
  body?: unknown,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return supabase.functions.invoke<TData>(functionName, {
    body,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });
}

export async function parseSupabaseFunctionError(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload === "object") {
        const fromError = (payload as Record<string, unknown>).error;
        const fromMessage = (payload as Record<string, unknown>).message;
        if (typeof fromError === "string" && fromError.trim()) return fromError;
        if (typeof fromMessage === "string" && fromMessage.trim()) return fromMessage;
      }
    } catch {
      try {
        const text = await error.context.text();
        if (text.trim()) return text;
      } catch {
        // Ignore parser failures and fall back to the generic message.
      }
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
