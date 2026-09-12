
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_id text,
  actor_label text,
  action text NOT NULL CHECK (action IN ('add','edit','delete')),
  entity text NOT NULL,
  entity_id text,
  description text,
  route text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads all activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "users insert own activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX activity_log_created_at_idx ON public.activity_log (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
