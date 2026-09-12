CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT au.is_super_admin FROM public.access_users au WHERE au.user_id = _user_id), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "own or admin read access_users" ON public.access_users;
DROP POLICY IF EXISTS "super admin insert access_users" ON public.access_users;
DROP POLICY IF EXISTS "super admin update access_users" ON public.access_users;
DROP POLICY IF EXISTS "super admin delete access_users" ON public.access_users;

CREATE POLICY "users read own access row"
ON public.access_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users update own last seen"
ON public.access_users
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.access_users FROM authenticated;
GRANT SELECT ON public.access_users TO authenticated;
GRANT UPDATE(last_seen) ON public.access_users TO authenticated;
GRANT ALL ON public.access_users TO service_role;

CREATE OR REPLACE FUNCTION public.has_route_permission(_user_id uuid, _route text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated, service_role;