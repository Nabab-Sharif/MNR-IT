CREATE TABLE public.sticker_print_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id text NOT NULL,
  print_date date NOT NULL DEFAULT CURRENT_DATE,
  pcs numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sticker_print_history_buyer_date_idx ON public.sticker_print_history (buyer_id, print_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_print_history TO authenticated;
GRANT ALL ON public.sticker_print_history TO service_role;
ALTER TABLE public.sticker_print_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read print history" ON public.sticker_print_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitted create print history" ON public.sticker_print_history FOR INSERT TO authenticated WITH CHECK (public.has_route_permission(auth.uid(), '/sticker-printer/print-history', 'add'));
CREATE POLICY "permitted update print history" ON public.sticker_print_history FOR UPDATE TO authenticated USING (public.has_route_permission(auth.uid(), '/sticker-printer/print-history', 'edit'));
CREATE POLICY "permitted delete print history" ON public.sticker_print_history FOR DELETE TO authenticated USING (public.has_route_permission(auth.uid(), '/sticker-printer/print-history', 'delete'));
CREATE TRIGGER sticker_print_history_touch BEFORE UPDATE ON public.sticker_print_history FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();