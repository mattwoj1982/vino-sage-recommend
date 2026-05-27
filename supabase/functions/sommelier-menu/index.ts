import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Wine = {
  id: string;
  name: string;
  winery: string | null;
  vintage: string | number | null;
  grape_variety: string | null;
  region: string | null;
  rating: number | null;
  notes: string | null;
  bottle_count: number;
  drink_from: number | null;
  drink_to: number | null;
  food_pairing: string | null;
  pairing_categories: string[] | null;
  price_min: number | null;
  price_max: number | null;
};

const formatPrice = (wine: Pick<Wine, "price_min" | "price_max">) => {
  const min = Number(wine.price_min) || 0;
  const max = Number(wine.price_max) || 0;
  if (min > 0 && max > 0 && min !== max) return `${min}–${max} CHF`;
  if (max > 0) return `${max} CHF`;
  if (min > 0) return `${min} CHF`;
  return "Preis unbekannt";
};

const averagePrice = (wine: Pick<Wine, "price_min" | "price_max">) => {
  const min = Number(wine.price_min) || 0;
  const max = Number(wine.price_max) || 0;
  if (min > 0 && max > 0) return (min + max) / 2;
  return max || min || 0;
};

const displayWine = (wine: Wine) => {
  const vintage = wine.vintage ? ` ${wine.vintage}` : "";
  const winery = wine.winery ? ` (${wine.winery})` : "";
  return `${wine.name}${vintage}${winery}`;
};

const extractJson = (text: string) => {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Keine JSON-Antwort erhalten");
  return JSON.parse(
    cleaned
      .slice(start, end + 1)
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
  );
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
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Nicht autorisiert" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed, error: rlErr } = await supabase.rpc("check_and_increment_rate_limit", {
      _user_id: user.id, _function_name: "sommelier-menu", _max_requests: 20, _window_seconds: 3600,
    });
    if (rlErr) console.error("rate limit err", rlErr);
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Zu viele Anfragen. Bitte später erneut versuchen." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const menu = body?.menu;
    const guestCount = Number.isFinite(Number(body?.guest_count)) ? Math.max(1, Math.min(50, Math.floor(Number(body.guest_count)))) : null;
    if (!menu || typeof menu !== "string" || menu.length > 3000) {
      return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: wines, error: winesErr } = await supabase
      .from("wines")
      .select("id, name, winery, vintage, grape_variety, region, rating, notes, bottle_count, drink_from, drink_to, food_pairing, pairing_categories")
      .eq("user_id", user.id)
      .gt("bottle_count", 0);
    if (winesErr) throw winesErr;

    if (!wines || wines.length === 0) {
      return new Response(JSON.stringify({
        pairing: "Dein Keller ist leer. Füge zuerst Weine hinzu.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const wineList = wines.map((w, i) =>
      `${i + 1}. "${w.name}" – ${w.winery ?? "?"}, ${w.vintage ?? "?"}, ${w.grape_variety ?? "?"}, ${w.region ?? "?"}, Bewertung: ${w.rating ?? "-"}/5, ${w.bottle_count} Flasche(n)${w.food_pairing ? `, Speise: ${w.food_pairing}` : ""}${w.pairing_categories?.length ? `, Kategorien: ${w.pairing_categories.join(", ")}` : ""}${w.notes ? `, Notizen: ${w.notes}` : ""}`
    ).join("\n");

    const guestBlock = guestCount
      ? `\n\nGästeanzahl: ${guestCount}. Rechne pro Gang ca. 0,15 l Wein pro Gast (ganze Flasche = 0,75 l). Gib **pro Hauptempfehlung** explizit an, ob eine **ganze Flasche** sinnvoll ist, eine **halbe Flasche / Coravin** reicht, oder ob es **glasweise** sein sollte. Begründe das mit Gäste­anzahl und Gangzahl.`
      : `\n\nGib pro Empfehlung einen kurzen Hinweis zur Servierform (Flasche, halbe Flasche/Coravin, glasweise).`;

    const systemPrompt = `Du bist ein erfahrener KI-Sommelier. Der Nutzer beschreibt eine Speise oder ein mehrgängiges Menü. Wähle aus dem verfügbaren Weinkeller die passenden Weine aus. Verwende ausschließlich Weine aus der Liste.

Antworte auf Deutsch in folgendem Markdown-Format pro Gang:

## Gang 1: [Speise]
**Empfehlung: [Weinname]** ([Weingut], [Jahrgang])
Begründung in 1–2 Sätzen.
Servierform: [Flasche / halbe Flasche-Coravin / glasweise] – kurze Begründung.

**Alternative: [Weinname]** ([Weingut], [Jahrgang])
1 Satz: warum diese Alternative spannend ist (z.B. andere Stilistik, reifer, leichter).

## Gang 2: ...

Wenn der Nutzer nur eine einzelne Speise nennt, behandle sie als einen Gang. Schließe mit einem kurzen Schluss­satz zur Gesamtdramaturgie.${guestBlock}

Verfügbare Weine im Keller:
${wineList}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: menu }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "Fehler beim Abruf der Empfehlung" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const pairing = data.content?.[0]?.text ?? "Keine Empfehlung erhalten.";

    return new Response(JSON.stringify({ pairing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sommelier-menu error:", e);
    return new Response(JSON.stringify({ error: "Interner Fehler. Bitte versuche es erneut." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
