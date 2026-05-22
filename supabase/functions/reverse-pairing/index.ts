import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ist nicht konfiguriert");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed } = await supabase.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _function_name: "reverse-pairing", _max_requests: 30, _window_seconds: 3600,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const wineId: string | undefined = body?.wine_id;
    const occasion: string = typeof body?.occasion === "string" ? body.occasion.slice(0, 500) : "";
    if (!wineId || typeof wineId !== "string") {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wine, error: wineErr } = await supabase
      .from("wines")
      .select("id, name, winery, vintage, grape_variety, region, country, rating, description, food_pairing, pairing_categories, notes, drink_from, drink_to")
      .eq("id", wineId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (wineErr) throw wineErr;
    if (!wine) {
      return new Response(JSON.stringify({ error: "Wein nicht gefunden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Du bist ein erfahrener Sommelier und Küchenchef. Der Nutzer öffnet heute Abend eine bestimmte Flasche und sucht passende Gerichte dazu.

Antworte auf Deutsch in folgendem Markdown-Format:

## Charakter des Weins
2–3 Sätze: Stilistik, Tannin/Säure/Süße, Aromatik, Reifegrad.

## Klassische Pairings
- **[Gericht]** – kurze Begründung
- **[Gericht]** – kurze Begründung
- **[Gericht]** – kurze Begründung

## Spannende Alternativen
- **[Gericht]** – warum es überraschend gut funktioniert

## Konkretes Rezept für heute Abend
**[Rezeptname]** – knappe Beschreibung mit Hauptzutaten und Garmethode (max. 4–5 Sätze), die zur Flasche passt.

## No-Gos
Kurze Liste, was du mit diesem Wein vermeiden würdest und warum.`;

    const wineLine = `Wein: "${wine.name}"${wine.winery ? ` von ${wine.winery}` : ""}${wine.vintage ? `, Jahrgang ${wine.vintage}` : ""}${wine.grape_variety ? `, Rebsorte ${wine.grape_variety}` : ""}${wine.region ? `, Region ${wine.region}` : ""}${wine.country ? `, ${wine.country}` : ""}${wine.rating ? `, Bewertung ${wine.rating}/5` : ""}${wine.drink_from || wine.drink_to ? `, Trinkfenster ${wine.drink_from ?? "?"}–${wine.drink_to ?? "?"}` : ""}${wine.description ? `\nProfil: ${wine.description}` : ""}${wine.food_pairing ? `\nBisherige Speisen-Notiz: ${wine.food_pairing}` : ""}${wine.pairing_categories?.length ? `\nKategorien: ${wine.pairing_categories.join(", ")}` : ""}${wine.notes ? `\nNotizen: ${wine.notes}` : ""}`;
    const userMsg = `${wineLine}\n\n${occasion ? `Anlass / Wunsch: ${occasion}` : "Was koche ich heute Abend dazu?"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate Limit erreicht. Bitte später erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte Workspace aufladen." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Fehler beim Abruf der Empfehlung" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const pairing = data?.choices?.[0]?.message?.content ?? "Keine Empfehlung erhalten.";

    return new Response(JSON.stringify({ pairing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reverse-pairing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Interner Fehler" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
