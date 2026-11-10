
ALTER TABLE public.access_users ADD COLUMN IF NOT EXISTS last_seen timestamptz;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.access_users SET last_seen = now() WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
