import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import dbService from "@/services/indexedDBService";
import { usePerm } from "@/hooks/usePerm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History, Pencil, Trash2, Save, Printer, UserPlus, ArrowLeft, Search, X, MoreVertical } from "lucide-react";
import { toast } from "sonner";

const PATH = "/sticker-printer/print-history";
type Entry = { id: string; buyer_id: string; print_date: string; pcs: number; po_no: string | null; note: string | null; created_at: string; updated_at?: string };
type DateFilterMode = "all" | "day" | "month" | "range";
type Buyer = {
  id: string; buyer_name: string; status?: string; logo?: string;
  merchandiser_name?: string; merchandiser_phone?: string; merchandiser_email?: string;
  gpq_name?: string; gpq_phone?: string; gpq_email?: string;
  store_officer_name?: string; store_officer_phone?: string; store_officer_email?: string;
  created_at?: string;
};
const emptyBuyerForm = { buyer_name: "", merchandiser_name: "", merchandiser_phone: "", status: "Active" };

const today = () => new Date().toLocaleDateString("en-CA");
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB");
const num = (n: number) => Number(n || 0).toLocaleString();
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&" + "amp;", "<": "&" + "lt;", ">": "&" + "gt;", '"': "&" + "quot;" }[c] || c));
const matchesDateFilter = (entry: Entry, mode: DateFilterMode, day: string, month: string, from: string, to: string) => {
  if (mode === "day") return entry.print_date === day;
  if (mode === "month") return entry.print_date.startsWith(month);
  if (mode === "range") return (!from || entry.print_date >= from) && (!to || entry.print_date <= to);
  return true;
};

