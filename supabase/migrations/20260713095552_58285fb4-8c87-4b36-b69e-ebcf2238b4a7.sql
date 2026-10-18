DROP POLICY IF EXISTS "admin write it_assets_cloud" ON public.it_assets_cloud;
DROP POLICY IF EXISTS "admin update it_assets_cloud" ON public.it_assets_cloud;
DROP POLICY IF EXISTS "admin delete it_assets_cloud" ON public.it_assets_cloud;
CREATE POLICY "auth write it_assets_cloud" ON public.it_assets_cloud FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update it_assets_cloud" ON public.it_assets_cloud FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete it_assets_cloud" ON public.it_assets_cloud FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);