import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export type PermKey = "add" | "edit" | "delete" | "recv" | "issue" | "export" | "import" | "print";

/**
 * Returns per-action permissions for the current route (or a given path).
 * Super admins always get full permissions.
 */
export function usePerm(path?: string) {
  const { access } = useAuth();
  const location = useLocation();
  const key = path || location.pathname;

  if (!access) return { add: false, edit: false, delete: false, recv: false, issue: false, export: false, import: false, print: false };
  if (access.is_super_admin) return { add: true, edit: true, delete: true, recv: true, issue: true, export: true, import: true, print: true };

  const p = (access.route_permissions || {})[key] || {};
  return {
    add: !!p.add,
    edit: !!p.edit,
    delete: !!p.delete,
    recv: !!p.recv,
    issue: !!p.issue,
    export: !!p.export,
    import: !!p.import,
    print: !!p.print,
  };
}