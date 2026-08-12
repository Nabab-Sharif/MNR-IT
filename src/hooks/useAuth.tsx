import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AccessUser = {
  user_id: string;
  access_id: string;
  label: string | null;
  default_route: string;
  allowed_routes: string[];
  is_super_admin: boolean;
  route_permissions?: Record<string, { add?: boolean; edit?: boolean; delete?: boolean; recv?: boolean; issue?: boolean; export?: boolean; import?: boolean; print?: boolean }>;
  full_name?: string | null;
  designation?: string | null;
  department?: string | null;
  unit_office?: string | null;
  phone?: string | null;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  access: AccessUser | null;
  loading: boolean;
  signInWithAccessId: (accessId: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccess = async (uid: string) => {
    const { data } = await supabase.from("access_users").select("*").eq("user_id", uid).maybeSingle();
    setAccess((data as AccessUser) || null);
  };

  useEffect(() => {
    // Non-blocking auth initialization
    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadAccess(data.session.user.id);
        }
      } finally {
        setLoading(false);
      }
    };

    // Use setTimeout to defer auth check until after initial render
    const timer = setTimeout(initAuth, 0);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadAccess(s.user.id);
      else setAccess(null);
    });

    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Keep permissions fresh while a user is already signed in.
  // Super Admin changes should apply immediately without requiring logout/login.
  useEffect(() => {
    if (!user?.id) return;
    loadAccess(user.id);
    const channel = supabase
      .channel(`access_user_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_users", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") setAccess(null);
          else setAccess((payload.new as AccessUser) || null);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Presence heartbeat: record last_seen every minute while signed in.
  useEffect(() => {
    if (!user) return;
    const ping = () => { supabase.rpc("touch_last_seen").then(() => { }); };
    ping();
    const iv = setInterval(ping, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [user]);

  const signInWithAccessId = async (accessId: string) => {
    const id = accessId.trim();
    if (!id) throw new Error("Access ID required");
    // Fast path: credentials are deterministic. Skip the edge function entirely
    // on normal logins to avoid cold-start latency.
    const email = `id${id}@access.mnr.local`;
    const password = `${id}#mnr-2026-access`;
    const { error: sErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!sErr) return;
    // Fallback: unknown user — let the edge function bootstrap (super admin) or reject.
    const { data, error } = await supabase.functions.invoke("access-login", { body: { access_id: id } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    const { error: sErr2 } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
    if (sErr2) throw sErr2;
  };

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshAccess = async () => { if (user) await loadAccess(user.id); };

  return (
    <AuthCtx.Provider value={{ session, user, access, loading, signInWithAccessId, signOut, refreshAccess }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}