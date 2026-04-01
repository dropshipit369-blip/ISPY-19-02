const readEnv = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const urlFromVar = readEnv(import.meta.env.VITE_SUPABASE_URL);
const projectIdFromVar = readEnv(import.meta.env.VITE_SUPABASE_PROJECT_ID);
const derivedUrlFromProjectId = projectIdFromVar
  ? `https://${projectIdFromVar}.supabase.co`
  : null;

const publishableKeyFromVar = readEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const anonKeyFromVar = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const SUPABASE_URL = urlFromVar ?? derivedUrlFromProjectId;
export const SUPABASE_PUBLISHABLE_KEY = publishableKeyFromVar ?? anonKeyFromVar;
export const SUPABASE_PROJECT_ID =
  projectIdFromVar ??
  (SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0] : null);

export const SUPABASE_URL_SOURCE = urlFromVar
  ? "VITE_SUPABASE_URL"
  : derivedUrlFromProjectId
    ? "VITE_SUPABASE_PROJECT_ID (derived URL)"
    : null;

export const SUPABASE_KEY_SOURCE = publishableKeyFromVar
  ? "VITE_SUPABASE_PUBLISHABLE_KEY"
  : anonKeyFromVar
    ? "VITE_SUPABASE_ANON_KEY"
    : null;

export const missingSupabaseEnvVars = (): string[] => {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push("VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID");
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    missing.push("VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY");
  }

  return missing;
};

export const hasSupabaseConfig = missingSupabaseEnvVars().length === 0;
