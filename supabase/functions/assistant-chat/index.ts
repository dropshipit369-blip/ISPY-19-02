import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role?: unknown;
  text?: unknown;
}

interface AssistantSnapshot {
  totalItems?: unknown;
  pendingItems?: unknown;
  listedItems?: unknown;
  soldItems?: unknown;
  totalProfit?: unknown;
  recentScanName?: unknown;
  triggeredAlerts?: unknown;
}

async function authenticateUser(req: Request): Promise<{ userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("assistant-chat proceeding without verified user context: no bearer token");
    return { userId: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("assistant-chat auth skipped because Supabase env is incomplete");
    return { userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.warn("assistant-chat proceeding without verified user context:", error?.message ?? "no user");
    return { userId: null };
  }

  return { userId: data.user.id };
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function formatSnapshot(snapshot: AssistantSnapshot | null | undefined) {
  if (!snapshot || typeof snapshot !== "object") {
    return "No live user snapshot was provided.";
  }

  return [
    `Inventory items: ${safeNumber(snapshot.totalItems)}`,
    `Pending items: ${safeNumber(snapshot.pendingItems)}`,
    `Listed items: ${safeNumber(snapshot.listedItems)}`,
    `Sold items: ${safeNumber(snapshot.soldItems)}`,
    `Realized profit: A$${safeNumber(snapshot.totalProfit).toFixed(2)}`,
    `Triggered alerts: ${safeNumber(snapshot.triggeredAlerts)}`,
    `Most recent scan: ${safeString(snapshot.recentScanName, "none")}`,
  ].join("\n");
}

function formatHistory(history: unknown) {
  if (!Array.isArray(history)) return "";

  return history
    .slice(-10)
    .map((entry) => {
      const message = entry as ChatMessage;
      const role = message.role === "user" ? "User" : "Assistant";
      const text = safeString(message.text);
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractReply(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.reply === "string") {
      return parsed.reply.trim();
    }
  } catch {
    // Fall back to raw text below.
  }

  return raw.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    await authenticateUser(req);

    const body = await req.json();
    const message = safeString(body?.message);
    const pathname = safeString(body?.pathname, "/dashboard");
    const chatHistory = formatHistory(body?.chatHistory);
    const snapshotSummary = formatSnapshot((body?.snapshot ?? null) as AssistantSnapshot | null);

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey =
      Deno.env.get("GOOGLE_GEMINI_API_KEY") ??
      Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are the live iSpy Assistant inside a resale-scanning app. You are no longer a scripted FAQ widget. You are a real two-way assistant.

Rules:
- Reply as a helpful in-app assistant for scanning, pricing, inventory, listings, marketplace workflow, profit tracking, and troubleshooting.
- Use the current workspace and user snapshot when useful.
- Use AUD for money.
- Be concise, specific, and practical.
- If the user asks about camera/browser issues, mention permission settings, secure-context/HTTPS requirements, and the Android app when relevant.
- If the user asks something outside app context, still answer briefly if it helps a reseller, then steer back to the app.
- Never claim you completed an action unless the app actually did it.
- Return ONLY valid JSON: {"reply":"..."}.

Current workspace: ${pathname}

Current user snapshot:
${snapshotSummary}

Recent conversation:
${chatHistory || "No prior messages."}

User message:
${message}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const reply = extractReply(text);

    if (!reply) {
      throw new Error("Invalid model response");
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
