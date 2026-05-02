ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS pairing_categories text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_wines_pairing_categories ON public.wines USING GIN (pairing_categories);