CREATE TABLE public.ai_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_rate_limits_user_function_idx
  ON public.ai_rate_limits(user_id, function_name);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (bypassing RLS) may access this table.

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _user_id UUID,
  _function_name TEXT,
  _max_requests INTEGER,
  _window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  current_window_start TIMESTAMPTZ;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id, function_name, window_start, request_count)
  VALUES (_user_id, _function_name, now(), 0)
  ON CONFLICT (user_id, function_name) DO NOTHING;

  SELECT request_count, window_start
    INTO current_count, current_window_start
  FROM public.ai_rate_limits
  WHERE user_id = _user_id AND function_name = _function_name
  FOR UPDATE;

  IF current_window_start < now() - (_window_seconds || ' seconds')::interval THEN
    UPDATE public.ai_rate_limits
       SET window_start = now(), request_count = 1, updated_at = now()
     WHERE user_id = _user_id AND function_name = _function_name;
    RETURN TRUE;
  END IF;

  IF current_count >= _max_requests THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ai_rate_limits
     SET request_count = request_count + 1, updated_at = now()
   WHERE user_id = _user_id AND function_name = _function_name;
  RETURN TRUE;
END;
$$;