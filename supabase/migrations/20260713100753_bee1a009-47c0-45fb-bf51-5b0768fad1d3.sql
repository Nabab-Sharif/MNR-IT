-- Tighten old switch table write policies that were allowing any signed-in user to write.
DROP POLICY IF EXISTS "auth write switches" ON public.switches_cloud;
DROP POLICY IF EXISTS "auth write switch_ports" ON public.switch_ports_cloud;
DROP POLICY IF EXISTS "auth write switch_locations" ON public.switch_locations_cloud;
DROP POLICY IF EXISTS "auth write switch_gates" ON public.switch_gates_cloud;

CREATE POLICY "permitted users create switches"
ON public.switches_cloud
FOR INSERT
TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'add'));

CREATE POLICY "permitted users update switches"
ON public.switches_cloud
FOR UPDATE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'));

CREATE POLICY "permitted users delete switches"
ON public.switches_cloud
FOR DELETE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'delete'));

CREATE POLICY "permitted users create switch_ports"
ON public.switch_ports_cloud
FOR INSERT
TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'add'));

CREATE POLICY "permitted users update switch_ports"
ON public.switch_ports_cloud
FOR UPDATE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'));

CREATE POLICY "permitted users delete switch_ports"
ON public.switch_ports_cloud
FOR DELETE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'delete'));

CREATE POLICY "permitted users create switch_locations"
ON public.switch_locations_cloud
FOR INSERT
TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'add'));

CREATE POLICY "permitted users update switch_locations"
ON public.switch_locations_cloud
FOR UPDATE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'));

CREATE POLICY "permitted users delete switch_locations"
ON public.switch_locations_cloud
FOR DELETE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'delete'));

CREATE POLICY "permitted users create switch_gates"
ON public.switch_gates_cloud
FOR INSERT
TO authenticated
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'add'));

CREATE POLICY "permitted users update switch_gates"
ON public.switch_gates_cloud
FOR UPDATE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'))
WITH CHECK (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'edit'));

CREATE POLICY "permitted users delete switch_gates"
ON public.switch_gates_cloud
FOR DELETE
TO authenticated
USING (public.has_route_permission(auth.uid(), '/switch-port-mapping', 'delete'));

-- Make admin checks usable inside RLS, but not callable through the client API.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_super_admin FROM public.access_users WHERE user_id = _user_id), false)
$function$;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  UPDATE public.access_users SET last_seen = now() WHERE user_id = auth.uid();
$function$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated, service_role;