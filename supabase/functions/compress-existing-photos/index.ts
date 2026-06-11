import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import decodeJpeg, { init as initJpegDecode } from "https://esm.sh/@jsquash/jpeg@1.4.0/decode?bundle";
import encodeJpeg, { init as initJpegEncode } from "https://esm.sh/@jsquash/jpeg@1.4.0/encode?bundle";
import decodePng, { init as initPngDecode } from "https://esm.sh/@jsquash/png@3.0.1/decode?bundle";
import resize, { initResize } from "https://esm.sh/@jsquash/resize@2.1.0?bundle";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "wine-photos";
const MAX_EDGE = 1600;
const QUALITY = 78;

let wasmReady = false;
const ensureWasm = async () => {
  if (wasmReady) return;
  await Promise.all([initJpegDecode(), initJpegEncode(), initPngDecode(), initResize()]);
  wasmReady = true;
};

/** Extract storage path from a stored public/signed URL or a raw path. */
const extractPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return value.startsWith("http") ? null : value;
  return value.substring(idx + marker.length).split("?")[0];
};

const decodeImage = async (bytes: Uint8Array, path: string): Promise<ImageData | null> => {
  const lower = path.toLowerCase();
  try {
    if (lower.endsWith(".png")) return await decodePng(bytes.buffer);
    return await decodeJpeg(bytes.buffer);
  } catch {
    // Fallback: try the other decoder
    try {
      return lower.endsWith(".png") ? await decodeJpeg(bytes.buffer) : await decodePng(bytes.buffer);
    } catch {
      return null;
    }
  }
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

    // Eine Datei pro Aufruf, um Speicher-/CPU-Limits zu vermeiden
    let batchSize = 1;
    try {
      const body = await req.json();
      if (body && Number.isFinite(body.batch_size)) {
        batchSize = Math.min(3, Math.max(1, Math.floor(body.batch_size)));
      }
    } catch (_e) { /* kein Body -> Default */ }

    const { data: wines, error } = await supabase
      .from("wines")
      .select("id, photo_url")
      .eq("user_id", user.id)
      .eq("photo_compressed", false)
      .not("photo_url", "is", null)
      .limit(batchSize);
    if (error) return json({ error: error.message }, 500);

    const { count: remainingBefore } = await supabase
      .from("wines")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("photo_compressed", false)
      .not("photo_url", "is", null);

    if (!wines || wines.length === 0) {
      return json({ updated: 0, processed: 0, skipped: 0, failed: 0, remaining: 0, done: true });
    }

    await ensureWasm();

    let updated = 0;
    let skipped = 0;
    const failures: string[] = [];

    const markDone = async (id: string) => {
      await supabase
        .from("wines")
        .update({ photo_compressed: true })
        .eq("id", id)
        .eq("user_id", user.id);
    };

    for (const w of wines) {
      const path = extractPath(w.photo_url);
      if (!path) { skipped++; await markDone(w.id); continue; }

      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
        if (dlErr || !blob) { failures.push(w.id); await markDone(w.id); continue; }

        const originalBytes = new Uint8Array(await blob.arrayBuffer());

        let image = await decodeImage(originalBytes, path);
        if (!image) { skipped++; await markDone(w.id); continue; }

        const longEdge = Math.max(image.width, image.height);
        if (longEdge > MAX_EDGE) {
          const scale = MAX_EDGE / longEdge;
          image = await resize(image, {
            width: Math.round(image.width * scale),
            height: Math.round(image.height * scale),
          });
        }

        const compressed = new Uint8Array(await encodeJpeg(image, { quality: QUALITY }));

        if (compressed.length >= originalBytes.length) { skipped++; await markDone(w.id); continue; }

        const newPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(newPath, compressed, { contentType: "image/jpeg" });
        if (upErr) { failures.push(w.id); continue; }

        const { error: updErr } = await supabase
          .from("wines")
          .update({ photo_url: newPath, photo_compressed: true })
          .eq("id", w.id)
          .eq("user_id", user.id);
        if (updErr) { failures.push(w.id); continue; }

        if (path !== newPath) {
          await supabase.storage.from(BUCKET).remove([path]);
        }
        updated++;
      } catch (e) {
        console.error("compress failure", w.id, String(e));
        failures.push(w.id);
      }
    }

    const remaining = Math.max(0, (remainingBefore ?? wines.length) - wines.length);
    return json({
      updated,
      processed: wines.length,
      skipped,
      failed: failures.length,
      remaining,
      done: remaining === 0,
    });
  } catch (e) {
    console.error("compress-existing-photos error", e);
    return json({ error: String(e) }, 500);
  }
});
