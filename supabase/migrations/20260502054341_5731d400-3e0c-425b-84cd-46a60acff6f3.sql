ALTER TABLE public.wines
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS food_pairing text,
  ADD COLUMN IF NOT EXISTS drink_from integer,
  ADD COLUMN IF NOT EXISTS drink_to integer;

CREATE INDEX IF NOT EXISTS idx_wines_drink_window ON public.wines (drink_from, drink_to);