
CREATE TABLE public.tasting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  wine_id uuid not null references public.wines(id) on delete cascade,
  tasted_at date not null default current_date,
  rating int,
  notes text,
  occasion text,
  photo_url text,
  created_at timestamptz not null default now()
);
ALTER TABLE public.tasting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn select own" ON public.tasting_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tn insert own" ON public.tasting_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tn update own" ON public.tasting_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tn delete own" ON public.tasting_notes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_tasting_notes_wine ON public.tasting_notes(wine_id);
CREATE INDEX idx_tasting_notes_user ON public.tasting_notes(user_id);

CREATE TABLE public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  guest_count int not null default 4,
  courses jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus select own" ON public.menus FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "menus insert own" ON public.menus FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "menus update own" ON public.menus FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "menus delete own" ON public.menus FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_menus_updated BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
