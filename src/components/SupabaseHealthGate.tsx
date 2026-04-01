import { useSupabaseHealth } from "@/hooks/useSupabaseHealth";
import { SUPABASE_PROJECT_ID, SUPABASE_URL } from "@/integrations/supabase/env";
import { RefreshCw, WifiOff, AlertTriangle, ExternalLink } from "lucide-react";
import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export function SupabaseHealthGate({ children }: Props) {
  const { status, error, retry } = useSupabaseHealth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await retry();
    setRetrying(false);
  };

  // While checking, show the normal loading spinner
  if (status === "checking") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-3 h-3 rounded-full bg-primary animate-pulse"
              style={{ boxShadow: "0 0 10px hsl(187 85% 53% / 0.5)" }}
            />
          </div>
        </div>
        <span className="text-sm text-muted-foreground font-medium tracking-wide animate-pulse">
          Connecting to server...
        </span>
      </div>
    );
  }

  // Healthy — render app normally
  if (status === "healthy") {
    return <>{children}</>;
  }

  // Unreachable or paused — show recovery screen
  const supabaseUrl = SUPABASE_URL || "";
  const projectRef = SUPABASE_PROJECT_ID || "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            {status === "project_paused" ? (
              <AlertTriangle className="w-10 h-10 text-destructive" />
            ) : (
              <WifiOff className="w-10 h-10 text-destructive" />
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {status === "project_paused"
              ? "Supabase Project Paused"
              : "Cannot Connect to Server"}
          </h1>
          <p className="text-muted-foreground">
            {status === "project_paused"
              ? "Your Supabase project has been paused due to inactivity. Free-tier projects are paused after 7 days without activity."
              : "The app cannot reach the backend server. This is usually a configuration or network issue."}
          </p>
        </div>

        {/* Steps to fix */}
        <div className="bg-muted/50 rounded-xl p-6 text-left space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            How to Fix
          </h3>

          {status === "project_paused" ? (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>
                  Go to your{" "}
                  <a
                    href={`https://supabase.com/dashboard/project/${projectRef}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Supabase Dashboard
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Click <strong>"Restore project"</strong> on the paused project banner
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>
                  Wait 1-2 minutes for the project to fully start up, then click Retry below
                </span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  1
                </span>
                <span>Check that your internet connection is working</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <span>
                  Verify the <code className="bg-muted px-1 rounded">.env</code> file contains valid{" "}
                  <code className="bg-muted px-1 rounded">VITE_SUPABASE_URL</code> (or{" "}
                  <code className="bg-muted px-1 rounded">VITE_SUPABASE_PROJECT_ID</code>) and{" "}
                  <code className="bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> (or{" "}
                  <code className="bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code>)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <span>Disable any VPN or firewall that may block supabase.co</span>
              </li>
            </ol>
          )}
        </div>

        {/* Error detail */}
        {error && (
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-32">
              {error}
              {"\n"}URL: {supabaseUrl}
            </pre>
          </details>
        )}

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "Checking..." : "Retry Connection"}
        </button>
      </div>
    </div>
  );
}
