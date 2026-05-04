import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fallbackResponse = (message = "Bilderkennung ist momentan nicht verfügbar") =>
  jsonResponse({ error: message, fallback: true });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return fallbackResponse("Claude API-Key ist nicht konfiguriert");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Nicht autorisiert" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return jsonResponse({ error: "Nicht autorisiert" }, 401);
    }

    let body: { image_base64?: unknown; media_type?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Ungültige Anfrage" }, 400);
    }

    const image_base64 = typeof body.image_base64 === "string" ? body.image_base64 : undefined;
    const rawMediaType = typeof body.media_type === "string" ? body.media_type : "image/jpeg";
    const allowedMediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const media_type = allowedMediaTypes.includes(rawMediaType) ? rawMediaType : "image/jpeg";

    if (!image_base64) {
      return jsonResponse({ error: "Bild fehlt" }, 400);
    }
    if (image_base64.length > 28_000_000) {
      return jsonResponse({ error: "Bild ist zu groß" }, 400);
    }

    const imageSource = { type: "base64", media_type, data: image_base64 };

    const systemPrompt = `Du bist ein Wein-Experte, der Weinetiketten analysiert. Extrahiere die Informationen vom Etikett und gib AUSSCHLIESSLICH ein gültiges JSON-Objekt zurück, ohne Erklärungen, ohne Markdown, ohne Code-Block-Markierungen.

Schema:
{
  "name": string,           // Name des Weins (z.B. "Château Margaux", "Riesling Trocken")
  "winery": string|null,    // Weingut/Erzeuger
  "vintage": number|null,   // Jahrgang als Zahl, z.B. 2018
  "grape_variety": string|null, // Rebsorte (z.B. "Cabernet Sauvignon", "Riesling")
  "region": string|null     // Region/Anbaugebiet (z.B. "Bordeaux", "Mosel")
}

Wenn ein Feld nicht erkennbar ist, setze null. Wenn KEIN Wein/Weinetikett erkennbar ist, gib zurück: {"error":"Kein Wein erkannt"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: imageSource },
            { type: "text", text: "Analysiere dieses Weinetikett und extrahiere die Daten." },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      const userMessage = t.includes("credit balance is too low")
        ? "Claude-Bilderkennung ist aktuell nicht verfügbar, weil das API-Guthaben aufgebraucht ist"
        : "Fehler bei der Bilderkennung";
      return fallbackResponse(userMessage);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "{}";
    let parsed: any;
    try {
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return fallbackResponse("Antwort konnte nicht gelesen werden");
    }

    return jsonResponse(parsed);
  } catch (e) {
    console.error("analyze-wine-label error:", e);
    return fallbackResponse("Bilderkennung ist momentan nicht verfügbar");
  }
});
