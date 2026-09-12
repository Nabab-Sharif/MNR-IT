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

const accessCacheKey = (uid: string) => `mnr_access_${uid}`;

function readCachedAccess(uid: string): AccessUser | null {
  try {
    const raw = localStorage.getItem(accessCacheKey(uid));
    return raw ? JSON.parse(raw) as AccessUser : null;
  } catch {
    return null;
  }
}

function cacheAccess(uid: string, value: AccessUser | null) {
  try {
    if (value) localStorage.setItem(accessCacheKey(uid), JSON.stringify(value));
    else localStorage.removeItem(accessCacheKey(uid));
  } catch { /* storage unavailable */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAccess = async (uid: string) => {
    const { data, error } = await supabase.from("access_users").select("*").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    const next = (data as AccessUser) || null;
    setAccess(next);
    cacheAccess(uid, next);
  };

  useEffect(() => {
    // Never leave the whole application behind an endless loading screen.
    // The preview session broker can occasionally be slow or unavailable.
    const loadingSafetyTimer = window.setTimeout(() => setLoading(false), 2500);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const cached = readCachedAccess(s.user.id);
        if (cached) {
          setAccess(cached);
          window.clearTimeout(loadingSafetyTimer);
          setLoading(false);
        }
        // Auth callbacks must stay synchronous. Resolve access immediately
        // afterwards and always release the initial screen, even on failure.
        setTimeout(() => {
          loadAccess(s.user.id)
            .catch((error) => console.error("Unable to load access permissions:", error))
            .finally(() => {
              window.clearTimeout(loadingSafetyTimer);
              setLoading(false);
            });
        }, 0);
      } else {
        setAccess(null);
        window.clearTimeout(loadingSafetyTimer);
        setLoading(false);
      }
    });
    supabase.auth.getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          const cached = readCachedAccess(data.session.user.id);
          if (cached) {
            setAccess(cached);
            setLoading(false);
            void loadAccess(data.session.user.id).catch((error) => console.error("Unable to refresh access permissions:", error));
          } else {
            await loadAccess(data.session.user.id);
          }
        } else setAccess(null);
      })
      .catch((error) => console.error("Unable to restore session:", error))
      .finally(() => {
        window.clearTimeout(loadingSafetyTimer);
        setLoading(false);
      });
    return () => {
      window.clearTimeout(loadingSafetyTimer);
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
          if (payload.eventType === "DELETE") {
            setAccess(null);
            cacheAccess(user.id, null);
          } else {
            const next = (payload.new as AccessUser) || null;
            setAccess(next);
            cacheAccess(user.id, next);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Presence heartbeat: record last_seen every minute while signed in.
  useEffect(() => {
    if (!user) return;
    const ping = () => { supabase.rpc("touch_last_seen").then(() => {}); };
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

  const signOut = async () => {
    if (user?.id) cacheAccess(user.id, null);
    await supabase.auth.signOut();
  };
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