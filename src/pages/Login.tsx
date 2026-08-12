import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, ShieldCheck, Sparkles, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const Login = () => {
  const nav = useNavigate();
  const { signInWithAccessId, session, access, loading } = useAuth();
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [showId, setShowId] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted && session && access) nav(access.default_route || "/", { replace: true });
  }, [loading, session, access, nav, mounted]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithAccessId(id);
      toast.success("Welcome back", {
        description: "Signed in successfully",
        className:
          "border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/60 dark:to-slate-900 shadow-[0_0_25px_-5px_hsl(var(--primary)/0.6)] rounded-xl",
      });
    } catch (err: any) {
      toast.error("Invalid Access ID", {
        description: err.message || "Please check your Access ID and try again.",
        className:
          "border-2 border-destructive/70 bg-gradient-to-br from-red-50 to-white dark:from-red-950/60 dark:to-slate-900 shadow-[0_0_25px_-5px_hsl(var(--destructive)/0.7)] rounded-xl",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4 login-page">
      {/* Optimized aurora backdrop - reduced blur and complexity */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-sky-500/20 blur-2xl" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:32px_32px]" />
      </div>

      <div className="relative w-full max-w-7xl grid lg:grid-cols-2 gap-16 lg:gap-40 items-center">
        {/* Left: brand panel */}
        <div className="hidden lg:block text-white space-y-6 pr-8 animate-login-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20 text-xs uppercase tracking-widest login-word" style={{ animationDelay: "0.1s" }}>
            <Sparkles className="w-3.5 h-3.5" /> MNR Group
          </div>
          <h1 className="text-6xl font-bold leading-[1.05] tracking-tight flex flex-wrap gap-x-3">
            {["IT", "Assets,"].map((w, i) => (
              <span key={`a${i}`} className="login-word inline-block" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>{w}</span>
            ))}
            <span className="w-full" />
            {["everything", "in", "one", "place."].map((w, i) => (
              <span key={`b${i}`} className="login-word inline-block bg-gradient-to-r from-sky-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent" style={{ animationDelay: `${0.35 + i * 0.05}s` }}>{w}</span>
            ))}
          </h1>
          <p className="text-lg text-white/70 max-w-md flex flex-wrap gap-x-1.5">
            {"Realtime dashboard for units, users, printers, WiFi, IP addresses and stickers — synchronized across every device.".split(" ").map((w, i) => (
              <span key={i} className="login-word inline-block" style={{ animationDelay: `${0.55 + i * 0.02}s` }}>{w}</span>
            ))}
          </p>
          <div className="flex items-center gap-2 text-white/60 text-sm pt-4 login-word" style={{ animationDelay: "1.2s" }}>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Encrypted end-to-end · Role-based access
          </div>
        </div>

        {/* Right: glass card */}
        <div className="relative group animate-login-right">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-sky-400 via-fuchsia-500 to-emerald-400 rounded-3xl blur opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="relative rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 sm:p-10 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-8">
              <img
                src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png"
                alt="MNR"
                className="w-24 h-24 rounded-full bg-white p-2 object-contain shadow-lg ring-4 ring-white/20"
              />
              <div className="mt-4 text-white font-bold text-2xl tracking-tight">MNR Group IT</div>
              <div className="text-white/50 text-xs mt-1">Sign in with your Access ID</div>
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="aid" className="block text-xs uppercase tracking-widest text-white/50 mb-2">Access ID</label>
                <div className="relative">
                  <Input
                    id="aid" autoFocus inputMode="numeric" value={id}
                    type="text"
                    style={{ WebkitTextSecurity: showId ? 'none' : 'disc', textSecurity: showId ? 'none' : 'disc' } as React.CSSProperties}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    name="access-id-no-autofill"
                    onChange={(e) => setId(e.target.value)}
                    placeholder="Enter your access ID"
                    className="h-14 pl-4 pr-12 bg-white/5 border-white/10 text-white text-lg tracking-wider placeholder:text-white/30 focus-visible:ring-sky-400 focus-visible:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowId((v) => !v)}
                    aria-label={showId ? "Hide access ID" : "Show access ID"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  >
                    {showId ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={busy || !id.trim()}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-sky-500 via-fuchsia-500 to-emerald-500 hover:opacity-90 shadow-lg shadow-fuchsia-500/30 border-0"
              >
                {busy
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Signing in…</>
                  : <>Continue <ArrowRight className="w-5 h-5 ml-2" /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-white/40">
              Don't have an Access ID? Contact your Super Admin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;