import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ist nicht konfiguriert");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { image_url, image_base64, media_type } = await req.json();
    if (!image_url && !image_base64) {
      return new Response(JSON.stringify({ error: "Bild fehlt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageSource = image_base64
      ? { type: "base64", media_type: media_type || "image/jpeg", data: image_base64 }
      : { type: "url", url: image_url };

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
      return new Response(JSON.stringify({ error: "Fehler bei der Bilderkennung" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "{}";
    let parsed: any;
    try {
      const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Antwort konnte nicht gelesen werden" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-wine-label error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
