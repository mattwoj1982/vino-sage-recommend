import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "Claude API-Key fehlt" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nicht autorisiert" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Nicht autorisiert" }, 401);

    const { data: allowed, error: rlErr } = await supabase.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _function_name: "describe-wine", _max_requests: 30, _window_seconds: 3600,
    });
    if (rlErr) console.error("rate limit err", rlErr);
    if (allowed === false) return json({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }, 429);

    const { wine_id } = await req.json().catch(() => ({}));
    if (!wine_id || typeof wine_id !== "string") return json({ error: "wine_id fehlt" }, 400);

    const { data: wine, error: wineErr } = await supabase
      .from("wines")
      .select("id, user_id, name, winery, vintage, grape_variety, region")
      .eq("id", wine_id)
      .maybeSingle();

    if (wineErr || !wine) return json({ error: "Wein nicht gefunden" }, 404);
    if (wine.user_id !== user.id) return json({ error: "Kein Zugriff" }, 403);

    const wineInfo = [
      `Name: ${wine.name}`,
      wine.winery && `Weingut: ${wine.winery}`,
      wine.vintage && `Jahrgang: ${wine.vintage}`,
      wine.grape_variety && `Rebsorte: ${wine.grape_variety}`,
      wine.region && `Region: ${wine.region}`,
    ].filter(Boolean).join("\n");

    const PAIRING_CATEGORIES = [
      "Rotes Fleisch",
      "Geflügel",
      "Wild",
      "Fisch & Meeresfrüchte",
      "Pasta & Pizza",
      "Käse",
      "Vegetarisch",
      "Würzige Küche",
      "Dessert",
      "Apéro / Solo",
    ];

    const systemPrompt = `Du bist ein Sommelier. Liefere für den angegebenen Wein:
- eine kurze, ansprechende Beschreibung in zwei Absätzen:
  1) Stil, Aromen, Struktur, Charakter
  2) ein kurzer Absatz zur Qualität & Einordnung (Niveau, typische Bewertung/Reputation, Preis-Leistung, Reifepotenzial — ehrlich, nicht beschönigend)
  Trenne die beiden Absätze mit einer Leerzeile (\\n\\n).
- konkrete Speisen-Empfehlungen als Fließtext (z.B. "Geschmortes Rind, gereifter Hartkäse, Wildragout")
- 1-3 passende Kategorien aus der vorgegebenen Liste (für Filterung)
- ein realistisches Trinkfenster (Jahre)
- eine realistische Preisspanne in CHF (Endkundenpreis pro 0,75l-Flasche im Schweizer Fachhandel)

Nutze AUSSCHLIESSLICH das Tool "wine_profile" — kein Freitext.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        tools: [{
          name: "wine_profile",
          description: "Erstellt Beschreibung, Pairing und Trinkfenster für einen Wein.",
          input_schema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "3-5 Sätze: Stil, Aromen, Struktur, Charakter. Auf Deutsch.",
              },
              food_pairing: {
                type: "string",
                description: "2-4 konkrete Gerichte oder Speise-Beispiele als kurzer Fließtext. Auf Deutsch.",
              },
              pairing_categories: {
                type: "array",
                items: { type: "string", enum: PAIRING_CATEGORIES },
                minItems: 1,
                maxItems: 3,
                description: "1-3 passende Kategorien aus der Liste — für Filterung im Weinkeller.",
              },
              drink_from: {
                type: "integer",
                description: "Bestes Trinkfenster Beginn (Jahr, z.B. 2024). Wenn Jahrgang unbekannt, schätze realistisch.",
              },
              drink_to: {
                type: "integer",
                description: "Bestes Trinkfenster Ende (Jahr, z.B. 2032).",
              },
              price_min: {
                type: "number",
                description: "Realistischer Mindestpreis in CHF pro 0,75l-Flasche im Schweizer Fachhandel.",
              },
              price_max: {
                type: "number",
                description: "Realistischer Höchstpreis in CHF pro 0,75l-Flasche im Schweizer Fachhandel.",
              },
            },
            required: ["description", "food_pairing", "pairing_categories", "drink_from", "drink_to", "price_min", "price_max"],
          },
        }],
        tool_choice: { type: "tool", name: "wine_profile" },
        messages: [{ role: "user", content: `Wein:\n${wineInfo}` }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      const msg = t.includes("credit balance is too low")
        ? "Claude-Guthaben aufgebraucht"
        : "Fehler bei Claude";
      return json({ error: msg }, 502);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    if (!toolUse?.input) return json({ error: "Keine Antwort von Claude" }, 502);

    const { description, food_pairing, pairing_categories, drink_from, drink_to, price_min, price_max } = toolUse.input;
    const safeCategories = Array.isArray(pairing_categories)
      ? pairing_categories.filter((c: unknown) => typeof c === "string")
      : [];

    const { error: updateErr } = await supabase
      .from("wines")
      .update({ description, food_pairing, pairing_categories: safeCategories, drink_from, drink_to, price_min, price_max })
      .eq("id", wine_id)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return json({ error: "Speichern fehlgeschlagen" }, 500);
    }

    return json({ description, food_pairing, pairing_categories: safeCategories, drink_from, drink_to, price_min, price_max });
  } catch (e) {
    console.error("describe-wine error:", e);
    return json({ error: "Interner Fehler. Bitte versuche es erneut." }, 500);
  }
});
