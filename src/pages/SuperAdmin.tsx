import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Trash2, Pencil, Loader2, KeyRound, Tag, LayoutDashboard, ShieldCheck, Sparkles, Bell, PlusCircle, Trash, Edit3, User, Building2, MapPin, Phone, Briefcase, Recycle, RotateCcw, Search, X, Filter } from "lucide-react";
import { NAV_ROUTES } from "@/lib/navRoutes";
import { restoreFromRecycleBin, purgeFromRecycleBin } from "@/lib/recycleBin";
import DataManagement from "@/components/DataManagement";

type AccessRow = {
  user_id: string; access_id: string; label: string | null;
  default_route: string; allowed_routes: string[]; is_super_admin: boolean;
  last_seen: string | null;
  route_permissions?: Record<string, { add?: boolean; edit?: boolean; delete?: boolean; recv?: boolean; issue?: boolean; export?: boolean; import?: boolean; print?: boolean }>;
  full_name?: string | null; designation?: string | null; department?: string | null; unit_office?: string | null; phone?: string | null;
};

type RoutePerm = NonNullable<AccessRow["route_permissions"]>[string];

type ActivityRow = {
  id: string;
  user_id: string;
  access_id: string | null;
  actor_label: string | null;
  action: "add" | "edit" | "delete";
  entity: string;
  entity_id: string | null;
  description: string | null;
  route: string | null;
  created_at: string;
};

type TrashRow = {
  id: string;
  entity: string;
  entity_id: string | null;
  entity_label: string | null;
  collection: string | null;
  payload: unknown;
  deleted_by_label: string | null;
  deleted_by_access_id: string | null;
  created_at: string;
};

const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);

const emptyForm = () => ({
  access_id: "", label: "", default_route: "/",
  allowed_routes: NAV_ROUTES.map((r) => r.path),
  route_permissions: {} as Record<string, { add?: boolean; edit?: boolean; delete?: boolean; recv?: boolean; issue?: boolean; export?: boolean; import?: boolean; print?: boolean }>,
  make_admin: false,
  full_name: "", designation: "", department: "", unit_office: "", phone: "",
});

