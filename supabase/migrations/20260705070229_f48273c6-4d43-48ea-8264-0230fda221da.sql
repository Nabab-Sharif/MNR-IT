DROP POLICY IF EXISTS "activity_log_delete_authenticated" ON public.activity_log;
CREATE POLICY "activity_log_delete_super_admin"
  ON public.activity_log FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));