import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Splash from "@/components/Splash";

export default function RequireAuth({ children, superOnly = false }: { children: ReactNode; superOnly?: boolean }) {
  const { session, access, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <Splash label="Loading your workspace…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!access) return <AccessDenied />;
  if (superOnly && !access?.is_super_admin) return <Navigate to={access?.default_route || "/"} replace />;

  // Route permission (super admin bypasses)
  if (!access.is_super_admin) {
    const path = loc.pathname;
    const routes = access.allowed_routes || [];
    const allowed = routes.some((r) => path === r || path.startsWith(r + "/"));
    if (!allowed) {
      const fallback = routes.includes(access.default_route) ? access.default_route : routes[0];
      return fallback ? <Navigate to={fallback} replace /> : <AccessDenied />;
    }
  }
  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-sm w-full rounded-xl border-2 border-destructive/40 bg-card p-6 text-center shadow-lg">
        <div className="text-lg font-semibold text-foreground">No page permission</div>
        <p className="text-sm text-muted-foreground mt-2">Please contact Super Admin to enable access.</p>
      </div>
    </div>
  );
}