export default function StickerPrintHistory() {
  const navigate = useNavigate();
  const perm = usePerm(PATH);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const firstBuyerCardRef = useRef<HTMLDivElement>(null);
  const [buyerId, setBuyerId] = useState<string>("");
  const [date, setDate] = useState(today());
  const [pcs, setPcs] = useState("");
  const [note, setNote] = useState("");
  const [poNo, setPoNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<DateFilterMode>("all");
  const [printBuyerFilter, setPrintBuyerFilter] = useState("all");
  const [filterDay, setFilterDay] = useState(today());
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [buyerSearch, setBuyerSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [buyerDialog, setBuyerDialog] = useState(false);
  const [buyerForm, setBuyerForm] = useState({ ...emptyBuyerForm });
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [deleteBuyer, setDeleteBuyer] = useState<Buyer | null>(null);

  // Old dates need edit permission (approved users only).
  const canBackdate = perm.edit;

  const load = async () => {
    const { data, error } = await supabase
      .from("sticker_print_history")
      .select("*")
      .order("print_date", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setEntries((data as any) || []);
  };

  const loadBuyers = async () => {
    try {
      const b = ((await dbService.getAll("buyers")) || []) as Buyer[];
      b.sort((x, y) => String(x.buyer_name).localeCompare(String(y.buyer_name)));
      setBuyers(b);
      setBuyerId((cur) => (cur && b.some((x) => x.id === cur) ? cur : ""));
    } catch { /* ignore */ }
  };

  const openAddBuyer = () => { setEditingBuyer(null); setBuyerForm({ ...emptyBuyerForm }); setBuyerDialog(true); };
  const openEditBuyer = (b: Buyer) => {
    setEditingBuyer(b);
    setBuyerForm({
      buyer_name: b.buyer_name,
      merchandiser_name: b.merchandiser_name || "",
      merchandiser_phone: b.merchandiser_phone || "",
      status: b.status || "Active",
    });
    setBuyerDialog(true);
  };

  const saveBuyer = async () => {
    if (!buyerForm.buyer_name.trim()) return toast.error("Buyer name required");
    try {
      if (editingBuyer) {
        await dbService.put("buyers", { ...editingBuyer, ...buyerForm });
        toast.success("Buyer updated");
      } else {
        const id = `buyer_${Date.now()}`;
        await dbService.add("buyers", { id, ...buyerForm, created_at: new Date().toISOString() });
        toast.success("Buyer added");
      }
      setBuyerDialog(false);
      void loadBuyers();
    } catch { toast.error("Failed to save buyer"); }
  };

  const confirmDeleteBuyer = async () => {
    if (!deleteBuyer) return;
    try {
      await dbService.delete("buyers", deleteBuyer.id);
      await supabase.from("sticker_print_history").delete().eq("buyer_id", deleteBuyer.id);
      toast.success("Buyer deleted");
      setDeleteBuyer(null);
      void loadBuyers();
      void load();
    } catch { toast.error("Failed to delete buyer"); }
  };

  useEffect(() => {
    void loadBuyers();
    void load();
    // When the background cloud refresh finishes, update the cards so the
    // page never stays stuck on "No buyers yet" after a hard refresh.
    const onRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.storeName === "buyers" && Array.isArray(detail.rows)) {
        const b = [...detail.rows] as Buyer[];
        b.sort((x, y) => String(x.buyer_name).localeCompare(String(y.buyer_name)));
        setBuyers(b);
        setBuyerId((cur) => (cur && b.some((x) => x.id === cur) ? cur : ""));
      }
    };
    window.addEventListener("mnr-data-refreshed", onRefreshed);
    const ch = supabase
      .channel("sticker_print_history")
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_print_history" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); window.removeEventListener("mnr-data-refreshed", onRefreshed); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.buyer_name || "Unknown";

  const filtered = useMemo(() => entries.filter((e) => {
    if (buyerId && e.buyer_id !== buyerId) return false;
    if (!matchesDateFilter(e, filterMode, filterDay, filterMonth, filterFrom, filterTo)) return false;
    const query = recordSearch.trim().replace(/,/g, "").toLowerCase();
    if (!query) return true;
    return (e.po_no || "").toLowerCase().includes(query) || String(e.pcs || "").includes(query);
  }), [entries, buyerId, filterMode, filterDay, filterMonth, filterFrom, filterTo, recordSearch]);

  const buyerTotal = useMemo(
    () => entries.filter((e) => e.buyer_id === buyerId).reduce((s, e) => s + Number(e.pcs || 0), 0),
    [entries, buyerId],
  );
  const filteredTotal = filtered.reduce((s, e) => s + Number(e.pcs || 0), 0);

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.buyer_id === buyerId) m.set(e.print_date, (m.get(e.print_date) || 0) + Number(e.pcs || 0));
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries, buyerId]);

  const allBuyerTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.buyer_id, (m.get(e.buyer_id) || 0) + Number(e.pcs || 0));
    return m;
  }, [entries]);

  const buyerLastActivity = useMemo(() => {
    const latestActivity = new Map<string, number>();
    for (const entry of entries) {
      const timestamp = Date.parse(entry.updated_at || entry.created_at);
      if (Number.isNaN(timestamp)) continue;
      latestActivity.set(entry.buyer_id, Math.max(latestActivity.get(entry.buyer_id) || 0, timestamp));
    }
    return latestActivity;
  }, [entries]);

  const visibleBuyers = useMemo(() => {
    const query = buyerSearch.trim().toLowerCase();
    return buyers
      .filter((buyer) => buyer.buyer_name.toLowerCase().includes(query))
      .sort((a, b) =>
        (buyerLastActivity.get(b.id) || 0) - (buyerLastActivity.get(a.id) || 0) ||
        a.buyer_name.localeCompare(b.buyer_name)
      );
  }, [buyers, buyerLastActivity, buyerSearch]);

  useEffect(() => {
    if (!buyerId) firstBuyerCardRef.current?.focus();
  }, [buyerId, visibleBuyers]);

  const printRecords = (targetBuyerId: string, printEntries: Entry[]) => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    const includeBuyerColumn = targetBuyerId === "all";
    const reportBuyerName = includeBuyerColumn ? "All Buyers" : buyerName(targetBuyerId);
    const totalPcs = printEntries.reduce((total, entry) => total + Number(entry.pcs || 0), 0);
    const reportBuyerCount = new Set(printEntries.map((entry) => entry.buyer_id)).size;
    const filterLabel =
      filterMode === "day" ? `Date: ${fmt(filterDay)}` :
      filterMode === "month" ? `Month: ${filterMonth}` :
      filterMode === "range" ? `Date range: ${filterFrom ? fmt(filterFrom) : "start"} to ${filterTo ? fmt(filterTo) : "today"}` :
      "All dates";
    const sortedEntries = includeBuyerColumn
      ? [...printEntries].sort((a, b) =>
          buyerName(a.buyer_id).localeCompare(buyerName(b.buyer_id)) ||
          b.print_date.localeCompare(a.print_date) ||
          Date.parse(b.created_at) - Date.parse(a.created_at)
        )
      : printEntries;
    let rows = "";
    let rowNumber = 0;
    if (includeBuyerColumn) {
      const groupedEntries = new Map<string, Entry[]>();
      for (const entry of sortedEntries) {
        const group = groupedEntries.get(entry.buyer_id) || [];
        group.push(entry);
        groupedEntries.set(entry.buyer_id, group);
      }
      for (const [id, group] of groupedEntries) {
        const buyerPcs = group.reduce((total, entry) => total + Number(entry.pcs || 0), 0);
        rows += `<tr class="buyer-group"><th colspan="5"><span>BUYER</span>${esc(buyerName(id))}</th></tr>`;
        rows += group.map((entry) =>
          `<tr><td class="number">${++rowNumber}</td><td>${fmt(entry.print_date)}</td><td class="r pcs">${num(Number(entry.pcs || 0))}</td><td>${esc(entry.po_no || "") || "-"}</td><td>${esc(entry.note || "") || "-"}</td></tr>`
        ).join("");
        rows += `<tr class="subtotal"><td colspan="2">Buyer subtotal <span>(${group.length} ${group.length === 1 ? "record" : "records"})</span></td><td class="r">${num(buyerPcs)}</td><td colspan="2"></td></tr>`;
      }
    } else {
      rows = sortedEntries.map((entry, index) =>
        `<tr><td class="number">${index + 1}</td><td>${fmt(entry.print_date)}</td><td class="r pcs">${num(Number(entry.pcs || 0))}</td><td>${esc(entry.po_no || "") || "-"}</td><td>${esc(entry.note || "") || "-"}</td></tr>`
      ).join("");
    }
    const emptyRow = printEntries.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:16px">No records</td></tr>` : "";
    w.document.write(`<!DOCTYPE html><html><head><title>Print History — ${esc(reportBuyerName)}</title><style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing:border-box; }
body { margin:10mm; font-family:Arial,sans-serif; color:#172554; font-size:12px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.header { display:flex; align-items:center; gap:16px; padding:0 0 14px; border-bottom:2px solid #0284c7; margin-bottom:18px; }
.header img { height:52px; width:52px; object-fit:contain; }
.header-copy { flex:1; }
.eyebrow { color:#0284c7; font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; }
.header h1 { color:#0c4a6e; margin:4px 0 0; font-size:22px; }
.header .subtitle { color:#64748b; margin-top:4px; font-size:11px; }
.meta { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; color:#475569; font-size:11px; }
.meta span { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:5px; padding:6px 9px; }
.summary { display:flex; gap:10px; margin-bottom:16px; }
.summary-card { flex:1; border:1px solid #bae6fd; border-left:3px solid #0284c7; border-radius:6px; padding:9px 12px; background:#f0f9ff; }
.summary-label { color:#64748b; font-size:10px; text-transform:uppercase; letter-spacing:.5px; }
.summary-value { color:#0c4a6e; margin-top:3px; font-size:17px; font-weight:700; }
table { width:100%; border-collapse:collapse; font-size:11px; }
thead { display:table-header-group; }
tr { break-inside:avoid; page-break-inside:avoid; }
th { background:#0369a1; color:white; padding:9px 8px; border:1px solid #0284c7; text-align:left; letter-spacing:.2px; }
td { padding:7px 8px; border:1px solid #dbeafe; vertical-align:top; }
tbody tr:nth-child(even):not(.subtotal) { background:#f8fafc; }
td.number { width:42px; color:#64748b; text-align:center; }
td.r, th.r { text-align:right; }
td.pcs { font-weight:700; color:#0c4a6e; }
tr.buyer-group th { background:#dbeafe; color:#0c4a6e; padding:11px 10px; border:1px solid #93c5fd; border-left:4px solid #0284c7; text-align:left; font-size:16px; font-weight:700; letter-spacing:.2px; }
tr.buyer-group th span { display:inline-block; margin-right:9px; color:#0369a1; font-size:9px; letter-spacing:1.2px; vertical-align:2px; }
tr.subtotal td { background:#e0f2fe; color:#075985; font-weight:700; border-top:1px solid #7dd3fc; }
tr.subtotal span { color:#64748b; font-size:10px; font-weight:400; }
tfoot td { font-weight:700; background:#0c4a6e; color:white; padding:9px 8px; border-color:#0c4a6e; }
.footer { margin-top:16px; padding-top:8px; border-top:1px solid #e2e8f0; text-align:right; font-size:10px; color:#64748b; }
@media print { body { margin:10mm; } }
</style></head><body>
<div class="header"><img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" /><div class="header-copy"><div class="eyebrow">MNR Group · IT Department</div><h1>Sticker Print History</h1><div class="subtitle">${includeBuyerColumn ? "Consolidated buyer report" : "Buyer print report"}</div></div></div>
<div class="meta"><span><strong>Buyer:</strong> ${esc(reportBuyerName)}</span><span><strong>Period:</strong> ${filterLabel}</span><span><strong>Printed:</strong> ${new Date().toLocaleString("en-GB")}</span></div>
<div class="summary">
  ${includeBuyerColumn ? `<div class="summary-card"><div class="summary-label">Buyers</div><div class="summary-value">${num(reportBuyerCount)}</div></div>` : ""}
  <div class="summary-card"><div class="summary-label">Print records</div><div class="summary-value">${num(printEntries.length)}</div></div>
  <div class="summary-card"><div class="summary-label">Total printed PCS</div><div class="summary-value">${num(totalPcs)}</div></div>
</div>
<table><thead><tr><th>NO</th><th>Date</th><th class="r">PCS</th><th>PO/Style</th><th>Note</th></tr></thead>
<tbody>${rows}${emptyRow}</tbody>
<tfoot><tr><td colspan="2">Grand total</td><td class="r">${num(totalPcs)}</td><td colspan="2"></td></tr></tfoot></table>
<div class="footer">MNR Group IT Department · Sticker Print History</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body></html>`);
    w.document.close();
  };

  const save = async () => {
    if (!buyerId) return toast.error("Select a buyer");
    const n = Number(pcs);
    if (!n || n <= 0) return toast.error("Enter PCS");
    if (date !== today() && !canBackdate) return toast.error("You are not allowed to add entries for another date");
    setSaving(true);
    const { error } = await supabase.from("sticker_print_history").insert({ buyer_id: buyerId, print_date: date, pcs: n, po_no: poNo.trim() || null, note: note || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setPcs(""); setNote(""); setPoNo(""); setDate(today());
    void load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("sticker_print_history")
      .update({ print_date: editing.print_date, pcs: Number(editing.pcs) || 0, po_no: (editing.po_no || "").trim() || null, note: editing.note || null })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditing(null);
    void load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("sticker_print_history").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          {buyerId && (
            <Button size="icon" variant="ghost" onClick={() => setBuyerId("")} title="Back to buyers">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <History className="h-6 w-6 text-primary" />
          {buyerId ? `${buyerName(buyerId)} — Print History` : "Sticker Print History"}
        </h1>
        {!buyerId && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/sticker-printer")}>
              <Printer className="h-4 w-4 mr-1" /> Sticker Printer report
            </Button>
            {perm.add && (
              <Button onClick={openAddBuyer}><UserPlus className="h-4 w-4 mr-1" /> Add Buyer</Button>
            )}
          </div>
        )}
      </div>

      {!buyerId && (
      <>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3 shadow-sm xl:flex-nowrap">
        <div className="relative min-w-[200px] flex-1">
          <Label htmlFor="buyer-search" className="mb-1 block">Search</Label>
          <Search className="pointer-events-none absolute left-3 top-[2.75rem] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="buyer-search"
            className="pl-9"
            value={buyerSearch}
            onChange={(e) => setBuyerSearch(e.target.value)}
            placeholder="Search buyer name"
            aria-label="Search buyer name"
          />
        </div>
        {perm.print && (
          <>
            <div className="w-full space-y-1 sm:w-44">
              <Label>Buyer filter</Label>
              <Select value={printBuyerFilter} onValueChange={setPrintBuyerFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buyers</SelectItem>
                  {buyers.map((buyer) => <SelectItem key={buyer.id} value={buyer.id}>{buyer.buyer_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date filter</Label>
              <Select value={filterMode} onValueChange={(value) => setFilterMode(value as DateFilterMode)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="day">One day</SelectItem>
                  <SelectItem value="month">One month</SelectItem>
                  <SelectItem value="range">Date range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterMode === "day" && (
              <div className="space-y-1"><Label>Date</Label><Input className="w-40" type="date" value={filterDay} onChange={(e) => setFilterDay(e.target.value)} /></div>
            )}
            {filterMode === "month" && (
              <div className="space-y-1"><Label>Month</Label><Input className="w-40" type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} /></div>
            )}
            {filterMode === "range" && (
              <>
                <div className="space-y-1"><Label>From</Label><Input className="w-40" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} /></div>
                <div className="space-y-1"><Label>To</Label><Input className="w-40" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} /></div>
              </>
            )}
            {filterMode !== "all" && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => {
                  setFilterMode("all");
                  setFilterDay(today());
                  setFilterMonth(today().slice(0, 7));
                  setFilterFrom("");
                  setFilterTo("");
                }}
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                const reportEntries = entries.filter((entry) =>
                  (printBuyerFilter === "all" || entry.buyer_id === printBuyerFilter) &&
                  matchesDateFilter(entry, filterMode, filterDay, filterMonth, filterFrom, filterTo)
                );
                printRecords(printBuyerFilter, reportEntries);
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </>
        )}
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {buyers.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            No buyers yet. Click "Add Buyer" to create one.
          </div>
        )}
        {buyers.length > 0 && visibleBuyers.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            No buyers match your search.
          </div>
        )}
        {visibleBuyers.map((b, index) => (
          <div
            key={b.id}
            ref={index === 0 ? firstBuyerCardRef : undefined}
            onClick={() => setBuyerId(b.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
              e.preventDefault();
              setBuyerId(b.id);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open print history for ${b.buyer_name}`}
            className="relative cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <div className="mb-2 text-xs text-muted-foreground">
              {buyerLastActivity.has(b.id)
                ? `Updated: ${new Date(buyerLastActivity.get(b.id)!).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                : "No print entries"}
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{b.buyer_name}</div>
                {b.merchandiser_name && (
                  <div className="text-xs text-muted-foreground truncate">{b.merchandiser_name}</div>
                )}
              </div>
              {(perm.edit || perm.delete) && (
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Actions for ${b.buyer_name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {perm.edit && (
                        <DropdownMenuItem onClick={() => openEditBuyer(b)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      {perm.delete && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteBuyer(b)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="text-xs text-muted-foreground">Total PCS</div>
              <div className="text-2xl font-bold text-primary">{num(allBuyerTotals.get(b.id) || 0)}</div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {buyerId && (
      <>
      <div className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="text-left rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary transition"
        >
          <div className="text-sm text-muted-foreground">Total PCS — {buyerName(buyerId)}</div>
          <div className="text-3xl font-bold text-primary mt-1">{num(buyerTotal)}</div>
          <div className="text-xs text-muted-foreground mt-1">Tap to see day-by-day</div>
        </button>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-sm text-muted-foreground">Print days</div>
          <div className="text-3xl font-bold mt-1">{byDate.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-sm text-muted-foreground">Filtered total</div>
          <div className="text-3xl font-bold mt-1">{num(filteredTotal)}</div>
        </div>
      </div>

      {perm.add && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" /> New Entry</CardTitle></CardHeader>
          <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} disabled={!canBackdate} max={today()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Printed PCS</Label>
                <Input type="number" min={1} autoFocus value={pcs} onFocus={(e) => e.currentTarget.select()} onChange={(e) => setPcs(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>PO/Style No</Label>
                <Input value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
              </div>
              <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </CardContent>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Records — {buyerName(buyerId)}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 w-full pl-9 sm:w-52"
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                placeholder="Search PO/Style or PCS"
                aria-label="Search records by PO/Style or PCS"
              />
            </div>
            <Select value={filterMode} onValueChange={(v) => setFilterMode(v as any)}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="day">One day</SelectItem>
                <SelectItem value="month">One month</SelectItem>
                <SelectItem value="range">Date range</SelectItem>
              </SelectContent>
            </Select>
            {filterMode === "day" && <Input className="w-40 h-9" type="date" value={filterDay} onChange={(e) => setFilterDay(e.target.value)} />}
            {filterMode === "month" && <Input className="w-40 h-9" type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />}
            {filterMode === "range" && (
              <>
                <Input className="w-40 h-9" type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} aria-label="From date" />
                <span className="self-center text-xs text-muted-foreground">to</span>
                <Input className="w-40 h-9" type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} aria-label="To date" />
              </>
            )}
            {filterMode !== "all" && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setFilterMode("all");
                  setFilterDay(today());
                  setFilterMonth(today().slice(0, 7));
                  setFilterFrom("");
                  setFilterTo("");
                }}
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {perm.print && (
              <Button className="h-9" onClick={() => printRecords(buyerId, filtered)}><Printer className="h-4 w-4 mr-1" /> Print</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse border border-sky-200 text-sm dark:border-slate-700">
            <thead>
              <tr className="text-left text-sky-900 dark:text-sky-100">
                <th className="border border-sky-200 bg-sky-100 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800">NO</th>
                <th className="border border-sky-200 bg-sky-100 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800">Date</th>
                <th className="border border-sky-200 bg-sky-100 px-3 py-2 text-right font-semibold dark:border-slate-700 dark:bg-slate-800">PCS</th>
                <th className="border border-sky-200 bg-sky-100 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800">PO/Style</th>
                <th className="border border-sky-200 bg-sky-100 px-3 py-2 font-semibold dark:border-slate-700 dark:bg-slate-800">Note</th>
                {(perm.edit || perm.delete) && <th className="border border-sky-200 bg-sky-100 px-3 py-2 text-right font-semibold dark:border-slate-700 dark:bg-slate-800">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5 + (perm.edit || perm.delete ? 1 : 0)} className="border border-sky-200 px-3 py-6 text-center text-muted-foreground dark:border-slate-700">No records</td></tr>
              )}
              {filtered.map((e, i) => (
                <tr key={e.id} className="odd:bg-white even:bg-sky-50/60 hover:bg-sky-100/70 dark:odd:bg-slate-900 dark:even:bg-slate-800/50 dark:hover:bg-slate-700/70">
                  <td className="border border-sky-200 px-3 py-2 dark:border-slate-700">{i + 1}</td>
                  <td className="whitespace-nowrap border border-sky-200 px-3 py-2 dark:border-slate-700">{fmt(e.print_date)}</td>
                  <td className="border border-sky-200 px-3 py-2 text-right font-semibold dark:border-slate-700">{num(e.pcs)}</td>
                  <td className="whitespace-nowrap border border-sky-200 px-3 py-2 dark:border-slate-700">{e.po_no || "-"}</td>
                  <td className="border border-sky-200 px-3 py-2 dark:border-slate-700">{e.note || "-"}</td>
                  {(perm.edit || perm.delete) && (
                    <td className="whitespace-nowrap border border-sky-200 px-3 py-1 text-right dark:border-slate-700">
                      {perm.edit && <Button size="icon" variant="ghost" onClick={() => setEditing({ ...e })}><Pencil className="h-4 w-4" /></Button>}
                      {perm.delete && <Button size="icon" variant="ghost" onClick={() => setDeleteId(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-sky-100 font-bold text-sky-900 dark:bg-slate-800 dark:text-sky-100">
                <td colSpan={2} className="border border-sky-200 px-3 py-2 dark:border-slate-700">Total PCS</td>
                <td className="border border-sky-200 px-3 py-2 text-right dark:border-slate-700">{num(filteredTotal)}</td>
                <td colSpan={2 + (perm.edit || perm.delete ? 1 : 0)} className="border border-sky-200 px-3 py-2 dark:border-slate-700">
                  {filtered.length} {filtered.length === 1 ? "record" : "records"}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
      </>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{buyerName(buyerId)} — PCS by date</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="py-2 text-left">Date</th><th className="py-2 text-right">PCS</th></tr></thead>
              <tbody>
                {byDate.map(([d, total]) => (
                  <tr key={d} className="border-b last:border-0"><td className="py-2">{fmt(d)}</td><td className="py-2 text-right font-semibold">{num(total)}</td></tr>
                ))}
                {byDate.length === 0 && <tr><td colSpan={2} className="py-4 text-center text-muted-foreground">No records</td></tr>}
              </tbody>
              <tfoot><tr><td className="pt-3 font-bold">Total</td><td className="pt-3 text-right font-bold text-primary">{num(buyerTotal)}</td></tr></tfoot>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit entry</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" max={today()} value={editing.print_date} onChange={(e) => setEditing({ ...editing, print_date: e.target.value })} /></div>
              <div className="space-y-1"><Label>PCS</Label><Input type="number" value={editing.pcs} onChange={(e) => setEditing({ ...editing, pcs: Number(e.target.value) })} /></div>
              <div className="space-y-1"><Label>PO/Style No</Label><Input value={editing.po_no || ""} onChange={(e) => setEditing({ ...editing, po_no: e.target.value })} /></div>
              <div className="space-y-1"><Label>Note</Label><Input value={editing.note || ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></div>
              <Button className="w-full" onClick={saveEdit}><Save className="h-4 w-4 mr-1" /> Update</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This print record will be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={buyerDialog} onOpenChange={setBuyerDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingBuyer ? "Edit Buyer" : "Add Buyer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Buyer Name *</Label>
              <Input value={buyerForm.buyer_name} onChange={(e) => setBuyerForm({ ...buyerForm, buyer_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Merchandiser Name</Label>
              <Input value={buyerForm.merchandiser_name} onChange={(e) => setBuyerForm({ ...buyerForm, merchandiser_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Merchandiser Phone</Label>
              <Input value={buyerForm.merchandiser_phone} onChange={(e) => setBuyerForm({ ...buyerForm, merchandiser_phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={buyerForm.status} onValueChange={(v) => setBuyerForm({ ...buyerForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={saveBuyer}><Save className="h-4 w-4 mr-1" /> {editingBuyer ? "Update" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBuyer} onOpenChange={(o) => !o && setDeleteBuyer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete buyer "{deleteBuyer?.buyer_name}"?</AlertDialogTitle>
            <AlertDialogDescription>The buyer and all of their print history records will be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBuyer}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
