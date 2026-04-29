
-- Restrict EXECUTE on security definer functions, then grant only to needed roles
REVOKE EXECUTE ON FUNCTION public.get_shared_wines(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_share_owner_name(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_shared_wines(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_share_owner_name(TEXT) TO anon, authenticated;

-- Restrict storage SELECT to direct path access only (no listing)
DROP POLICY IF EXISTS "Wein-Fotos öffentlich lesbar" ON storage.objects;
-- For public buckets, files can still be accessed via public URL without listing.
-- We don't need a SELECT policy for the public URL to work.
