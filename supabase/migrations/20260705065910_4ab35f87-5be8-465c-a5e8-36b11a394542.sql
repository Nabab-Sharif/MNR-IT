CREATE TABLE public.recycle_bin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id text,
  entity_label text,
  collection text,
  payload jsonb NOT NULL,
  deleted_by uuid NOT NULL,
  deleted_by_label text,
  deleted_by_access_id text,
  route text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.recycle_bin TO authenticated;
GRANT ALL ON public.recycle_bin TO service_role;

ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read recycle_bin" ON public.recycle_bin
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert own recycle_bin" ON public.recycle_bin
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = deleted_by);

CREATE POLICY "auth delete recycle_bin" ON public.recycle_bin
  FOR DELETE TO authenticated USING (auth.uid() = deleted_by OR is_super_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.recycle_bin;