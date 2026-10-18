
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Access users (Access ID login mapping)
CREATE TABLE public.access_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_id text NOT NULL UNIQUE,
  label text,
  default_route text NOT NULL DEFAULT '/',
  allowed_routes text[] NOT NULL DEFAULT '{}',
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_users TO authenticated;
GRANT ALL ON public.access_users TO service_role;
ALTER TABLE public.access_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.access_users WHERE user_id = _user_id), false)
$$;

-- Anyone signed in can read the mapping (needed on login to look up self)
CREATE POLICY "auth read access_users" ON public.access_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin insert access_users" ON public.access_users FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin update access_users" ON public.access_users FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admin delete access_users" ON public.access_users FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()) AND NOT is_super_admin);

-- Generic keyed JSON store used by all sections (Dashboard/Units/Assets/Printers/Wifi/IP/Sticker)
CREATE TABLE public.app_data (
  collection text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX app_data_collection_idx ON public.app_data(collection);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_data TO authenticated;
GRANT ALL ON public.app_data TO service_role;
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read app_data" ON public.app_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write app_data insert" ON public.app_data FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write app_data update" ON public.app_data FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins write app_data delete" ON public.app_data FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER app_data_touch BEFORE UPDATE ON public.app_data FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER access_users_touch BEFORE UPDATE ON public.access_users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_users;
