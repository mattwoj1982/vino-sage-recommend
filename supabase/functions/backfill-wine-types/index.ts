import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED = ["Weißwein", "Rotwein", "Rosé", "Schaumwein"];

const normalize = (raw: string): string | null => {
  const s = raw.trim().toLowerCase().replace(/[".]/g, "");
  if (s.startsWith("weiss") || s.startsWith("weiß")) return "Weißwein";
  if (s.startsWith("rot")) return "Rotwein";
  if (s.startsWith("ros")) return "Rosé";
  if (s.startsWith("schaum") || s.includes("sekt") || s.includes("champagner") || s.includes("crémant") || s.includes("prosecco")) return "Schaumwein";
  const match = ALLOWED.find((a) => a.toLowerCase() === s);
  return match ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI nicht konfiguriert" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Nicht autorisiert" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = auth.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Nicht autorisiert" }, 401);

    const { data: wines, error } = await supabase
      .from("wines")
      .select("id, name, winery, region, grape_variety")
      .eq("user_id", user.id)
      .is("wine_type", null);
    if (error) return json({ error: error.message }, 500);
    if (!wines || wines.length === 0) return json({ updated: 0, total: 0 });

    let updated = 0;
    const failures: string[] = [];

    for (const w of wines) {
      const prompt = `Bestimme den Typ dieses Weins. Antworte AUSSCHLIESSLICH mit GENAU einem dieser Worte: "Weißwein", "Rotwein", "Rosé", "Schaumwein". Wenn nicht eindeutig bestimmbar, antworte "Unbekannt".

Name: ${w.name}
Weingut: ${w.winery ?? "-"}
Region: ${w.region ?? "-"}
Rebsorte: ${w.grape_variety ?? "-"}`;

      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (!r.ok) {
          failures.push(w.id);
          continue;
        }
        const data = await r.json();
        const wine_type = normalize(data.choices?.[0]?.message?.content ?? "");
        if (!wine_type) {
          failures.push(w.id);
          continue;
        }
        const { error: uerr } = await supabase
          .from("wines")
          .update({ wine_type })
          .eq("id", w.id)
          .eq("user_id", user.id);
        if (uerr) failures.push(w.id);
        else updated++;
      } catch (_e) {
        failures.push(w.id);
      }
    }

    return json({ updated, total: wines.length, failed: failures.length });
  } catch (e) {
    console.error("backfill-wine-types error", e);
    return json({ error: String(e) }, 500);
  }
});
