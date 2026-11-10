DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nvrs_cloud','cctv_checklists_cloud','cctv_cameras_cloud'] LOOP
    EXECUTE format('CREATE TABLE public.%I (id text PRIMARY KEY, data jsonb NOT NULL DEFAULT ''{}''::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "auth read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "permitted create %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_route_permission(auth.uid(), ''/cctv-checklist'', ''add''))', t, t);
    EXECUTE format('CREATE POLICY "permitted update %s" ON public.%I FOR UPDATE TO authenticated USING (public.has_route_permission(auth.uid(), ''/cctv-checklist'', ''edit''))', t, t);
    EXECUTE format('CREATE POLICY "permitted delete %s" ON public.%I FOR DELETE TO authenticated USING (public.has_route_permission(auth.uid(), ''/cctv-checklist'', ''delete''))', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t, t);
  END LOOP;
END $$;