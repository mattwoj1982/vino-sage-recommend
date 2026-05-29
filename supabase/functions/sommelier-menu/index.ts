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
      .select("id, name, winery, vintage, grape_variety, region, rating, notes, bottle_count, drink_from, drink_to, food_pairing, pairing_categories, price_min, price_max")
      .eq("user_id", user.id)
      .gt("bottle_count", 0);
    if (winesErr) throw winesErr;

    if (!wines || wines.length === 0) {
      return new Response(JSON.stringify({
        pairing: "Dein Keller ist leer. Füge zuerst Weine hinzu.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const typedWines = wines as Wine[];
    const wineById = new Map(typedWines.map((wine) => [wine.id, wine]));
    const pricedWines = typedWines
      .map((wine) => ({ ...wine, _avgPrice: averagePrice(wine) }))
      .filter((wine) => wine._avgPrice > 0);
    const cellarAvg = pricedWines.length
      ? pricedWines.reduce((sum, wine) => sum + wine._avgPrice, 0) / pricedWines.length
      : 0;
    const budgetWines = cellarAvg > 0 ? pricedWines.filter((wine) => wine._avgPrice <= cellarAvg) : [];

    const wineList = typedWines.map((w, i) =>
      `${i + 1}. ID: ${w.id} | "${w.name}" – ${w.winery ?? "?"}, ${w.vintage ?? "?"}, ${w.grape_variety ?? "?"}, ${w.region ?? "?"}, Preis: ${formatPrice(w)}, Bewertung: ${w.rating ?? "-"}/5, ${w.bottle_count} Flasche(n)${w.food_pairing ? `, Speise: ${w.food_pairing}` : ""}${w.pairing_categories?.length ? `, Kategorien: ${w.pairing_categories.join(", ")}` : ""}${w.notes ? `, Notizen: ${w.notes}` : ""}`
    ).join("\n");

    const budgetList = budgetWines.length
      ? budgetWines.map((w) => `- ID: ${w.id} | "${w.name}" – ${w.winery ?? "?"}, ${w.vintage ?? "?"}, Preis: ${formatPrice(w)}`).join("\n")
      : "Keine Weine mit Preisdaten in der unteren Preishälfte vorhanden.";

    const guestBlock = guestCount
      ? `\n\nGästeanzahl: ${guestCount}. Rechne pro Gang ca. 0,15 l Wein pro Gast (ganze Flasche = 0,75 l). Gib **pro Hauptempfehlung** explizit an, ob eine **ganze Flasche** sinnvoll ist, eine **halbe Flasche / Coravin** reicht, oder ob es **glasweise** sein sollte. Begründe das mit Gäste­anzahl und Gangzahl.`
      : `\n\nGib pro Empfehlung einen kurzen Hinweis zur Servierform (Flasche, halbe Flasche/Coravin, glasweise).`;

    const systemPrompt = `Du bist ein erfahrener KI-Sommelier. Der Nutzer beschreibt eine Speise oder ein mehrgängiges Menü. Wähle ausschließlich Weine aus den Listen.

Antworte NUR als valides JSON ohne Markdown-Codeblock, ohne Zusatztext:
{
  "title": "Weinempfehlung zu ...",
  "courses": [
    {
      "course": "Gang 1: ...",
      "mainWineId": "ID aus der Kellerliste",
      "mainReason": "1–2 Sätze Begründung.",
      "serving": "Servierform: ganze Flasche / halbe Flasche-Coravin / glasweise – kurze Begründung.",
      "everydayWineId": "ID aus der Liste untere Preishälfte oder leer",
      "everydayReason": "1–2 Sätze, warum diese preisbewusste Alltags-Option passt, oder Hinweis, dass keine passende vorhanden ist."
    }
  ],
  "closing": "Kurzer Satz zur Gesamtdramaturgie."
}

Zwingende Regeln:
- mainWineId muss aus der vollständigen Kellerliste stammen.
- everydayWineId muss, wenn möglich, ein anderer Wein sein und aus der Liste "Untere Preishälfte" stammen.
- Erfinde keine Preise und keine Weinnamen. Preise werden serverseitig ergänzt.
- Wenn der Nutzer nur eine einzelne Speise nennt, behandle sie als einen Gang.${guestBlock}

Kellerdurchschnitt: ${cellarAvg > 0 ? cellarAvg.toFixed(0) + " CHF" : "unbekannt"}

Untere Preishälfte / Alltags-Optionen:
${budgetList}

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
    const rawText = data.content?.[0]?.text ?? "";
    let pairing = "Keine Empfehlung erhalten.";

    try {
      const parsed = extractJson(rawText) as {
        title?: string;
        courses?: Array<{
          course?: string;
          mainWineId?: string;
          mainReason?: string;
          serving?: string;
          everydayWineId?: string;
          everydayReason?: string;
        }>;
        closing?: string;
      };

      const lines: string[] = [`# ${parsed.title || "Weinempfehlung"}`];
      for (const [index, course] of (parsed.courses || []).entries()) {
        const mainWine = course.mainWineId ? wineById.get(course.mainWineId) : null;
        const everydayWine = course.everydayWineId ? wineById.get(course.everydayWineId) : null;
        lines.push(
          "",
          `## ${course.course || `Gang ${index + 1}`}`,
          "",
          `**🍷 Hauptempfehlung: ${mainWine ? displayWine(mainWine) : "Kein passender Wein gefunden"} (${mainWine ? formatPrice(mainWine) : "Preis unbekannt"})**`,
          course.mainReason || "Diese Auswahl passt am besten zum beschriebenen Gang.",
          course.serving || "Servierform: je nach Gästezahl und Gangfolge dosieren.",
          "",
          everydayWine
            ? `**💰 Alltags-Option: ${displayWine(everydayWine)} (${formatPrice(everydayWine)})**`
            : "**💰 Alltags-Option: Keine passende günstigere Alternative im Keller**",
          course.everydayReason || "Für diesen Gang ist keine passende preisbewusste Alternative aus der unteren Preishälfte hinterlegt."
        );
      }
      if (parsed.closing) lines.push("", parsed.closing);
      pairing = lines.join("\n");
    } catch (jsonErr) {
      console.error("sommelier JSON parse error", jsonErr, rawText);
      pairing = rawText || pairing;
    }

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
