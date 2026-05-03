import { supabase } from "@/integrations/supabase/client";

const BUCKET = "wine-photos";

/** Extract storage path from either a stored public/signed URL or a raw path. */
export const extractPhotoPath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) {
    // Already a path (no http)
    return value.startsWith("http") ? null : value;
  }
  const after = value.substring(idx + marker.length);
  // Strip query string (signed URLs)
  return after.split("?")[0];
};

/** Get a short-lived signed URL for a wine photo. Returns null on failure. */
export const getSignedPhotoUrl = async (
  photoUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> => {
  const path = extractPhotoPath(photoUrl);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
