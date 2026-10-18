REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_route_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated, service_role;