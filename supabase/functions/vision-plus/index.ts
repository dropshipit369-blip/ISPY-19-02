
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VisionBox = {
  label: string;
  box_2d: [number, number, number, number];
};

async function authenticateUser(req: Request): Promise<{ userId: string | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("vision-plus proceeding without verified user context: no bearer token");
    return { userId: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("vision-plus auth skipped because Supabase env is incomplete");
    return { userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    console.warn("vision-plus proceeding without verified user context:", error?.message ?? "no user");
    return { userId: null };
  }

  return { userId: data.user.id };
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

function clampBox(box: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.min(1, Math.max(0, box.x)),
    y: Math.min(1, Math.max(0, box.y)),
    width: Math.min(1, Math.max(0.01, box.width)),
    height: Math.min(1, Math.max(0.01, box.height)),
  };
}

function toNormalizedBox(box2d: [number, number, number, number]) {
  const [ymin, xmin, ymax, xmax] = box2d;
  const x = xmin / 1000;
  const y = ymin / 1000;
  const width = (xmax - xmin) / 1000;
  const height = (ymax - ymin) / 1000;
  return clampBox({ x, y, width, height });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Length": "0" } });
  }

  try {
    await authenticateUser(req);

    const body = await req.json();
    const { image, prompt } = body ?? {};

    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!image.startsWith("data:image")) {
      return new Response(JSON.stringify({ error: "Only data:image URLs are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseDataUrl(image);
    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid image encoding" }), {
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

    // SES §3: Material-First Prompt Engineering — texture/material must override shape-based classification.
    // Confidence guardrail: biological entity labels require >95% confidence; below that, reclassify to Art/Decor/Collectibles.
    const MATERIAL_FIRST_SYSTEM_PROMPT = `You are a specialist resale object detector.

CLASSIFICATION RULES (STRICT — in priority order):
1. MATERIAL/TEXTURE FIRST: Evaluate the physical medium before shape.
   - Wood, stone, clay, canvas, ceramic, fabric, paper → classify as object type within Art/Sculpture/Handmade/Decor, NOT as the biological entity the shape resembles.
   - A carved wooden elephant is "Wooden Animal Carving" NOT "Elephant". A ceramic dog is "Ceramic Animal Figurine" NOT "Dog".
2. BIOLOGICAL ENTITY GUARDRAIL: Only label an item as a living animal or plant if you are >95% confident it is a live, real biological entity (not carved, painted, printed, stuffed, or sculpted).
   - If confidence in a biological classification is ≤95%, reclassify under: Art/Sculpture, Collectibles, Toy, Figurine, or Decor — whichever fits the observed material.
3. ELECTRONICS GUARDRAIL: Only classify as Electronics if you can clearly identify a brand, model, or functional device. Irregular surfaces or unrecognised shapes must default to "Unknown Item" rather than a specific electronics category.
`;

    const detectionPrompt =
      prompt ||
      `${MATERIAL_FIRST_SYSTEM_PROMPT}
Detect all resale items in the image. For each item return JSON:
{"label": string, "box_2d": [ymin, xmin, ymax, xmax]}
Box values must be 0-1000. Be precise. Include partially visible items. Apply material-first classification rules strictly.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: parsed.mimeType, data: parsed.data } },
                { text: detectionPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
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
    const parsedJson = extractJson(text);

    const boxes: VisionBox[] = Array.isArray(parsedJson) ? parsedJson : parsedJson?.items;
    const items = Array.isArray(boxes)
      ? boxes
        .filter((b) => Array.isArray(b.box_2d) && b.box_2d.length === 4)
        .map((b, i) => ({
          key: `vp-${Date.now()}-${i}`,
          label: String(b.label || "Item"),
          boundingBox: toNormalizedBox(b.box_2d),
        }))
      : [];

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
