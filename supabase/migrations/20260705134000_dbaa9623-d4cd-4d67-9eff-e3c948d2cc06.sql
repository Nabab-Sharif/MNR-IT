-- Cloud storage for Switch Port Mapping (flexible JSONB payload, same shape as units_cloud)
CREATE TABLE public.switches_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.switches_cloud TO authenticated;
GRANT ALL ON public.switches_cloud TO service_role;
ALTER TABLE public.switches_cloud ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read switches" ON public.switches_cloud FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write switches" ON public.switches_cloud FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_switches_cloud_touch BEFORE UPDATE ON public.switches_cloud FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.switch_ports_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.switch_ports_cloud TO authenticated;
GRANT ALL ON public.switch_ports_cloud TO service_role;
ALTER TABLE public.switch_ports_cloud ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read switch_ports" ON public.switch_ports_cloud FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write switch_ports" ON public.switch_ports_cloud FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_switch_ports_cloud_touch BEFORE UPDATE ON public.switch_ports_cloud FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.switch_locations_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.switch_locations_cloud TO authenticated;
GRANT ALL ON public.switch_locations_cloud TO service_role;
ALTER TABLE public.switch_locations_cloud ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read switch_locations" ON public.switch_locations_cloud FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write switch_locations" ON public.switch_locations_cloud FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_switch_locations_cloud_touch BEFORE UPDATE ON public.switch_locations_cloud FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.switch_gates_cloud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.switch_gates_cloud TO authenticated;
GRANT ALL ON public.switch_gates_cloud TO service_role;
ALTER TABLE public.switch_gates_cloud ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read switch_gates" ON public.switch_gates_cloud FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write switch_gates" ON public.switch_gates_cloud FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_switch_gates_cloud_touch BEFORE UPDATE ON public.switch_gates_cloud FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();