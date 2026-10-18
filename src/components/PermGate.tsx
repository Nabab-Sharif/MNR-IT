import { ReactNode } from "react";
import { usePerm, PermKey } from "@/hooks/usePerm";

/**
 * Hides children unless the current user has the requested action permission
 * on the current route. Super admins always pass.
 */
export default function PermGate({
  action,
  path,
  children,
}: {
  action: PermKey;
  path?: string;
  children: ReactNode;
}) {
  const perm = usePerm(path);
  if (!perm[action]) return null;
  return <>{children}</>;
}