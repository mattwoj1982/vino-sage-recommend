
-- 1) Make wine-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'wine-photos';

-- 2) Replace storage SELECT policy: owner OR via active share link
DROP POLICY IF EXISTS "Wein-Fotos öffentlich lesen" ON storage.objects;
DROP POLICY IF EXISTS "Eigene Wein-Fotos lesen" ON storage.objects;

CREATE POLICY "Wein-Fotos lesen (Eigentümer oder geteilt)"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'wine-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.share_links sl
      WHERE sl.is_active = true
        AND sl.user_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 3) Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 4) Revoke EXECUTE from anon/authenticated on internal trigger functions
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
