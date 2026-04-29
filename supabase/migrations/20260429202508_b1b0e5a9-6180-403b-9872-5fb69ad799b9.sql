
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile selbst lesen" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profile selbst aktualisieren" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profile selbst einfügen" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Wines table
CREATE TABLE public.wines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  winery TEXT,
  vintage INTEGER,
  grape_variety TEXT,
  region TEXT,
  rating INTEGER CHECK (rating BETWEEN 0 AND 5),
  notes TEXT,
  photo_url TEXT,
  bottle_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Weine lesen" ON public.wines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Eigene Weine erstellen" ON public.wines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Eigene Weine aktualisieren" ON public.wines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Eigene Weine löschen" ON public.wines FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_wines_user_id ON public.wines(user_id);

-- Share links table
CREATE TABLE public.share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Links lesen" ON public.share_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Eigene Links erstellen" ON public.share_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Eigene Links aktualisieren" ON public.share_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Eigene Links löschen" ON public.share_links FOR DELETE USING (auth.uid() = user_id);

-- Public read function for shared wine list (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_shared_wines(share_token TEXT)
RETURNS SETOF public.wines
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_user_id UUID;
BEGIN
  SELECT user_id INTO link_user_id
  FROM public.share_links
  WHERE token = share_token AND is_active = true;
  
  IF link_user_id IS NULL THEN
    RETURN;
  END IF;
  
  RETURN QUERY SELECT * FROM public.wines WHERE user_id = link_user_id ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_share_owner_name(share_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_name TEXT;
BEGIN
  SELECT p.display_name INTO owner_name
  FROM public.share_links sl
  JOIN public.profiles p ON p.id = sl.user_id
  WHERE sl.token = share_token AND sl.is_active = true;
  RETURN owner_name;
END;
$$;

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wines_updated_at BEFORE UPDATE ON public.wines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('wine-photos', 'wine-photos', true);

CREATE POLICY "Wein-Fotos öffentlich lesbar" ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-photos');

CREATE POLICY "Eigene Wein-Fotos hochladen" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Eigene Wein-Fotos aktualisieren" ON storage.objects FOR UPDATE
  USING (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Eigene Wein-Fotos löschen" ON storage.objects FOR DELETE
  USING (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
