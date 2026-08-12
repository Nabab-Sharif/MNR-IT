CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT au.is_super_admin
    FROM public.access_users au
    WHERE au.user_id = _user_id
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.has_route_permission(_user_id uuid, _route text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT
      au.is_super_admin
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR (
        au.allowed_routes @> ARRAY[_route]
        AND COALESCE((au.route_permissions -> _route ->> _action)::boolean, false)
      )
    FROM public.access_users au
    WHERE au.user_id = _user_id
  ), false)
$function$;

DROP POLICY IF EXISTS "admin write units_cloud" ON public.units_cloud;
DROP POLICY IF EXISTS "admin update units_cloud" ON public.units_cloud;
DROP POLICY IF EXISTS "admin delete units_cloud" ON public.units_cloud;
CREATE POLICY "permitted users create units_cloud"
ON public.units_cloud FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/departments', 'add'));
CREATE POLICY "permitted users update units_cloud"
ON public.units_cloud FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/departments', 'edit'));
CREATE POLICY "permitted users delete units_cloud"
ON public.units_cloud FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/departments', 'delete'));

DROP POLICY IF EXISTS "admin write departments_cloud" ON public.departments_cloud;
DROP POLICY IF EXISTS "admin update departments_cloud" ON public.departments_cloud;
DROP POLICY IF EXISTS "admin delete departments_cloud" ON public.departments_cloud;
CREATE POLICY "permitted users create departments_cloud"
ON public.departments_cloud FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/departments', 'add'));
CREATE POLICY "permitted users update departments_cloud"
ON public.departments_cloud FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/departments', 'edit'));
CREATE POLICY "permitted users delete departments_cloud"
ON public.departments_cloud FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/departments', 'delete'));

DROP POLICY IF EXISTS "admin write accessories_cloud" ON public.accessories_cloud;
DROP POLICY IF EXISTS "admin update accessories_cloud" ON public.accessories_cloud;
DROP POLICY IF EXISTS "admin delete accessories_cloud" ON public.accessories_cloud;
CREATE POLICY "permitted users create accessories_cloud"
ON public.accessories_cloud FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/accessories', 'add'));
CREATE POLICY "permitted users update accessories_cloud"
ON public.accessories_cloud FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/accessories', 'edit'));
CREATE POLICY "permitted users delete accessories_cloud"
ON public.accessories_cloud FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/accessories', 'delete'));

DROP POLICY IF EXISTS "auth write it_assets_cloud" ON public.it_assets_cloud;
DROP POLICY IF EXISTS "auth update it_assets_cloud" ON public.it_assets_cloud;
DROP POLICY IF EXISTS "auth delete it_assets_cloud" ON public.it_assets_cloud;
CREATE POLICY "permitted users create it_assets_cloud"
ON public.it_assets_cloud FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/accessories', 'add'));
CREATE POLICY "permitted users update it_assets_cloud"
ON public.it_assets_cloud FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/accessories', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/accessories', 'edit'));
CREATE POLICY "permitted users delete it_assets_cloud"
ON public.it_assets_cloud FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/accessories', 'delete'));

DROP POLICY IF EXISTS "admin write products_cloud" ON public.products_cloud;
DROP POLICY IF EXISTS "admin update products_cloud" ON public.products_cloud;
DROP POLICY IF EXISTS "admin delete products_cloud" ON public.products_cloud;
CREATE POLICY "permitted users create products_cloud"
ON public.products_cloud FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), 'https://mnritasset.netlify.app', 'add'));
CREATE POLICY "permitted users update products_cloud"
ON public.products_cloud FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), 'https://mnritasset.netlify.app', 'edit'));
CREATE POLICY "permitted users delete products_cloud"
ON public.products_cloud FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), 'https://mnritasset.netlify.app', 'delete'));

DROP POLICY IF EXISTS "admin write printers" ON public.printers;
DROP POLICY IF EXISTS "admin update printers" ON public.printers;
DROP POLICY IF EXISTS "admin delete printers" ON public.printers;
CREATE POLICY "permitted users create printers"
ON public.printers FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/printers', 'add'));
CREATE POLICY "permitted users update printers"
ON public.printers FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/printers', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/printers', 'edit'));
CREATE POLICY "permitted users delete printers"
ON public.printers FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/printers', 'delete'));

DROP POLICY IF EXISTS "admin write wifi" ON public.wifi_networks;
DROP POLICY IF EXISTS "admin update wifi" ON public.wifi_networks;
DROP POLICY IF EXISTS "admin delete wifi" ON public.wifi_networks;
CREATE POLICY "permitted users create wifi"
ON public.wifi_networks FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/wifi-list', 'add'));
CREATE POLICY "permitted users update wifi"
ON public.wifi_networks FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/wifi-list', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/wifi-list', 'edit'));
CREATE POLICY "permitted users delete wifi"
ON public.wifi_networks FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/wifi-list', 'delete'));

DROP POLICY IF EXISTS "admin write ip" ON public.ip_addresses;
DROP POLICY IF EXISTS "admin update ip" ON public.ip_addresses;
DROP POLICY IF EXISTS "admin delete ip" ON public.ip_addresses;
CREATE POLICY "permitted users create ip"
ON public.ip_addresses FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/ip-addresses', 'add'));
CREATE POLICY "permitted users update ip"
ON public.ip_addresses FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/ip-addresses', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/ip-addresses', 'edit'));
CREATE POLICY "permitted users delete ip"
ON public.ip_addresses FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/ip-addresses', 'delete'));

DROP POLICY IF EXISTS "admin write sticker_buyers" ON public.sticker_buyers;
DROP POLICY IF EXISTS "admin update sticker_buyers" ON public.sticker_buyers;
DROP POLICY IF EXISTS "admin delete sticker_buyers" ON public.sticker_buyers;
CREATE POLICY "permitted users create sticker_buyers"
ON public.sticker_buyers FOR INSERT TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/sticker-printer', 'add'));
CREATE POLICY "permitted users update sticker_buyers"
ON public.sticker_buyers FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/sticker-printer', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/sticker-printer', 'edit'));
CREATE POLICY "permitted users delete sticker_buyers"
ON public.sticker_buyers FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/sticker-printer', 'delete'));

DROP POLICY IF EXISTS "admin write sticker_txns" ON public.sticker_transactions;
DROP POLICY IF EXISTS "admin update sticker_txns" ON public.sticker_transactions;
DROP POLICY IF EXISTS "admin delete sticker_txns" ON public.sticker_transactions;
CREATE POLICY "permitted users create sticker_txns"
ON public.sticker_transactions FOR INSERT TO authenticated
WITH CHECK (
  public.has_route_permission(auth.uid(), '/sticker-printer', 'add')
  OR public.has_route_permission(auth.uid(), '/sticker-printer', 'recv')
  OR public.has_route_permission(auth.uid(), '/sticker-printer', 'issue')
);
CREATE POLICY "permitted users update sticker_txns"
ON public.sticker_transactions FOR UPDATE TO authenticated
USING (public.has_route_permission(auth.uid(), '/sticker-printer', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/sticker-printer', 'edit'));
CREATE POLICY "permitted users delete sticker_txns"
ON public.sticker_transactions FOR DELETE TO authenticated
USING (public.has_route_permission(auth.uid(), '/sticker-printer', 'delete'));

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated, service_role;