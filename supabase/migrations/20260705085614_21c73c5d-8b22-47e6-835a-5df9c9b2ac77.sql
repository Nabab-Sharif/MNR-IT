ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS activity_log_seen_idx ON public.activity_log(seen);