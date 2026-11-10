DROP POLICY IF EXISTS "permitted users create printers" ON public.printers;
DROP POLICY IF EXISTS "permitted users update printers" ON public.printers;
DROP POLICY IF EXISTS "permitted users delete printers" ON public.printers;
DROP POLICY IF EXISTS "auth read printers" ON public.printers;

CREATE POLICY "auth read printers" ON public.printers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert printers" ON public.printers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update printers" ON public.printers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete printers" ON public.printers FOR DELETE TO authenticated USING (true);