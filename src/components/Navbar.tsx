import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User as UserIcon, Palette, Check, Moon, Sun, BadgeCheck, Briefcase, Building2, MapPin, Bell, PlusCircle, Edit3, Trash, Trash2, X as XIcon, Database, Download, Upload, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NAV_ROUTES } from "@/lib/navRoutes";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { pageDataForRoute } from "@/lib/pageDataRegistry";
import { readSource, writeSource, downloadJSON, pickJSONFile } from "@/lib/dataIO";
import { toast } from "sonner";

const THEMES = [
  { id: "sky", name: "Sky Blue", color: "hsl(200, 100%, 45%)" },
  { id: "ocean", name: "Ocean Blue", color: "hsl(210, 100%, 45%)" },
  { id: "emerald", name: "Emerald Green", color: "hsl(152, 76%, 36%)" },
  { id: "violet", name: "Purple Violet", color: "hsl(270, 70%, 50%)" },
  { id: "sunset", name: "Sunset Orange", color: "hsl(25, 95%, 53%)" },
  { id: "rose", name: "Rose Pink", color: "hsl(340, 82%, 52%)" },
  { id: "teal", name: "Teal Lagoon", color: "hsl(174, 72%, 40%)" },
  { id: "crimson", name: "Crimson Red", color: "hsl(348, 83%, 47%)" },
  { id: "indigo", name: "Deep Indigo", color: "hsl(243, 75%, 55%)" },
  { id: "amber", name: "Golden Amber", color: "hsl(38, 92%, 50%)" },
  { id: "lime", name: "Fresh Lime", color: "hsl(84, 72%, 44%)" },
  { id: "fuchsia", name: "Neon Fuchsia", color: "hsl(292, 84%, 55%)" },
  { id: "slate", name: "Slate Steel", color: "hsl(215, 25%, 40%)" },
  { id: "cyan", name: "Electric Cyan", color: "hsl(190, 95%, 45%)" },
  { id: "royal", name: "Royal Gold", color: "hsl(45, 90%, 48%)" },
  { id: "midnight", name: "Midnight Plum", color: "hsl(260, 55%, 30%)" },
];

const DARK_VARIANTS = [
  { id: "default", name: "Classic", color: "hsl(240, 10%, 4%)" },
  { id: "midnight", name: "Midnight", color: "hsl(230, 45%, 6%)" },
  { id: "ocean", name: "Ocean", color: "hsl(200, 55%, 6%)" },
  { id: "royal", name: "Royal", color: "hsl(275, 40%, 7%)" },
];

const readSettings = () => {
  try { return JSON.parse(localStorage.getItem("mnr_settings") || "{}"); } catch { return {}; }
};

type Notif = {
  id: string;
  action: "add" | "edit" | "delete" | "issue" | "receive" | "print";
  entity: string;
  entity_id: string | null;
  actor_label: string | null;
  access_id: string | null;
  description: string | null;
  route: string | null;
  created_at: string;
  seen: boolean;
};

