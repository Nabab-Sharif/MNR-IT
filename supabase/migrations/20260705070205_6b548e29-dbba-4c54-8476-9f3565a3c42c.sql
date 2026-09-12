GRANT DELETE ON public.activity_log TO authenticated;
CREATE POLICY "activity_log_delete_authenticated"
  ON public.activity_log FOR DELETE TO authenticated
  USING (true);