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

GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated, anon, service_role;