
-- Reusable updated_at trigger (may already exist; use existing touch_updated_at)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='touch_updated_at' AND pronamespace='public'::regnamespace) THEN
    CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='public' AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
  END IF;
END $$;

-- Helper to create a jsonb-backed cloud store table with same policies as printers/ip_addresses.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['units_cloud','departments_cloud','it_assets_cloud','accessories_cloud','products_cloud'] LOOP
    EXECUTE format($ddl$
      CREATE TABLE IF NOT EXISTS public.%I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    $ddl$, t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "auth read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "auth read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);

    EXECUTE format('DROP POLICY IF EXISTS "admin write %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "admin write %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), ''admin''::app_role))', t);

    EXECUTE format('DROP POLICY IF EXISTS "admin update %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "admin update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), ''admin''::app_role))', t);

    EXECUTE format('DROP POLICY IF EXISTS "admin delete %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "admin delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), ''admin''::app_role))', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP;
END $$;
