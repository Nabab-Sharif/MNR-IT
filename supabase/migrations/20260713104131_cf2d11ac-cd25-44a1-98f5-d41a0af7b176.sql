GRANT SELECT ON public.access_users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.access_users TO authenticated;
GRANT ALL ON public.access_users TO service_role;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

DROP POLICY IF EXISTS "own or admin read access_users" ON public.access_users;
CREATE POLICY "own or admin read access_users"
ON public.access_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));