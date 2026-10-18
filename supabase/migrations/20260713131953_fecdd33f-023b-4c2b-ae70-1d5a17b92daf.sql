CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT au.is_super_admin FROM public.access_users au WHERE au.user_id = _user_id), false)
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_route_permission(_user_id uuid, _route text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated, service_role;