import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, AlertCircle } from "lucide-react";
import {
  hasSupabaseConfig,
  missingSupabaseEnvVars,
  SUPABASE_KEY_SOURCE,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  SUPABASE_URL_SOURCE,
} from "@/integrations/supabase/env";

export default function DebugAuth() {
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [tests, setTests] = useState<Record<string, boolean | null>>({
    envVarsLoaded: null,
    canFetchSupabase: null,
    canFetchAuth: null,
  });

  useEffect(() => {
    setEnvVars({
      url: SUPABASE_URL || "NOT SET",
      key: SUPABASE_PUBLISHABLE_KEY ? `${SUPABASE_PUBLISHABLE_KEY.substring(0, 20)}...` : "NOT SET",
      urlSource: SUPABASE_URL_SOURCE || "NOT SET",
      keySource: SUPABASE_KEY_SOURCE || "NOT SET",
      missing: missingSupabaseEnvVars().join(", ") || "None",
    });

    setTests(prev => ({
      ...prev,
      envVarsLoaded: hasSupabaseConfig,
    }));

    // Test Supabase connectivity
    if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) {
      testSupabaseConnectivity(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    }
  }, []);

  const testSupabaseConnectivity = async (url: string, key: string) => {
    try {
      // Test basic fetch to Supabase
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      setTests(prev => ({
        ...prev,
        canFetchSupabase: response.status < 500,
      }));
    } catch (error) {
      console.error("Supabase fetch error:", error);
      setTests(prev => ({
        ...prev,
        canFetchSupabase: false,
      }));
    }

    // Test auth endpoint
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/auth/v1/health`, {
        signal: controller.signal,
        headers: {
          "apikey": key,
        },
      });

      clearTimeout(timeout);
      setTests(prev => ({
        ...prev,
        canFetchAuth: response.status < 500,
      }));
    } catch (error) {
      console.error("Auth endpoint error:", error);
      setTests(prev => ({
        ...prev,
        canFetchAuth: false,
      }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testStatus = (result: boolean | null) => {
    if (result === null) return "⏳";
    if (result) return "✅";
    return "❌";
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Authentication Debug Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Environment Variables */}
            <div>
              <h3 className="font-semibold mb-3">1. Environment Variables</h3>
              <div className="bg-muted p-3 rounded space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span>Supabase URL:</span>
                  <span className="font-mono text-xs">{envVars.url}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>URL Source:</span>
                  <span className="font-mono text-xs">{envVars.urlSource}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>API Key:</span>
                  <span className="font-mono text-xs">{envVars.key}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Key Source:</span>
                  <span className="font-mono text-xs">{envVars.keySource}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Missing Vars:</span>
                  <span className="font-mono text-xs">{envVars.missing}</span>
                </div>
              </div>
              {tests.envVarsLoaded ? (
                <p className="text-sm text-green-600 mt-2">✅ Environment variables loaded</p>
              ) : (
                <p className="text-sm text-red-600 mt-2">❌ Environment variables NOT loaded. Check .env file</p>
              )}
            </div>

            {/* Connectivity Tests */}
            <div>
              <h3 className="font-semibold mb-3">2. Connectivity Tests</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Can reach Supabase domain</span>
                  <span className="text-lg">{testStatus(tests.canFetchSupabase)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Can reach Auth endpoint</span>
                  <span className="text-lg">{testStatus(tests.canFetchAuth)}</span>
                </div>
              </div>
              {tests.canFetchSupabase === false && (
                <p className="text-sm text-red-600 mt-2">
                  ❌ Cannot reach Supabase. Check:
                  <ul className="ml-4 mt-1">
                    <li>• Internet connection</li>
                    <li>• Firewall/VPN blocking supabase.co</li>
                    <li>• Supabase project URL is correct</li>
                    <li>• Supabase project is active</li>
                  </ul>
                </p>
              )}
            </div>

            {/* Diagnostic Code */}
            <div>
              <h3 className="font-semibold mb-3">3. Run Full Diagnostics</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Copy this code and run it in the browser console (F12)
              </p>
              <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap break-words">
                import {'{'}runSupabaseDiagnostics{'}'} from '/src/utils/supabase-diagnostics.ts'
                <br />
                runSupabaseDiagnostics()
              </div>
              <Button
                size="sm"
                className="mt-2"
                onClick={() =>
                  copyToClipboard(
                    "import { runSupabaseDiagnostics } from '/src/utils/supabase-diagnostics.ts';\nrunSupabaseDiagnostics();"
                  )
                }
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-sm mb-2">Next Steps:</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Verify environment variables are loaded</li>
                <li>Check connectivity tests pass</li>
                <li>Run full diagnostics in console</li>
                <li>See AUTH_TROUBLESHOOTING.md for detailed fixes</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
