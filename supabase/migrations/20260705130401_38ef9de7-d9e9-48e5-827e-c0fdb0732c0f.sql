DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'units_cloud','departments_cloud','it_assets_cloud','accessories_cloud','products_cloud',
    'ip_addresses','printers','wifi_networks','sticker_buyers','sticker_transactions'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;