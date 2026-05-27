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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed, error: rlErr } = await supabase.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _function_name: "recommend-wine", _max_requests: 30, _window_seconds: 3600,
    });
    if (rlErr) console.error("rate limit err", rlErr);
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.length > 1000) {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wines, error: winesErr } = await supabase
      .from("wines")
      .select("id, name, winery, vintage, grape_variety, region, rating, notes, bottle_count, price_min, price_max")
      .eq("user_id", user.id)
      .gt("bottle_count", 0);

    if (winesErr) throw winesErr;

    if (!wines || wines.length === 0) {
      return new Response(JSON.stringify({
        recommendation: "Dein Keller ist leer. Füge zuerst einige Weine hinzu, damit ich Empfehlungen geben kann."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Durchschnittspreis berechnen (Mittel aus price_min/max je Wein)
    const pricedWines = wines
      .map((w: any) => {
        const min = Number(w.price_min) || 0;
        const max = Number(w.price_max) || 0;
        const avg = min > 0 && max > 0 ? (min + max) / 2 : (max || min || 0);
        return { ...w, _avgPrice: avg };
      })
      .filter((w: any) => w._avgPrice > 0);

    const cellarAvg = pricedWines.length > 0
      ? pricedWines.reduce((s: number, w: any) => s + w._avgPrice, 0) / pricedWines.length
      : 0;

    const budgetWines = pricedWines.filter((w: any) => w._avgPrice <= cellarAvg);

    const fmtPrice = (w: any) => {
      if (w.price_min && w.price_max) return `${w.price_min}–${w.price_max} CHF`;
      if (w.price_max) return `${w.price_max} CHF`;
      if (w.price_min) return `${w.price_min} CHF`;
      return "Preis unbekannt";
    };

    const wineList = wines.map((w: any, i: number) =>
      `${i + 1}. "${w.name}" – ${w.winery ?? "?"}, ${w.vintage ?? "?"}, ${w.grape_variety ?? "?"}, ${w.region ?? "?"}, Bewertung: ${w.rating ?? "-"}/5, ${w.bottle_count} Flasche(n), Preis: ${fmtPrice(w)}${w.notes ? `, Notizen: ${w.notes}` : ""}`
    ).join("\n");

    const budgetSection = budgetWines.length > 0
      ? `\n\nWeine in der unteren Preishälfte (≤ ${cellarAvg.toFixed(0)} CHF, Kellerdurchschnitt):\n${budgetWines.map((w: any) => `- "${w.name}" (${fmtPrice(w)})`).join("\n")}`
      : `\n\nHinweis: Es liegen keine ausreichenden Preisdaten vor, um eine günstigere Alternative zu identifizieren.`;

    const systemPrompt = `Du bist ein erfahrener Sommelier. Empfehle aus dem unten aufgeführten Weinkeller den passendsten Wein für den Anlass des Nutzers. Antworte auf Deutsch, kurz und elegant.

Struktur deiner Antwort:
1. **Hauptempfehlung**: Der ideale Wein – nenne ihn mit Namen und begründe charmant (2–3 Sätze).
2. **Preisbewusste Alternative**: Empfiehl zusätzlich einen Wein aus der unteren Preishälfte des Kellers (Kellerdurchschnitt: ${cellarAvg > 0 ? cellarAvg.toFixed(0) + " CHF" : "unbekannt"}), der ebenfalls gut zum Anlass passt. Begründe kurz (1–2 Sätze). Falls keine geeignete günstigere Option vorhanden ist, weise höflich darauf hin.

Verfügbare Weine im Keller:
${wineList}${budgetSection}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "Fehler beim Abruf der Empfehlung" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const recommendation = data.content?.[0]?.text ?? "Keine Empfehlung erhalten.";

    return new Response(JSON.stringify({ recommendation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-wine error:", e);
    return new Response(JSON.stringify({ error: "Interner Fehler. Bitte versuche es erneut." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