const fmtWhen = (ts: string) => {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString([], { weekday: "short" });
  const date = d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  return `${time} · ${day}, ${date}`;
};

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { access, session, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>(() => readSettings().theme || "sky");
  const [darkMode, setDarkMode] = useState<boolean>(() => !!readSettings().darkMode);
  const [darkVariant, setDarkVariant] = useState<string>(() => readSettings().darkVariant || "default");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<"all" | "unseen" | "seen">("all");
  const unread = notifs.filter((n) => !n.seen).length;

  useEffect(() => {
    if (!access?.is_super_admin) return;
    let cancelled = false;
    const fetchLatest = async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, action, entity, entity_id, actor_label, access_id, description, route, created_at, seen")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) {
        setNotifs((prev) => {
          // merge: keep local `seen` optimistic updates but pull in new rows
          const bySeen = new Map(prev.map((n) => [n.id, n.seen] as const));
          return (data as Notif[]).map((n) => ({ ...n, seen: bySeen.get(n.id) ?? n.seen }));
        });
      }
    };
    fetchLatest();
    // Polling fallback in case realtime is delayed / disconnected.
    const poll = setInterval(fetchLatest, 15000);

    const channel = supabase
      .channel("navbar_activity_notifications")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notif;
            setNotifs((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 50)));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Notif;
            setNotifs((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id: string }).id;
            setNotifs((prev) => prev.filter((n) => n.id !== oldId));
          }
        },
      )
      .subscribe();
    // Refresh on tab focus so a super admin returning to the tab sees anything missed.
    const onVis = () => { if (document.visibilityState === "visible") fetchLatest(); };
    const onAccessActivity = (event: Event) => {
      const row = (event as CustomEvent<Notif | undefined>).detail;
      if (row?.id) {
        setNotifs((prev) => (prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, 50)));
      } else {
        fetchLatest();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mnr-access-activity", onAccessActivity);
    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mnr-access-activity", onAccessActivity);
      supabase.removeChannel(channel);
    };
  }, [access?.is_super_admin]);

  if (!session) return null;

  const pageData = pageDataForRoute(location.pathname);

  const handleExport = async (idx: number) => {
    if (!pageData) return;
    const src = pageData.sources[idx];
    try {
      const items = await readSource(src);
      const fname = `${src.store}_${new Date().toISOString().slice(0, 10)}.json`;
      downloadJSON(fname, items);
      toast.success(`Exported ${items.length} ${src.label}`);
    } catch (e: unknown) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleImport = async (idx: number) => {
    if (!pageData) return;
    const src = pageData.sources[idx];
    const data = await pickJSONFile();
    if (!data) return;
    if (!Array.isArray(data)) { toast.error("File must be a JSON array"); return; }
    const replace = confirm(`Replace all existing ${src.label}?\n\nOK = REPLACE all\nCancel = MERGE (add / update by id)`);
    try {
      const n = await writeSource(src, data, replace ? "replace" : "merge");
      toast.success(`Imported ${n} ${src.label}. Reload the page to see changes.`);
    } catch (e: unknown) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const applyTheme = (themeId: string) => {
    if (themeId === "sky") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", themeId);
    const s = { ...readSettings(), theme: themeId };
    localStorage.setItem("mnr_settings", JSON.stringify(s));
    setCurrentTheme(themeId);
  };

  const toggleDark = () => {
    const next = !darkMode;
    if (next) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    const s = { ...readSettings(), darkMode: next };
    localStorage.setItem("mnr_settings", JSON.stringify(s));
    setDarkMode(next);
  };

  const applyDarkVariant = (id: string) => {
    document.documentElement.setAttribute("data-dark-variant", id);
    const s = { ...readSettings(), darkVariant: id };
    localStorage.setItem("mnr_settings", JSON.stringify(s));
    setDarkVariant(id);
  };

  const navItems = NAV_ROUTES.filter((r) => {
    if (r.path === "/super-admin") return access?.is_super_admin;
    if (!access) return true;
    if (access.is_super_admin) return true;
    return access.allowed_routes?.includes(r.path);
  });

  const handleLogout = async () => { await signOut(); navigate("/login", { replace: true }); };

  return (
    <nav className="bg-muted/80 dark:bg-muted/60 backdrop-blur-md supports-[backdrop-filter]:bg-muted/70 border-b-2 border-sky-500 dark:border-sky-400 sticky top-0 z-50 shadow-sm">
      <div className="w-full px-3 sm:px-4">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="relative flex-shrink-0">
                <img 
                  src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" 
                  alt="MNR Group Logo" 
                  className="w-10 h-10 rounded-full border-2 border-white/50 object-contain bg-white p-1 ring-2 ring-white/30 relative z-10 shadow-lg"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base text-foreground tracking-wide">MNR Group IT</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className={`${access?.is_super_admin ? "hidden" : "hidden lg:flex"} items-center gap-1 mr-2`}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                if (item.external) {
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </a>
                  );
                }
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/40"
                        : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
            {/* Export / Import moved to Super Admin → Settings */}
            {access?.is_super_admin && (
              <Popover
                open={notifOpen}
                  onOpenChange={(o) => {
                  setNotifOpen(o);
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse ring-2 ring-primary">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-[min(28rem,calc(100vw-2rem))] sm:w-[28rem] p-0 max-h-[75vh] overflow-hidden flex flex-col rounded-xl border border-border/60 shadow-2xl backdrop-blur-xl bg-background/95"
                >
                  <div className="relative px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden">
                    <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="relative flex items-center gap-2 font-semibold text-sm tracking-wide">
                      <span className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur inline-flex items-center justify-center ring-1 ring-white/30">
                        <Bell className="h-3.5 w-3.5" />
                      </span>
                      Notifications
                      <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 ring-1 ring-white/30">
                        {notifs.length}
                      </span>
                    </div>
                    <div className="relative flex items-center gap-1.5">
                      {notifs.some((n) => !n.seen) && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ids = notifs.filter((n) => !n.seen).map((n) => n.id);
                            setNotifs((prev) => prev.map((n) => ({ ...n, seen: true })));
                            await supabase.from("activity_log").update({ seen: true }).in("id", ids);
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 ring-1 ring-white/20 transition"
                          title="Mark all as read"
                        >
                          Mark read
                        </button>
                      )}
                      {notifs.length > 0 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 ring-1 ring-white/20 transition inline-flex items-center gap-1"
                              title="Clear all"
                            >
                              <Trash2 className="h-3 w-3" /> Clear all
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="border-2 border-red-500/40 shadow-2xl">
                            <AlertDialogHeader>
                              <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 ring-1 ring-red-500/30 flex items-center justify-center mb-2">
                                <Trash2 className="h-6 w-6 text-red-500" />
                              </div>
                              <AlertDialogTitle className="text-center">Delete all notifications?</AlertDialogTitle>
                              <AlertDialogDescription className="text-center">
                                This will permanently remove all {notifs.length} notification{notifs.length !== 1 ? "s" : ""}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={async () => {
                                  const { error } = await supabase.from("activity_log").delete().not("id", "is", null);
                                  if (error) { toast.error(error.message); return; }
                                  setNotifs([]);
                                  toast.success("All notifications cleared");
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete all
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="overflow-y-auto py-1">
                    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10">
                      {(["all", "unseen", "seen"] as const).map((f) => {
                        const count = f === "all" ? notifs.length : f === "unseen" ? notifs.filter((n) => !n.seen).length : notifs.filter((n) => n.seen).length;
                        return (
                          <button
                            key={f}
                            onClick={() => setNotifFilter(f)}
                            className={`text-[11px] px-2.5 py-1 rounded-md capitalize transition ring-1 ${notifFilter === f ? "bg-primary text-primary-foreground ring-primary" : "bg-muted/50 hover:bg-muted ring-border/50"}`}
                          >
                            {f} <span className="opacity-70">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const filtered = notifs.filter((n) => notifFilter === "all" ? true : notifFilter === "unseen" ? !n.seen : n.seen);
                      return <>
                    {filtered.length === 0 && (
                      <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
                          <Bell className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        No activity yet.
                      </div>
                    )}
                    {filtered.map((n) => {
                      const Icon = n.action === "add" ? PlusCircle : n.action === "edit" ? Edit3 : n.action === "delete" ? Trash : Database;
                      const color = n.action === "add" ? "text-emerald-600" : n.action === "edit" ? "text-blue-600" : n.action === "delete" ? "text-red-600" : "text-primary";
                       const bgTint = n.action === "add" ? "bg-emerald-500/10" : n.action === "edit" ? "bg-blue-500/10" : n.action === "delete" ? "bg-red-500/10" : "bg-primary/10";
                       const borderColor = n.action === "add" ? "border-emerald-500/50" : n.action === "edit" ? "border-blue-500/50" : n.action === "delete" ? "border-red-500/50" : "border-primary/50";
                      const verb = n.action === "add" ? "added" : n.action === "edit" ? "edited" : n.action === "delete" ? "deleted" : n.action === "receive" ? "received" : n.action;
                      const who = n.actor_label || n.access_id || "Someone";
                      return (
                         <div key={n.id} className={`group relative flex gap-3 px-4 py-3 mx-2 my-1 rounded-md border ${borderColor} hover:bg-muted/60 transition-colors ${!n.seen ? "bg-primary/5" : ""}`}>
                          {!n.seen && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />}
                          <button
                            onClick={async () => {
                              setNotifOpen(false);
                              const accessTargetId = n.entity === "Access User" ? n.entity_id || n.access_id : null;
                              const target = accessTargetId
                                ? `/super-admin?highlight=${encodeURIComponent(accessTargetId)}`
                                : n.route || "/super-admin";
                              const safeTarget = target.startsWith("/")
                                ? target
                                : "/super-admin";
                              setTimeout(() => navigate(safeTarget), 0);
                            }}
                            className="flex gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="relative flex-shrink-0">
                              <div className={`h-9 w-9 rounded-lg ${bgTint} flex items-center justify-center ring-1 ring-border/50`}>
                                <Icon className={`h-4 w-4 ${color}`} />
                              </div>
                              {!n.seen && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm leading-snug ${!n.seen ? "font-medium" : ""}`}>
                                <span className="font-semibold">{who}</span>{" "}
                                <span className="text-muted-foreground">{verb}</span>{" "}
                                <span className={`font-medium ${color}`}>{n.entity}</span>
                              </div>
                              {n.description && <div className="text-xs text-muted-foreground/90 truncate mt-0.5">{n.description}</div>}
                              <div className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                {fmtWhen(n.created_at)}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { error } = await supabase.from("activity_log").delete().eq("id", n.id);
                              if (error) { alert(error.message); return; }
                              setNotifs((prev) => prev.filter((x) => x.id !== n.id));
                            }}
                            className="opacity-0 group-hover:opacity-100 transition h-7 w-7 flex items-center justify-center rounded-md hover:bg-red-500/10 text-red-500 flex-shrink-0 self-start"
                            title="Delete"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    </>;
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {access?.is_super_admin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    title="Menu"
                  >
                    <Menu className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-72 max-h-[80vh] overflow-y-auto border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/5 p-1"
                >
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Navigate</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    if (item.external) {
                      return (
                        <DropdownMenuItem key={item.path} asChild className="border border-primary/40 rounded-lg mb-1 focus:border-primary hover:border-primary transition-colors">
                          <a href={item.path} target="_blank" rel="noopener noreferrer" className="gap-2 cursor-pointer">
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </a>
                        </DropdownMenuItem>
                      );
                    }
                    return (
                      <DropdownMenuItem key={item.path} onClick={() => navigate(item.path)} className="gap-2 cursor-pointer border border-primary/40 rounded-lg mb-1 focus:border-primary hover:border-primary transition-colors">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-foreground/70 hover:text-foreground hover:bg-foreground/5 lg:hidden"
                title="Menu"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                  title="Account"
                >
                  <UserIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[calc(100vw-1rem)] sm:w-80 max-h-[85vh] overflow-y-auto border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/5">
                <DropdownMenuLabel className="py-2">
                  <div className="text-sm font-semibold text-foreground">
                    {access?.full_name || access?.label || "User"}
                  </div>
                  {access?.is_super_admin && (
                    <div className="text-xs text-purple-500 font-medium mt-0.5">Super Admin</div>
                  )}
                  <div className="mt-2 space-y-1.5 text-xs font-normal">
                    <div className="flex items-start gap-2">
                      <BadgeCheck className="h-3.5 w-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div><span className="text-muted-foreground">ID:</span> <span className="font-medium">{access?.access_id || "—"}</span></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <UserIcon className="h-3.5 w-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{access?.full_name || "—"}</span></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div><span className="text-muted-foreground">Designation:</span> <span className="font-medium">{access?.designation || "—"}</span></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 className="h-3.5 w-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{access?.department || "—"}</span></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-sky-600 mt-0.5 flex-shrink-0" />
                      <div><span className="text-muted-foreground">Unit / Office:</span> <span className="font-medium">{access?.unit_office || "—"}</span></div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <Palette className="h-4 w-4" />
                    <span className="flex-1">Themes</span>
                    <span
                      className="h-4 w-4 rounded-full border border-border"
                      style={{ background: THEMES.find((t) => t.id === currentTheme)?.color }}
                    />
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-64 border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/5 p-2">
                      <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-1 pb-2">
                        <Palette className="h-4 w-4" /> Color Theme
                      </DropdownMenuLabel>
                      <div className="grid grid-cols-5 gap-2">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTheme(t.id); }}
                            title={t.name}
                            className={`relative h-8 w-full rounded-md border-2 transition ${currentTheme === t.id ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"}`}
                            style={{ background: t.color }}
                          >
                            {currentTheme === t.id && <Check className="h-3.5 w-3.5 absolute inset-0 m-auto text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleDark}>
                  {darkMode ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  {darkMode ? "Light Mode" : "Dark Mode"}
                </DropdownMenuItem>
                {darkMode && (
                  <>
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Moon className="h-4 w-4" /> Dark Style
                    </DropdownMenuLabel>
                    <div className="px-2 pb-2 grid grid-cols-4 gap-2">
                      {DARK_VARIANTS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyDarkVariant(v.id); }}
                          title={v.name}
                          className={`relative h-8 w-full rounded-md border-2 transition ${darkVariant === v.id ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/50"}`}
                          style={{ background: v.color }}
                        >
                          {darkVariant === v.id && <Check className="h-3.5 w-3.5 absolute inset-0 m-auto text-white drop-shadow" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
                {access?.is_super_admin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/super-admin")}>
                      <Shield className="h-4 w-4 mr-2 text-purple-500" />
                      <span className="font-medium">Super Admin</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-sky-500 bg-background max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="px-2 pt-2 pb-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1 sm:px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              if (item.external) {
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-base font-medium text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </a>
                );
              }
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-base font-medium ${
                    isActive
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/40"
                      : "text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;