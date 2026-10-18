
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['units_cloud','departments_cloud','it_assets_cloud','accessories_cloud','products_cloud'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE text USING id::text', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid()::text', t);
  END LOOP;
END $$;
