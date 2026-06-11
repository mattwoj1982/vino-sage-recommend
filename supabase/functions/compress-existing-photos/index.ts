import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "wine-photos";
const MAX_EDGE = 1600;
const QUALITY = 78;

/** Extract storage path from a stored public/signed URL or a raw path. */
const extractPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return value.startsWith("http") ? null : value;
  return value.substring(idx + marker.length).split("?")[0];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      .select("id, photo_url")
      .eq("user_id", user.id)
      .not("photo_url", "is", null);
    if (error) return json({ error: error.message }, 500);
    if (!wines || wines.length === 0) return json({ updated: 0, total: 0, skipped: 0 });

    let updated = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const w of wines) {
      const path = extractPath(w.photo_url);
      if (!path) { skipped++; continue; }

      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
        if (dlErr || !blob) { failures.push(w.id); continue; }

        const originalBytes = new Uint8Array(await blob.arrayBuffer());

        // GIFs / animations werden von Image.decode nicht behandelt -> überspringen
        let decoded: Image;
        try {
          const result = await decode(originalBytes);
          if (!(result instanceof Image)) { skipped++; continue; }
          decoded = result;
        } catch {
          skipped++;
          continue;
        }

        const longEdge = Math.max(decoded.width, decoded.height);
        if (longEdge > MAX_EDGE) {
          const scale = MAX_EDGE / longEdge;
          decoded.resize(Math.round(decoded.width * scale), Math.round(decoded.height * scale));
        }

        const compressed = await decoded.encodeJPEG(QUALITY);

        // Wenn nicht kleiner geworden, Original behalten
        if (compressed.length >= originalBytes.length) { skipped++; continue; }

        const newPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(newPath, compressed, { contentType: "image/jpeg" });
        if (upErr) { failures.push(w.id); continue; }

        const { error: updErr } = await supabase
          .from("wines")
          .update({ photo_url: newPath })
          .eq("id", w.id)
          .eq("user_id", user.id);
        if (updErr) { failures.push(w.id); continue; }

        // Altes Bild aufräumen (Fehler ignorieren)
        if (path !== newPath) {
          await supabase.storage.from(BUCKET).remove([path]);
        }
        updated++;
      } catch (_e) {
        failures.push(w.id);
      }
    }

    return json({ updated, total: wines.length, skipped, failed: failures.length });
  } catch (e) {
    console.error("compress-existing-photos error", e);
    return json({ error: String(e) }, 500);
  }
});