const SuperAdmin = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccessRow | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(0);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [trash, setTrash] = useState<TrashRow[]>([]);
  const [trashSearch, setTrashSearch] = useState("");
  const [trashEntity, setTrashEntity] = useState<string>("all");

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, rows]);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("access-admin", { body: { action: "list" } });
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "Failed to load Access IDs");
      setRows([]);
    } else {
      setRows((data?.rows as AccessRow[]) || []);
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000); // refresh presence every 30s
    return () => clearInterval(iv);
  }, []);

  // Load recent activity + subscribe to realtime inserts for live activity.
  useEffect(() => {
    let mounted = true;
    const fetchLatest = async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (mounted) setActivity((data as ActivityRow[]) || []);
    };

    fetchLatest();
    const poll = setInterval(fetchLatest, 15000);
    const onVis = () => { if (document.visibilityState === "visible") fetchLatest(); };

    const channel = supabase
      .channel("activity_log_super_admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          const row = payload.new as ActivityRow;
          setActivity((prev) => (prev.some((a) => a.id === row.id) ? prev : [row, ...prev].slice(0, 100)));
          setUnread((n) => n + 1);
          const who = row.actor_label || row.access_id || "A user";
          const verb = row.action === "add" ? "added" : row.action === "edit" ? "edited" : "deleted";
          toast(`${who} ${verb} ${row.entity}`, {
            description: row.description || row.entity_id || undefined,
          });
        },
      )
      .subscribe();

    const onAccessActivity = (event: Event) => {
      const row = (event as CustomEvent<ActivityRow | undefined>).detail;
      if (!row) { fetchLatest(); return; }
      setActivity((prev) => (prev.some((a) => a.id === row.id) ? prev : [row, ...prev].slice(0, 100)));
      setUnread((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mnr-access-activity", onAccessActivity);

    return () => {
      mounted = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("mnr-access-activity", onAccessActivity);
      supabase.removeChannel(channel);
    };
  }, []);

  // Recycle bin: load + realtime.
  useEffect(() => {
    let mounted = true;
    const load = () => supabase
      .from("recycle_bin")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => { if (mounted) setTrash((data as TrashRow[]) || []); });
    load();
    const ch = supabase
      .channel("recycle_bin_super_admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "recycle_bin" }, () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const doRestore = async (r: TrashRow) => {
    try {
      await restoreFromRecycleBin(r);
      toast.success(`Restored ${r.entity}`);
    } catch (e: unknown) { toast.error(errorMessage(e) || "Restore failed"); }
  };
  const doPurge = async (r: TrashRow) => {
    try {
      await purgeFromRecycleBin(r.id);
      toast.success("Permanently deleted");
    } catch (e: unknown) { toast.error(errorMessage(e) || "Delete failed"); }
  };

  const doPurgeFiltered = async (items: TrashRow[]) => {
    try {
      const ids = items.map((t) => t.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("recycle_bin").delete().in("id", ids);
      if (error) throw error;
      setTrash((prev) => prev.filter((t) => !ids.includes(t.id)));
      toast.success(`Successfully deleted all ${ids.length} item${ids.length === 1 ? "" : "s"} at once`);
    } catch (e: unknown) { toast.error(errorMessage(e) || "Delete filtered failed"); }
  };

  const fmtWhen = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const isOnline = (last: string | null) =>
    !!last && Date.now() - new Date(last).getTime() < 2 * 60 * 1000;

  const fmtLastSeen = (last: string | null) => {
    if (!last) return "Never signed in";
    const d = new Date(last);
    return d.toLocaleString([], {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const startCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const startEdit = (r: AccessRow) => {
    setEditing(r);
    setForm({
      access_id: r.access_id, label: r.label || "", default_route: r.default_route,
      allowed_routes: r.allowed_routes || [],
      route_permissions: r.route_permissions || {},
      make_admin: false,
      full_name: r.full_name || "", designation: r.designation || "",
      department: r.department || "",
      unit_office: r.unit_office || "", phone: r.phone || "",
    });
    setOpen(true);
  };

  const toggleRoute = (path: string) => setForm((f) => ({
    ...f, allowed_routes: f.allowed_routes.includes(path) ? f.allowed_routes.filter((p) => p !== path) : [...f.allowed_routes, path],
  }));

  const togglePerm = (path: string, key: "add" | "edit" | "delete" | "recv" | "issue" | "export" | "import" | "print") => setForm((f) => {
    const cur = f.route_permissions[path] || {};
    return { ...f, route_permissions: { ...f.route_permissions, [path]: { ...cur, [key]: !cur[key] } } };
  });

  const submit = async () => {
    if (!form.access_id.trim()) return toast.error("Access ID required");
    if (!form.allowed_routes.includes(form.default_route)) return toast.error("Default page must be an allowed page");
    setBusy(true);
    try {
      const body: Record<string, unknown> = editing
        ? { action: "update", user_id: editing.user_id, access_id: form.access_id, label: form.label, default_route: form.default_route, allowed_routes: form.allowed_routes, route_permissions: form.route_permissions, make_admin: form.make_admin, full_name: form.full_name, designation: form.designation, department: form.department, unit_office: form.unit_office, phone: form.phone }
        : { action: "create", ...form };
      const { data, error } = await supabase.functions.invoke("access-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.dispatchEvent(new CustomEvent("mnr-access-activity", { detail: data?.activity }));
      toast.success(editing ? "Updated" : "Created");
      // Note: the `access-admin` edge function already writes the activity_log
      // entry using the service role. We skip the client-side duplicate.
      setOpen(false);
      await load();
    } catch (e: unknown) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const remove = async (r: AccessRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("access-admin", { body: { action: "delete", user_id: r.user_id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.dispatchEvent(new CustomEvent("mnr-access-activity", { detail: data?.activity }));
      toast.success("Deleted");
      // Logged inside `access-admin` edge function.
      await load();
    } catch (e: unknown) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="w-full p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-500" /> Super Admin
        </h1>
        <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" /> New Access ID</Button>
      </div>

      <Card className="border-2 border-sky-500/40">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Access IDs</CardTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online: {rows.filter(r => isOnline(r.last_seen)).length}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Offline: {rows.filter(r => !isOnline(r.last_seen)).length}</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access IDs yet.</p>
            ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/50">
                  <tr className="[&>th]:border [&>th]:border-border [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wide">
                    <th className="w-16">Status</th>
                    <th>Access ID</th>
                    <th>Name</th>
                    <th>Default</th>
                    <th>Permissions</th>
                    <th>Last Active</th>
                    <th className="w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const perms = r.route_permissions || {};
                    const caps = { add: 0, edit: 0, delete: 0, issue: 0, recv: 0 };
                    Object.values(perms).forEach((p: RoutePerm) => {
                      (Object.keys(caps) as (keyof typeof caps)[]).forEach((k) => { if (p?.[k]) caps[k]++; });
                    });
                    const chip = (label: string, count: number, cls: string) =>
                      count > 0 ? (
                        <span key={label} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
                          {label} <span className="opacity-70">{count}</span>
                        </span>
                      ) : null;
                    return (
                       <tr
                         key={r.user_id}
                         ref={highlightId === r.access_id ? highlightRef : undefined}
                         className={`hover:bg-muted/30 [&>td]:border [&>td]:border-border [&>td]:px-3 [&>td]:py-2 [&>td]:align-top ${highlightId === r.access_id ? "ring-2 ring-primary bg-primary/10 animate-pulse" : ""}`}
                       >
                        <td>
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline(r.last_seen) ? "bg-emerald-500 shadow-[0_0_8px_rgb(16,185,129)] animate-pulse" : "bg-muted-foreground/40"}`}
                            title={isOnline(r.last_seen) ? "Online" : "Offline"}
                          />
                        </td>
                        <td>
                          <div className="font-medium flex items-center gap-1.5 flex-wrap">
                            {r.access_id}
                            {r.is_super_admin && <Badge className="bg-purple-500 hover:bg-purple-500 text-[10px] px-1.5 py-0">Super</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium">{r.full_name || r.label || "—"}</div>
                          {r.designation && <div className="text-[11px] text-muted-foreground">{r.designation}</div>}
                        </td>
                        <td className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.default_route}
                          <div>{r.allowed_routes?.length || 0} pages</div>
                        </td>
                        <td>
                          {r.is_super_admin ? (
                            <Badge className="bg-purple-500 hover:bg-purple-500 text-[10px]">Full access</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {chip("Add", caps.add, "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}
                              {chip("Edit", caps.edit, "bg-sky-500/15 text-sky-700 dark:text-sky-300")}
                              {chip("Del", caps.delete, "bg-rose-500/15 text-rose-700 dark:text-rose-300")}
                              {chip("Issue", caps.issue, "bg-amber-500/15 text-amber-700 dark:text-amber-300")}
                              {chip("Recv", caps.recv, "bg-violet-500/15 text-violet-700 dark:text-violet-300")}
                              {caps.add + caps.edit + caps.delete + caps.issue + caps.recv === 0 && (
                                <span className="text-[11px] text-muted-foreground italic">View only</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-xs text-muted-foreground whitespace-nowrap">{fmtLastSeen(r.last_seen)}</td>
                        <td>
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => startEdit(r)} title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                            {!r.is_super_admin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive" className="h-7 w-7 p-0" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Access ID {r.access_id}?</AlertDialogTitle>
                                    <AlertDialogDescription>This user will no longer be able to sign in.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => remove(r)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )
          )}
        </CardContent>
      </Card>

      <Card id="live-activity" className="w-full border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-transparent to-sky-500/5 shadow-lg">
        <CardHeader className="pb-3 flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-500" /> Live Activity
            <Badge variant="secondary" className="ml-1">{activity.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">Realtime · recent add / edit / delete</span>
            {activity.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="h-8 gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all activity?</AlertDialogTitle>
                    <AlertDialogDescription>All {activity.length} activity records will be permanently removed. This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const ids = activity.map((a) => a.id);
                        const { error } = await supabase.from("activity_log").delete().in("id", ids);
                        if (error) { toast.error(error.message); return; }
                        setActivity([]);
                        toast.success("All activity cleared");
                      }}
                    >Delete all</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="w-full">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="w-full max-h-[28rem] overflow-y-auto space-y-2 pr-1">
              {activity.map((a) => {
                const Icon = a.action === "add" ? PlusCircle : a.action === "edit" ? Edit3 : Trash;
                const color =
                  a.action === "add" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  : a.action === "edit" ? "text-sky-600 dark:text-sky-400 bg-sky-500/10"
                  : "text-rose-600 dark:text-rose-400 bg-rose-500/10";
                const borderColor =
                  a.action === "add" ? "border-emerald-500/50 hover:border-emerald-500 hover:shadow-emerald-500/20"
                  : a.action === "edit" ? "border-sky-500/50 hover:border-sky-500 hover:shadow-sky-500/20"
                  : "border-rose-500/50 hover:border-rose-500 hover:shadow-rose-500/20";
                return (
                  <div key={a.id} className={`group flex items-start gap-3 px-3 py-2.5 text-sm rounded-lg border-2 bg-card/60 backdrop-blur-sm transition-all hover:shadow-md ${borderColor}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        <span className="text-primary">{a.actor_label || a.access_id || "Someone"}</span>
                        <span className="text-muted-foreground"> {a.action === "add" ? "added" : a.action === "edit" ? "edited" : "deleted"} </span>
                        <span>{a.entity}</span>
                        {a.entity_id && <span className="text-muted-foreground"> · {a.entity_id}</span>}
                      </div>
                      {a.description && <div className="text-xs text-muted-foreground truncate">{a.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtWhen(a.created_at)}</span>
                      <button
                        onClick={async () => {
                          const { error } = await supabase.from("activity_log").delete().eq("id", a.id);
                          if (error) { toast.error(error.message); return; }
                          setActivity((prev) => prev.filter((x) => x.id !== a.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 transition h-6 w-6 flex items-center justify-center rounded hover:bg-rose-500/10 text-rose-500"
                        title="Delete"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="recycle-bin" className="border-2 border-amber-500/40">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Recycle className="w-4 h-4 text-amber-500" /> Recycle Bin
            <Badge variant="secondary" className="ml-1">{trash.length}</Badge>
          </CardTitle>
          <span className="text-xs text-muted-foreground">Restore or permanently delete items</span>
        </CardHeader>
        <CardContent>
          {(() => {
            const entities = Array.from(new Set(trash.map((t) => t.entity))).sort();
            const q = trashSearch.trim().toLowerCase();
            const filtered = trash.filter((t) => {
              if (trashEntity !== "all" && t.entity !== trashEntity) return false;
              if (!q) return true;
              return (
                t.entity.toLowerCase().includes(q) ||
                (t.entity_label || "").toLowerCase().includes(q) ||
                (t.deleted_by_label || "").toLowerCase().includes(q) ||
                (t.deleted_by_access_id || "").toLowerCase().includes(q)
              );
            });
            const hasFilter = q.length > 0 || trashEntity !== "all";
            return (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={trashSearch}
                  onChange={(e) => setTrashSearch(e.target.value)}
                  placeholder="Search entity, name, deleted by…"
                  className="pl-8 pr-8 h-9"
                />
                {trashSearch && (
                  <button
                    onClick={() => setTrashSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={trashEntity} onValueChange={setTrashEntity}>
                <SelectTrigger className="w-full sm:w-48 h-9">
                  <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilter && (
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={filtered.length === 0}
                        className="h-9 gap-1"
                        title="Delete filtered items permanently"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Filtered ({filtered.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-2 border-destructive/50 shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {filtered.length} filtered item{filtered.length === 1 ? "" : "s"} forever?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete only the items matching the current Recycle Bin filter. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => doPurgeFiltered(filtered)}>Delete Filtered</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setTrashSearch(""); setTrashEntity("all"); }}
                    className="h-9 gap-1 text-destructive hover:text-destructive"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" /> Clear
                  </Button>
                </>
              )}
            </div>
            {trash.length === 0 ? (
            <p className="text-sm text-muted-foreground">Recycle bin is empty.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items match the current filter.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-border/60 rounded-lg border">
              {filtered.map((t) => (
                <div key={t.id} className="flex items-start gap-3 px-3 py-2.5 text-sm hover:bg-muted/30">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Trash className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      <span>{t.entity}</span>
                      {t.entity_label && <span className="text-muted-foreground"> · {t.entity_label}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Deleted by {t.deleted_by_label || t.deleted_by_access_id || "someone"} · {fmtWhen(t.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.collection && (
                      <Button size="sm" variant="outline" onClick={() => doRestore(t)} title="Restore">
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" title="Delete forever">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Permanently delete {t.entity}?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => doPurge(t)}>Delete forever</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
          </>
          ); })()}
        </CardContent>
      </Card>

      <DataManagement />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-0 shadow-2xl">
          {/* Gradient header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-600 px-6 py-5 text-white">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
            <DialogHeader className="relative space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 shadow-lg">
                  {editing ? <Pencil className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold tracking-tight text-white">
                    {editing ? `Edit ${editing.access_id}` : "New Access ID"}
                  </DialogTitle>
                  <p className="text-xs text-white/80 mt-0.5">
                    {editing ? "Update access, default page and per-page permissions." : "Create a login and choose what this user can see & do."}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-5 bg-gradient-to-b from-background to-muted/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Access ID
              </Label>
              <Input value={form.access_id}
                onChange={(e) => setForm({ ...form, access_id: e.target.value })}
                placeholder="e.g. 01712345678"
                className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Full Name
                </Label>
                <Input value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Kabir Ahmed"
                  className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> Designation
                </Label>
                <Input value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. IT Officer"
                  className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </Label>
                <Input value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 01712-345678"
                  className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Department
                </Label>
                <Input value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. IT"
                  className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Unit / Office
                </Label>
                <Input value={form.unit_office}
                  onChange={(e) => setForm({ ...form, unit_office: e.target.value })}
                  placeholder="e.g. Head Office"
                  className="h-10 bg-background border-2 border-input text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400 dark:bg-slate-900 dark:border-slate-700" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <LayoutDashboard className="w-3.5 h-3.5" /> Default Page
              </Label>
              <Select value={form.default_route} onValueChange={(v) => setForm({ ...form, default_route: v })}>
                <SelectTrigger className="h-10 bg-background border-2 border-input dark:bg-slate-900 dark:border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NAV_ROUTES.filter((r) => form.allowed_routes.includes(r.path)).map((r) => (
                    <SelectItem key={r.path} value={r.path}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Page Permissions
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {form.allowed_routes.length}/{NAV_ROUTES.length} pages
                </span>
              </div>
              <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card">
                <div className="grid grid-cols-[1fr_repeat(9,44px)] items-center bg-gradient-to-r from-sky-500/10 to-purple-500/10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">
                  <span>Page</span>
                  <span className="text-center">View</span>
                  <span className="text-center text-emerald-600 dark:text-emerald-400">Add</span>
                  <span className="text-center text-sky-600 dark:text-sky-400">Edit</span>
                  <span className="text-center text-rose-600 dark:text-rose-400">Del</span>
                  <span className="text-center text-teal-600 dark:text-teal-400">Recv</span>
                  <span className="text-center text-orange-600 dark:text-orange-400">Iss</span>
                  <span className="text-center text-indigo-600 dark:text-indigo-400">Exp</span>
                  <span className="text-center text-fuchsia-600 dark:text-fuchsia-400">Imp</span>
                  <span className="text-center text-amber-600 dark:text-amber-400">Prn</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                  {NAV_ROUTES.map((r) => {
                    const allowed = form.allowed_routes.includes(r.path);
                    const perm = form.route_permissions[r.path] || {};
                    const Icon = r.icon;
                    return (
                      <div key={r.path}
                        className={`grid grid-cols-[1fr_repeat(9,44px)] items-center px-3 py-2 text-sm transition-colors ${allowed ? "hover:bg-muted/40" : "bg-muted/20 text-muted-foreground"}`}>
                        <span className="flex items-center gap-2 truncate">
                          {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />}
                          <span className="truncate">{r.label}</span>
                        </span>
                        <span className="flex justify-center">
                          <Checkbox checked={allowed} onCheckedChange={() => toggleRoute(r.path)} />
                        </span>
                        {(["add", "edit", "delete", "recv", "issue", "export", "import", "print"] as const).map((k) => {
                          const isRecvIssue = k === "recv" || k === "issue";
                          const applies = !isRecvIssue || r.path === "/sticker-printer";
                          return (
                            <span key={k} className="flex justify-center">
                              <Checkbox
                                checked={!!perm[k]}
                                disabled={!allowed || !applies}
                                onCheckedChange={() => togglePerm(r.path, k)}
                              />
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-purple-300/50 dark:border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-sky-500/5 px-4 py-3 cursor-pointer hover:from-purple-500/10 hover:to-sky-500/10 transition-colors">
              <Checkbox checked={form.make_admin} onCheckedChange={(v) => setForm({ ...form, make_admin: !!v })} />
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-500" /> Grant admin rights
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Global edit & delete permissions across the app.</p>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:opacity-90 text-white shadow-lg shadow-indigo-500/30 border-0"
                onClick={submit}
                disabled={busy}
              >
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {editing ? "Save Changes" : "Create Access ID"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdmin;