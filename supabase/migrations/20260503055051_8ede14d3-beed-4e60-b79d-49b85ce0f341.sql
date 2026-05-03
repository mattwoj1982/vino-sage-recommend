
DROP POLICY IF EXISTS "Wein-Fotos lesen (Eigentümer oder geteilt)" ON storage.objects;

CREATE POLICY "Wein-Fotos lesen (Eigentümer oder geteilt)"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'wine-photos'
  AND (
    (auth.uid())::text = (storage.foldername(storage.objects.name))[1]
    OR EXISTS (
      SELECT 1 FROM public.share_links sl
      WHERE sl.is_active = true
        AND sl.user_id::text = (storage.foldername(storage.objects.name))[1]
    )
  )
);
