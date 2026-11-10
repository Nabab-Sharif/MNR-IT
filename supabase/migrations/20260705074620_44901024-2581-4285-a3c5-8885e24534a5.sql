
-- 1) IP Addresses
CREATE TABLE public.ip_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  series TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  used_by TEXT DEFAULT '',
  user_department TEXT DEFAULT '',
  unit_office TEXT DEFAULT '',
  device_type TEXT DEFAULT '',
  added_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_addresses TO authenticated;
GRANT ALL ON public.ip_addresses TO service_role;
ALTER TABLE public.ip_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all ip" ON public.ip_addresses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER ip_touch BEFORE UPDATE ON public.ip_addresses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Printers
CREATE TABLE public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printer_name TEXT NOT NULL,
  printer_model TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  unit_number TEXT DEFAULT '',
  department_name TEXT DEFAULT '',
  added_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.printers TO authenticated;
GRANT ALL ON public.printers TO service_role;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all printers" ON public.printers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER printers_touch BEFORE UPDATE ON public.printers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) WiFi
CREATE TABLE public.wifi_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wifi_name TEXT NOT NULL,
  wifi_password TEXT DEFAULT '',
  wifi_qr_code TEXT DEFAULT '',
  office_name TEXT DEFAULT '',
  department_name TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  added_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wifi_networks TO authenticated;
GRANT ALL ON public.wifi_networks TO service_role;
ALTER TABLE public.wifi_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all wifi" ON public.wifi_networks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER wifi_touch BEFORE UPDATE ON public.wifi_networks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Sticker Printer Buyers
CREATE TABLE public.sticker_buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name TEXT NOT NULL,
  merchandiser_name TEXT DEFAULT '',
  merchandiser_phone TEXT DEFAULT '',
  merchandiser_email TEXT DEFAULT '',
  gpq_name TEXT DEFAULT '',
  gpq_phone TEXT DEFAULT '',
  gpq_email TEXT DEFAULT '',
  store_officer_name TEXT DEFAULT '',
  store_officer_phone TEXT DEFAULT '',
  store_officer_email TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_buyers TO authenticated;
GRANT ALL ON public.sticker_buyers TO service_role;
ALTER TABLE public.sticker_buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all sticker_buyers" ON public.sticker_buyers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sticker_buyers_touch BEFORE UPDATE ON public.sticker_buyers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Sticker Printer Transactions (buyer_transactions in IndexedDB)
CREATE TABLE public.sticker_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.sticker_buyers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  roll NUMERIC NOT NULL DEFAULT 0,
  pcs NUMERIC NOT NULL DEFAULT 0,
  po_no TEXT DEFAULT '',
  style TEXT DEFAULT '',
  color TEXT DEFAULT '',
  roll_no TEXT DEFAULT '',
  receive_date TEXT,
  si_number TEXT DEFAULT '',
  delivered_by TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  sticker_size TEXT DEFAULT '',
  pcs_per_roll NUMERIC,
  length_per_roll NUMERIC,
  total_length NUMERIC,
  sl_no TEXT DEFAULT '',
  source_receive_id UUID,
  sub_roll_index INTEGER,
  note TEXT DEFAULT '',
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sticker_transactions TO authenticated;
GRANT ALL ON public.sticker_transactions TO service_role;
ALTER TABLE public.sticker_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated all sticker_txns" ON public.sticker_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sticker_txn_touch BEFORE UPDATE ON public.sticker_transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_sticker_txn_buyer ON public.sticker_transactions(buyer_id);
CREATE INDEX idx_sticker_txn_type ON public.sticker_transactions(type);
