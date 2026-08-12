import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sticker, Plus, User, Building2, Pencil, Trash2, Search, ArrowLeft, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Package, FileText, History, Printer, LayoutDashboard, Users, TrendingDown, Layers, MessageCircle, UserCheck, MoreVertical, Mail, Scissors, ScanBarcode, FileEdit, Image as ImageIcon, ScanText, Edit3, BookOpen, QrCode, FileSignature } from "lucide-react";
import { toast } from "sonner";
import dbService from "@/services/indexedDBService";
import PermGate from "@/components/PermGate";
import { usePerm } from "@/hooks/usePerm";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";

interface Buyer {
  id: string;
  buyer_name: string;
  merchandiser_name: string;
  merchandiser_phone: string;
  gpq_name: string;
  gpq_phone: string;
  store_officer_name?: string;
  store_officer_phone?: string;
  merchandiser_email?: string;
  store_officer_email?: string;
  gpq_email?: string;
  logo?: string;
  status: "Active" | "Inactive";
  created_at: string;
}

type TxnType = "sticker_receive" | "sticker_issue" | "sticker_damage" | "ribbon_receive" | "ribbon_issue";

interface Txn {
  id: string;
  buyer_id: string;
  type: TxnType;
  roll: number;
  pcs: number;
  po_no?: string;
  style?: string;
  color?: string;
  roll_no?: string;
  receive_date?: string;
  si_number?: string;
  delivered_by?: string;
  designation?: string;
  phone?: string;
  sticker_size?: string;
  pcs_per_roll?: number;
  length_per_roll?: number;
  total_length?: number;
  sl_no?: string;
  source_receive_id?: string;
  sub_roll_index?: number;
  note: string;
  date: string;
}

const LOW_STOCK_ROLL = 5;

const MNR_LOGO_URL = typeof window !== "undefined" ? `${window.location.origin}/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png` : "";
const mnrPrintStyles = `<style>
  @page{size:A4;margin:0}
  html,body{margin:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:12mm 12mm 14mm}
  .mnr-head{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;background:linear-gradient(135deg,#eef2ff 0%,#faf5ff 100%);border:1px solid #c7d2fe;border-radius:12px;padding:14px 16px;margin-bottom:14px;position:relative;box-shadow:0 2px 6px rgba(79,70,229,.08)}
  .mnr-head img{width:70px;height:70px;border-radius:50%;object-fit:contain;background:#fff;border:2px solid #4f46e5;padding:3px}
  .mnr-head .info{text-align:center}
  .mnr-head .t1{font-size:22px;font-weight:800;color:#4f46e5;letter-spacing:.5px;margin:0;line-height:1.1}
  .mnr-head .t2{font-size:13px;color:#4b5563;margin:4px 0 0;font-weight:600}
  .mnr-head .meta{position:absolute;right:12px;top:10px;text-align:right;font-size:10px;color:#6b7280;line-height:1.4}
  .mnr-foot{margin-top:16px;border-top:2px solid #c7d2fe;padding-top:6px;text-align:center;font-size:10px;color:#6b7280}
</style>`;
const mnrPrintHead = (subtitle: string) => `<div class="mnr-head">
  <img src="${MNR_LOGO_URL}" alt="MNR" crossorigin="anonymous" />
  <div class="info"><div class="t1">MNR GROUP</div><div class="t2">${subtitle}</div></div>
  <div class="meta">${new Date().toLocaleString()}</div>
</div>`;
const mnrPrintFooter = `<div class="mnr-foot">© MNR Group · IT Assets Management</div>`;
const mnrPrintScript = `<script>(function(){function go(){try{window.focus();window.print();}catch(e){}setTimeout(function(){window.close();},500);}var imgs=document.images;var pending=0;for(var i=0;i<imgs.length;i++){if(!imgs[i].complete){pending++;imgs[i].addEventListener('load',done);imgs[i].addEventListener('error',done);}}function done(){if(--pending<=0)setTimeout(go,150);}if(pending===0){setTimeout(go,200);}else{setTimeout(go,2500);}})();<\/script>`;

const emptyBuyer: Omit<Buyer, "id" | "created_at"> = {
  buyer_name: "", merchandiser_name: "", merchandiser_phone: "",
  gpq_name: "", gpq_phone: "", store_officer_name: "", store_officer_phone: "",
  merchandiser_email: "", store_officer_email: "", gpq_email: "",
  logo: "", status: "Active",
};

const LABEL: Record<TxnType, string> = {
  sticker_receive: "Sticker Receive",
  sticker_issue: "Sticker Issue",
  sticker_damage: "Sticker Damage",
  ribbon_receive: "Ribbon Receive",
  ribbon_issue: "Ribbon Issue",
};

const sum = (list: Txn[], type: TxnType, field: "roll" | "pcs") =>
  list.filter((t) => t.type === type).reduce((s, t) => s + (t[field] || 0), 0);

const buyerTotals = (list: Txn[]) => {
  const stickerRollRecv = sum(list, "sticker_receive", "roll");
  const stickerRollIss = sum(list, "sticker_issue", "roll");
  const stickerPcsRecv = sum(list, "sticker_receive", "pcs");
  const stickerPcsIss = sum(list, "sticker_issue", "pcs");
  const stickerPcsDmg = sum(list, "sticker_damage", "pcs");
  const ribbonRollRecv = sum(list, "ribbon_receive", "roll");
  const ribbonRollIss = sum(list, "ribbon_issue", "roll");
  return {
    stickerRollRecv, stickerRollIss, stickerPcsRecv, stickerPcsIss, stickerPcsDmg,
    ribbonRollRecv, ribbonRollIss,
    stickerRoll: stickerRollRecv - stickerRollIss,
    stickerPcs: stickerPcsRecv - stickerPcsIss - stickerPcsDmg,
    ribbonRoll: ribbonRollRecv - ribbonRollIss,
  };
};

const StickerPrinter = () => {
  const navigate = useNavigate();
  const perm = usePerm("/sticker-printer");
  const canContact = perm.issue || perm.recv || perm.edit;
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyBuyer });
  const [search, setSearch] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [recvDialog, setRecvDialog] = useState<null | "sticker" | "ribbon">(null);
  const [recvForm, setRecvForm] = useState({
    buyer_id: "", roll: "", pcs: "", po_no: "", style: "", roll_no: "", si_number: "", sl_no: "", note: "",
    receive_date: new Date().toISOString().slice(0, 10),
    delivered_by: "", designation: "", phone: "", sticker_size: "", pcs_per_roll: "",
    length_per_roll: "",
  });
  const [stickerSizeUnit, setStickerSizeUnit] = useState<"mm" | "inch" | "wh">("mm");
  const [ribbonIssueDialog, setRibbonIssueDialog] = useState<{ buyerId: string } | null>(null);
  const [ribIss, setRibIss] = useState({ buyer_id: "", receive_id: "", roll: "", note: "", issue_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  const openRibbonIssue = (buyerId: string = "") => {
    setRibIss({ buyer_id: buyerId, receive_id: "", roll: "", note: "", issue_date: new Date().toISOString().slice(0, 10) });
    setRibbonIssueDialog({ buyerId });
  };

  const saveRibbonIssue = async () => {
    if (saving) return;
    if (!ribIss.buyer_id) { toast.error("Select a buyer"); return; }
    if (!ribIss.receive_id) { toast.error("Select a ribbon roll"); return; }
    const roll = parseFloat(ribIss.roll) || 0;
    if (roll <= 0) { toast.error("Enter roll quantity"); return; }
    const receive = txns.find((t) => t.id === ribIss.receive_id);
    if (!receive) { toast.error("Receive not found"); return; }
    const issued = txns
      .filter((t) => t.type === "ribbon_issue" && (t.source_receive_id === receive.id || (!t.source_receive_id && !!(receive.roll_no || "").trim() && (t.roll_no || "").trim() === (receive.roll_no || "").trim())))
      .reduce((s, t) => s + (t.roll || 0), 0);
    const balance = (receive.roll || 0) - issued;
    if (roll > balance) { toast.error(`Only ${balance} roll(s) available`); return; }
    const existingSls = txns
      .filter((t) => t.buyer_id === ribIss.buyer_id && t.type === "ribbon_issue")
      .map((t) => parseInt(String(t.sl_no || "0"), 10))
      .filter((n) => !isNaN(n));
    const nextSl = (existingSls.length ? Math.max(...existingSls) : 0) + 1;
    setSaving(true);
    try {
      await dbService.add("buyer_transactions", {
        id: `txn_${Date.now()}`, buyer_id: ribIss.buyer_id, type: "ribbon_issue",
        roll, pcs: 0,
        po_no: receive.po_no, style: receive.style, color: receive.color, roll_no: receive.roll_no,
        source_receive_id: receive.id,
        sl_no: recvForm.sl_no?.trim() || String(nextSl),
        note: ribIss.note,
        date: (() => {
          const now = new Date();
          if (ribIss.issue_date) {
            const [y, m, d] = ribIss.issue_date.split("-").map(Number);
            const dt = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), now.getSeconds());
            return dt.toISOString();
          }
          return now.toISOString();
        })(),
      });
      toast.success(`Issued ${roll} ribbon roll(s)`);
      setRibbonIssueDialog(null);
      loadAll();
    } finally {
      setSaving(false);
    }
  };

  const ribbonIssueDialogEl = (
    <Dialog open={!!ribbonIssueDialog} onOpenChange={(o) => !o && setRibbonIssueDialog(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowUpCircle className="w-5 h-5 text-orange-600" /> Ribbon Issue</DialogTitle>
        </DialogHeader>
        {(() => {
          const buyerReceives = txns.filter((t) => t.type === "ribbon_receive");
          const withBal = buyerReceives.map((r) => {
            const key = (r.roll_no || "").trim();
            const iss = txns
              .filter((t) => t.type === "ribbon_issue" && (t.source_receive_id === r.id || (!t.source_receive_id && !!key && (t.roll_no || "").trim() === key)))
              .reduce((s, t) => s + (t.roll || 0), 0);
            return { r, bal: (r.roll || 0) - iss };
          }).filter((x) => x.bal > 0);
          const sel = withBal.find((x) => x.r.id === ribIss.receive_id);
          return (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Buyer *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-muted"
                  value={ribIss.buyer_id}
                  disabled={!!ribbonIssueDialog?.buyerId}
                  onChange={(e) => setRibIss({ ...ribIss, buyer_id: e.target.value, receive_id: "" })}
                >
                  <option value="">-- Select Buyer --</option>
                  {buyers.filter((b) => b.status === "Active").map((b) => (
                    <option key={b.id} value={b.id}>{b.buyer_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Label>Ribbon Roll *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={ribIss.receive_id}
                  onChange={(e) => setRibIss({ ...ribIss, receive_id: e.target.value })}
                >
                  <option value="">-- Select Ribbon Roll --</option>
                  {withBal.map(({ r, bal }) => (
                    <option key={r.id} value={r.id}>
                      Sl {r.sl_no || "-"} · {new Date(r.date).toLocaleDateString()} · Bal {bal}/{r.roll}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Available Roll</Label>
                <Input value={sel ? sel.bal : 0} readOnly className="bg-muted font-semibold text-indigo-700" />
              </div>
              <div>
                <Label>Issue Roll *</Label>
                <Input type="number" min="0" max={sel?.bal || 0} value={ribIss.roll} onChange={(e) => setRibIss({ ...ribIss, roll: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Date</Label>
                <Input type="date" value={ribIss.issue_date} onChange={(e) => setRibIss({ ...ribIss, issue_date: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Note</Label>
                <Textarea rows={2} value={ribIss.note} onChange={(e) => setRibIss({ ...ribIss, note: e.target.value })} />
              </div>
            </div>
          );
        })()}
        <DialogFooter>
          <Button variant="outline" onClick={() => setRibbonIssueDialog(null)}>Cancel</Button>
          <Button disabled={saving} onClick={saveRibbonIssue} className="bg-gradient-to-r from-orange-500 to-red-500">Issue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  useEffect(() => { loadAll(); }, []);

  useCloudRealtime(["sticker_buyers", "sticker_transactions"], () => { loadAll(); });

  const loadAll = async () => {
    try {
      const [b, t] = await Promise.all([
        dbService.getAll("buyers"),
        dbService.getAll("buyer_transactions"),
      ]);
      setBuyers(b as Buyer[]);
      setTxns(t as Txn[]);
    } catch (e) { console.error(e); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const openAdd = () => { setEditingId(null); setForm({ ...emptyBuyer }); setDialogOpen(true); };
  const openEdit = (b: Buyer) => {
    setEditingId(b.id);
    setForm({ buyer_name: b.buyer_name, merchandiser_name: b.merchandiser_name, merchandiser_phone: b.merchandiser_phone, gpq_name: b.gpq_name, gpq_phone: b.gpq_phone, store_officer_name: b.store_officer_name || "", store_officer_phone: b.store_officer_phone || "", merchandiser_email: b.merchandiser_email || "", store_officer_email: b.store_officer_email || "", gpq_email: b.gpq_email || "", logo: b.logo || "", status: b.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.buyer_name.trim()) { toast.error("Buyer Name required"); return; }
    try {
      if (editingId) {
        const ex = buyers.find((b) => b.id === editingId)!;
        await dbService.put("buyers", { ...ex, ...form });
        toast.success("Buyer updated");
      } else {
        await dbService.add("buyers", { id: `buyer_${Date.now()}`, ...form, created_at: new Date().toISOString() });
        toast.success("Buyer added");
      }
      setDialogOpen(false); loadAll();
    } catch { toast.error("Failed to save"); }
  };

  const handleDelete = async (id: string) => {
    await dbService.delete("buyers", id);
    for (const t of txns.filter((t) => t.buyer_id === id)) await dbService.delete("buyer_transactions", t.id);
    toast.success("Buyer deleted"); loadAll();
  };

  const openRecv = (kind: "sticker" | "ribbon", buyerId: string = "") => {
    setRecvForm({
      buyer_id: buyerId, roll: "", pcs: "", po_no: "", style: "", roll_no: "", si_number: "", sl_no: "", note: "",
      receive_date: new Date().toISOString().slice(0, 10),
      delivered_by: "", designation: "", phone: "", sticker_size: "", pcs_per_roll: "",
      length_per_roll: "",
    });
    setStickerSizeUnit("mm");
    setRecvDialog(kind);
  };

  const saveRecv = async () => {
    if (saving) return;
    const isRibbon = recvDialog === "ribbon";
    const buyerId = isRibbon ? "__global_ribbon__" : recvForm.buyer_id;
    if (!isRibbon && !recvForm.buyer_id) { toast.error("Select a buyer"); return; }
    const roll = parseFloat(recvForm.roll) || 0;
    const pcsPerRoll = parseFloat(recvForm.pcs_per_roll) || 0;
    const lenPerRoll = parseFloat(recvForm.length_per_roll) || 0;
    const pcs = recvDialog === "sticker"
      ? (parseFloat(recvForm.pcs) || (roll * pcsPerRoll))
      : 0;
    if (roll <= 0 && pcs <= 0) { toast.error("Enter roll or pcs"); return; }
    const type: TxnType = recvDialog === "sticker" ? "sticker_receive" : "ribbon_receive";
    const isStk = recvDialog === "sticker";
    // Auto-generate Sl number: next sequential per buyer + type
    const existingSls = txns
      .filter((t) => t.buyer_id === buyerId && t.type === type)
      .map((t) => parseInt(String(t.sl_no || "0"), 10))
      .filter((n) => !isNaN(n));
    const nextSl = (existingSls.length ? Math.max(...existingSls) : 0) + 1;
    const newTxn: Txn = {
      id: `txn_${Date.now()}`, buyer_id: buyerId, type,
      roll, pcs,
      sl_no: String(nextSl),
      po_no: isStk ? recvForm.po_no : undefined,
      style: isStk ? recvForm.style : undefined,
      roll_no: isStk ? recvForm.roll_no : undefined,
      receive_date: recvForm.receive_date,
      si_number: recvForm.si_number || (isRibbon
        ? String(txns.filter((t) => t.type === "ribbon_receive").length + 1)
        : undefined),
      delivered_by: recvForm.delivered_by, designation: recvForm.designation, phone: recvForm.phone,
      sticker_size: isStk ? recvForm.sticker_size : undefined,
      pcs_per_roll: isStk ? (pcsPerRoll || undefined) : undefined,
      length_per_roll: !isStk ? (lenPerRoll || undefined) : undefined,
      total_length: !isStk ? (roll * lenPerRoll || undefined) : undefined,
      note: recvForm.note,
      date: (() => {
        const now = new Date();
        if (recvForm.receive_date) {
          const [y, m, d] = recvForm.receive_date.split("-").map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), now.getSeconds());
          return dt.toISOString();
        }
        return now.toISOString();
      })(),
    };
    setSaving(true);
    try {
      await dbService.add("buyer_transactions", newTxn);
      toast.success(`${LABEL[type]} saved`);
      setRecvDialog(null);
      loadAll();
    } finally {
      setSaving(false);
    }
  };

  const filteredBuyers = buyers.filter((b) =>
    [b.buyer_name, b.merchandiser_name, b.gpq_name].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;

  // ---- global totals ----
  const globalTotals = useMemo(() => buyerTotals(txns), [txns]);

  if (selectedBuyer) {
    const buyerSlice = txns.filter((t) => t.buyer_id === selectedBuyer.id || t.type === "ribbon_receive" || t.type === "ribbon_issue");
    const bt = buyerTotals(buyerSlice);
    return (
      <>
        <BuyerDetail buyer={selectedBuyer} txns={buyerSlice} totals={bt} onBack={() => setSelectedBuyerId(null)} onChange={loadAll} onOpenRecv={(k) => openRecv(k, selectedBuyer.id)} onOpenRibbonIssue={() => openRibbonIssue(selectedBuyer.id)} />
        <Dialog open={!!recvDialog} onOpenChange={(o) => !o && setRecvDialog(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">{recvDialog === "sticker" ? "Sticker Receive" : "Ribbon Receive"}</DialogTitle>
            </DialogHeader>
            {(() => {
              const selBuyer = buyers.find((b) => b.id === recvForm.buyer_id);
              const rollNum = parseFloat(recvForm.roll) || 0;
              const pprNum = parseFloat(recvForm.pcs_per_roll) || 0;
              const totalPcs = rollNum * pprNum;
              const isSticker = recvDialog === "sticker";
              const autoRibbonSi = !isSticker
                ? String(txns.filter((t) => t.type === "ribbon_receive").length + 1)
                : "";
              return (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <Label>Receive Date</Label>
                    <Input type="date" value={recvForm.receive_date} onChange={(e) => setRecvForm({ ...recvForm, receive_date: e.target.value })} />
                  </div>
                  {isSticker && (() => {
                    const nextSl = txns.filter((t) => t.buyer_id === recvForm.buyer_id && t.type === "sticker_receive").length + 1;
                    return (
                      <div>
                        <Label>Sl (auto / custom)</Label>
                        <Input value={recvForm.sl_no} onChange={(e) => setRecvForm({ ...recvForm, sl_no: e.target.value })} placeholder={String(nextSl)} />
                      </div>
                    );
                  })()}
                  {!isSticker && (
                    <div>
                      <Label>SI</Label>
                      <Input value={recvForm.si_number || autoRibbonSi} readOnly className="bg-muted font-semibold" />
                    </div>
                  )}
                  {isSticker && (<div>
                    <Label>Buyer Name *</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={recvForm.buyer_id}
                      onChange={(e) => setRecvForm({ ...recvForm, buyer_id: e.target.value })}
                    >
                      <option value="">-- Select Buyer --</option>
                      {buyers.filter((b) => b.status === "Active").map((b) => (
                        <option key={b.id} value={b.id}>{b.buyer_name}</option>
                      ))}
                    </select>
                  </div>)}
                  {isSticker && (
                    <>
                      <div><Label>Merchandiser Name</Label><Input value={selBuyer?.merchandiser_name || ""} readOnly className="bg-muted" /></div>
                      <div><Label>Gpq Name</Label><Input value={selBuyer?.gpq_name || ""} readOnly className="bg-muted" /></div>
                      <div className="col-span-2"><Label>Store Officer Name</Label><Input value={selBuyer?.store_officer_name || ""} readOnly className="bg-muted" /></div>
                      <div><Label>Delivered By</Label><Input value={recvForm.delivered_by} onChange={(e) => setRecvForm({ ...recvForm, delivered_by: e.target.value })} /></div>
                      <div><Label>Designation</Label><Input value={recvForm.designation} onChange={(e) => setRecvForm({ ...recvForm, designation: e.target.value })} /></div>
                      <div><Label>Phone Number</Label><Input value={recvForm.phone} onChange={(e) => setRecvForm({ ...recvForm, phone: e.target.value })} /></div>
                      <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
                        <Label className="mb-2 block">Sticker Size</Label>
                        {(() => {
                          const m = (recvForm.sticker_size || "").match(/^\s*([\d.]*)\s*[x×]\s*([\d.]*)\s*(mm|inch)?\s*$/i);
                          const w = m ? m[1] : "";
                          const h = m ? m[2] : "";
                          const unit = stickerSizeUnit;
                          const build = (nw: string, nh: string, nu: string) => (nw || nh) ? `${nw}×${nh}${nu && nu !== "wh" ? " " + nu : ""}` : "";
                          return (
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:grid-cols-[8rem_1fr_auto_1fr] sm:items-end">
                              <div className="col-span-3 sm:col-span-1">
                                <Label className="text-xs text-muted-foreground">Unit</Label>
                                <Select value={unit} onValueChange={(v: "mm" | "inch" | "wh") => { setStickerSizeUnit(v); setRecvForm({ ...recvForm, sticker_size: build(w, h, v) }); }}>
                                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mm">mm</SelectItem>
                                    <SelectItem value="inch">inch</SelectItem>
                                    <SelectItem value="wh">W×H</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Width</Label>
                                <Input type="number" placeholder="Width" value={w} onChange={(e) => setRecvForm({ ...recvForm, sticker_size: build(e.target.value, h, unit) })} />
                              </div>
                              <span className="pb-2 text-center text-lg font-semibold text-muted-foreground">×</span>
                              <div>
                                <Label className="text-xs text-muted-foreground">Height</Label>
                                <Input type="number" placeholder="Height" value={h} onChange={(e) => setRecvForm({ ...recvForm, sticker_size: build(w, e.target.value, unit) })} />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div><Label>Receive Roll Qty</Label><Input type="number" value={recvForm.roll} onChange={(e) => setRecvForm({ ...recvForm, roll: e.target.value })} /></div>
                      <div><Label>Pcs Per Roll</Label><Input type="number" value={recvForm.pcs_per_roll} onChange={(e) => setRecvForm({ ...recvForm, pcs_per_roll: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Total Pcs (Auto)</Label><Input value={totalPcs || ""} readOnly className="bg-muted font-semibold" /></div>
                    </>
                  )}
                  {!isSticker && (
                    <>
                      <div><Label>Receive Roll Qty</Label><Input type="number" value={recvForm.roll} onChange={(e) => setRecvForm({ ...recvForm, roll: e.target.value })} /></div>
                      <div><Label>Length Per Roll</Label><Input type="number" value={recvForm.length_per_roll} onChange={(e) => setRecvForm({ ...recvForm, length_per_roll: e.target.value })} /></div>
                      <div className="sm:col-span-2"><Label>Total Length (Auto)</Label><Input value={((parseFloat(recvForm.roll) || 0) * (parseFloat(recvForm.length_per_roll) || 0)) || ""} readOnly className="bg-muted font-semibold" /></div>
                    </>
                  )}
                  <div className="sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={recvForm.note} onChange={(e) => setRecvForm({ ...recvForm, note: e.target.value })} /></div>
                </div>
              );
            })()}
            <DialogFooter className="gap-2 flex-row justify-end">
              <Button size="sm" variant="outline" onClick={() => setRecvDialog(null)}>Cancel</Button>
              <Button size="sm" disabled={saving} onClick={saveRecv} className={`bg-gradient-to-r ${recvDialog === "sticker" ? "from-green-500 to-emerald-600" : "from-pink-500 to-rose-600"}`}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {ribbonIssueDialogEl}
      </>
    );
  }

  return (
    <div className="w-full max-w-none py-4 sm:py-6 px-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shrink-0">
            <Sticker className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent truncate">Sticker Printer</h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm hidden sm:block">Buyers, stickers, ribbons & reports</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search buyer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 w-full sm:w-56 text-sm" />
          </div>
          <PermGate action="add" path="/sticker-printer">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-indigo-500 to-purple-600 h-9 px-2 sm:px-3">
                  <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Add Buyer</span>
                </Button>
              </DialogTrigger>
            </Dialog>
          </PermGate>
          <Button variant="outline" onClick={() => {
            const w = window.open("", "_blank", "width=1000,height=700");
            if (!w) return;
            const now = new Date();
            const dateStr = now.toLocaleDateString();
            const dayStr = now.toLocaleDateString(undefined, { weekday: "long" });
            const timeStr = now.toLocaleTimeString();
            const rows = buyers.map((b, i) => {
              const t = buyerTotals(txns.filter((tx) => tx.buyer_id === b.id || tx.type === "ribbon_receive" || tx.type === "ribbon_issue"));
              return `<tr>
                <td style="text-align:center">${i + 1}</td>
                <td><b>${b.buyer_name || "-"}</b><div style="font-size:10px;color:#666">${b.status || ""}</div></td>
                <td>${b.merchandiser_name || "-"}<div style="font-size:10px;color:#666">${b.merchandiser_phone || ""}</div></td>
                <td>${b.gpq_name || "-"}<div style="font-size:10px;color:#666">${b.gpq_phone || ""}</div></td>
                <td>${b.store_officer_name || "-"}<div style="font-size:10px;color:#666">${b.store_officer_phone || ""}</div></td>
                <td class="num recv">${t.stickerRollRecv}<span class="sub">/${t.stickerPcsRecv} pcs</span></td>
                <td class="num stock">${t.stickerRoll}<span class="sub">/${t.stickerPcs} pcs</span></td>
                <td class="num iss">${t.stickerRollIss}<span class="sub">/${t.stickerPcsIss} pcs</span></td>
                <td class="num dmg">${t.stickerPcsDmg}<span class="sub">pcs</span></td>
                <td class="num rrecv">${t.ribbonRollRecv}</td>
                <td class="num rstock">${t.ribbonRoll}</td>
                <td class="num riss">${t.ribbonRollIss}</td>
              </tr>`;
            }).join("");
            const subtitle = `Buyers Full Details · ${dateStr} (${dayStr}) · ${timeStr}`;
            const gt = buyers.reduce((acc, b) => {
              const t = buyerTotals(txns.filter((tx) => tx.buyer_id === b.id || tx.type === "ribbon_receive" || tx.type === "ribbon_issue"));
              acc.sRcvR += t.stickerRollRecv; acc.sRcvP += t.stickerPcsRecv;
              acc.sStkR += t.stickerRoll; acc.sStkP += t.stickerPcs;
              acc.sIssR += t.stickerRollIss; acc.sIssP += t.stickerPcsIss;
              acc.sDmgP += t.stickerPcsDmg;
              return acc;
            }, { sRcvR: 0, sRcvP: 0, sStkR: 0, sStkP: 0, sIssR: 0, sIssP: 0, sDmgP: 0 });
            const grib = buyers.length > 0 ? buyerTotals(txns.filter((tx) => tx.type === "ribbon_receive" || tx.type === "ribbon_issue")) : { ribbonRollRecv: 0, ribbonRoll: 0, ribbonRollIss: 0 };
            const totalsRow = `<tr class="tot"><td colspan="5" style="text-align:right">TOTAL</td>
              <td class="num recv">${gt.sRcvR}<span class="sub">/${gt.sRcvP} pcs</span></td>
              <td class="num stock">${gt.sStkR}<span class="sub">/${gt.sStkP} pcs</span></td>
              <td class="num iss">${gt.sIssR}<span class="sub">/${gt.sIssP} pcs</span></td>
              <td class="num dmg">${gt.sDmgP}<span class="sub">pcs</span></td>
              <td class="num rrecv">${grib.ribbonRollRecv}</td>
              <td class="num rstock">${grib.ribbonRoll}</td>
              <td class="num riss">${grib.ribbonRollIss}</td></tr>`;
            const buyerNameOf = (id: string) => buyers.find((bb) => bb.id === id)?.buyer_name || "-";
            const escH = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
            const fmtDate = (d: string) => {
              const dt = new Date(d);
              const day = dt.toLocaleDateString(undefined, { weekday: "short" });
              const date = dt.toLocaleDateString();
              const time = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return `<div style="line-height:1.25"><div style="font-weight:600">${date}</div><div style="color:#666;font-size:9px">${day} · ${time}</div></div>`;
            };
            const detailSection = (title: string, icon: string, list: Txn[], grad: string, showPcs: boolean, showRoll: boolean, showNote: boolean) => {
              if (list.length === 0) return `<div class="det-sec"><div class="det-hd" style="background:${grad}">${icon} ${title} <span class="pill">0 entries</span></div><div class="empty">No ${title.toLowerCase()} yet</div></div>`;
              const totRoll = list.reduce((a, t) => a + (t.roll || 0), 0);
              const totPcs = list.reduce((a, t) => a + (t.pcs || 0), 0);
              const cols = ["#", "Date", "Buyer", "PO", "Style", "Roll No", showRoll ? "Roll" : null, showPcs ? "Pcs" : null, showNote ? "Note" : null].filter(Boolean) as string[];
              const body = list.map((t, i) => `<tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${fmtDate(t.date)}</td>
                <td><b>${escH(buyerNameOf(t.buyer_id))}</b></td>
                <td>${escH(t.po_no || "-")}</td>
                <td>${escH(t.style || "-")}</td>
                <td>${escH(t.roll_no || "-")}</td>
                ${showRoll ? `<td style="text-align:right;font-weight:700">${t.roll || "-"}</td>` : ""}
                ${showPcs ? `<td style="text-align:right;font-weight:700">${t.pcs || "-"}</td>` : ""}
                ${showNote ? `<td>${escH(t.note || "-")}</td>` : ""}
              </tr>`).join("");
              const footSpan = cols.length - (showRoll ? 1 : 0) - (showPcs ? 1 : 0) - (showNote ? 1 : 0);
              const foot = `<tfoot><tr><td colspan="${footSpan}" style="text-align:right">TOTAL</td>${showRoll ? `<td style="text-align:right">${totRoll}</td>` : ""}${showPcs ? `<td style="text-align:right">${totPcs}</td>` : ""}${showNote ? `<td></td>` : ""}</tr></tfoot>`;
              return `<div class="det-sec">
                <div class="det-hd" style="background:${grad}">${icon} ${title} <span class="pill">${list.length} entries · ${showRoll ? totRoll + " roll" : ""}${showRoll && showPcs ? " · " : ""}${showPcs ? totPcs + " pcs" : ""}</span></div>
                <table class="det-tbl">
                  <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
                  <tbody>${body}</tbody>
                  ${foot}
                </table>
              </div>`;
            };
            const recvTxns = txns.filter((t) => t.type === "sticker_receive").sort((a, b) => b.date.localeCompare(a.date));
            const issTxns = txns.filter((t) => t.type === "sticker_issue").sort((a, b) => b.date.localeCompare(a.date));
            const dmgTxns = txns.filter((t) => t.type === "sticker_damage").sort((a, b) => b.date.localeCompare(a.date));
            const detailsHtml = `
              <div class="det-wrap">
                <h2 class="det-title">🏷️ Sticker Transaction Details</h2>
                ${detailSection("Sticker Received Details", "⬇", recvTxns, "linear-gradient(90deg,#059669,#10b981)", true, true, false)}
                ${detailSection("Sticker Issue Details", "⬆", issTxns, "linear-gradient(90deg,#ea580c,#f97316)", true, true, false)}
                ${detailSection("Sticker Damage Details", "⚠", dmgTxns, "linear-gradient(90deg,#dc2626,#f43f5e)", true, false, true)}
              </div>`;
            w.document.write(`<html><head><title>Buyers Full Details</title>${mnrPrintStyles}<style>
              table{width:100%;border-collapse:separate;border-spacing:0;font-size:11px;margin-top:6px}
              th,td{border:1px solid #d1d5db;padding:6px 7px;text-align:left;vertical-align:middle}
              th{background:#4f46e5;color:#fff;text-align:center;font-weight:700;letter-spacing:.3px}
              .grp-stk{background:#eef2ff;color:#4f46e5;text-align:center;font-weight:700}
              .grp-rbn{background:#fce7f3;color:#be185d;text-align:center;font-weight:700}
              tbody tr:nth-child(even) td{background:#fafafa}
              td.num{text-align:center;font-weight:700;font-size:12px;line-height:1.15}
              td.num .sub{display:block;font-size:9px;font-weight:500;color:#6b7280;margin-top:1px}
              td.recv{color:#059669;background:#f0fdf4 !important}
              td.stock{color:#4f46e5;background:#eef2ff !important}
              td.iss{color:#ea580c;background:#fff7ed !important}
              td.dmg{color:#dc2626;background:#fef2f2 !important}
              td.rrecv{color:#db2777;background:#fdf2f8 !important}
              td.rstock{color:#be185d;background:#fce7f3 !important}
              td.riss{color:#e11d48;background:#fff1f2 !important}
              tr.tot td{background:#111827 !important;color:#fff;font-weight:800;font-size:12px}
              tr.tot td.num .sub{color:#d1d5db}
              .det-wrap{margin-top:18px;page-break-before:auto}
              .det-title{font-size:16px;color:#111827;margin:14px 0 10px;padding-bottom:6px;border-bottom:2px solid #4f46e5}
              .det-sec{margin-bottom:14px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid}
              .det-hd{color:#fff;padding:8px 12px;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:8px}
              .det-hd .pill{background:rgba(255,255,255,.25);padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600}
              .det-tbl{margin:0;font-size:10.5px}
              .det-tbl th{background:#f3f4f6;color:#111;font-weight:700;text-align:left}
              .det-tbl tfoot td{background:#f9fafb !important;font-weight:800;color:#111}
              .empty{padding:14px;text-align:center;color:#9ca3af;font-size:11px;background:#fafafa}
            </style></head><body>${mnrPrintHead(subtitle)}
              <table>
                <thead>
                  <tr>
                    <th rowspan="2" style="width:28px">#</th>
                    <th rowspan="2">Buyer</th>
                    <th rowspan="2">Merchandiser</th>
                    <th rowspan="2">GPQ</th>
                    <th rowspan="2">Store Officer</th>
                    <th colspan="4" class="grp-stk">Sticker</th>
                    <th colspan="3" class="grp-rbn">Ribbon (Roll)</th>
                  </tr>
                  <tr>
                    <th style="background:#059669">Receive</th>
                    <th style="background:#4f46e5">Stock</th>
                    <th style="background:#ea580c">Issue</th>
                    <th style="background:#dc2626">Damage</th>
                    <th style="background:#db2777">Receive</th>
                    <th style="background:#be185d">Stock</th>
                    <th style="background:#e11d48">Issue</th>
                  </tr>
                </thead>
                <tbody>${rows}${totalsRow}</tbody>
              </table>
              ${detailsHtml}
              ${mnrPrintFooter}${mnrPrintScript}</body></html>`);
            w.document.close();
          }} className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Edit Buyer" : "Add Buyer"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Buyer Name *</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} /></div>
                <div><Label>Merchandiser Name</Label><Input value={form.merchandiser_name} onChange={(e) => setForm({ ...form, merchandiser_name: e.target.value })} /></div>
                <div><Label>Merchandiser Phone</Label><Input value={form.merchandiser_phone} onChange={(e) => setForm({ ...form, merchandiser_phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>Merchandiser Email</Label><Input type="email" value={form.merchandiser_email || ""} onChange={(e) => setForm({ ...form, merchandiser_email: e.target.value })} /></div>
                <div><Label>Gpq Name</Label><Input value={form.gpq_name} onChange={(e) => setForm({ ...form, gpq_name: e.target.value })} /></div>
                <div><Label>Gpq Phone</Label><Input value={form.gpq_phone} onChange={(e) => setForm({ ...form, gpq_phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>Gpq Email</Label><Input type="email" value={form.gpq_email || ""} onChange={(e) => setForm({ ...form, gpq_email: e.target.value })} /></div>
                <div><Label>Store Officer Name</Label><Input value={form.store_officer_name || ""} onChange={(e) => setForm({ ...form, store_officer_name: e.target.value })} /></div>
                <div><Label>Store Officer Number</Label><Input value={form.store_officer_phone || ""} onChange={(e) => setForm({ ...form, store_officer_phone: e.target.value })} /></div>
                <div className="col-span-2"><Label>Store Officer Email</Label><Input type="email" value={form.store_officer_email || ""} onChange={(e) => setForm({ ...form, store_officer_email: e.target.value })} /></div>
                <div className="col-span-2">
                  <Label>Buyer Logo (Optional)</Label>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                  {form.logo && <img src={form.logo} alt="preview" className="mt-2 h-16 w-16 object-contain rounded border" />}
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
                  <div><Label>Status</Label><p className="text-xs text-muted-foreground">{form.status}</p></div>
                  <Switch checked={form.status === "Active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "Active" : "Inactive" })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} className="bg-gradient-to-r from-indigo-500 to-purple-600">{editingId ? "Update" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <PermGate action="recv" path="/sticker-printer">
            <Button onClick={() => openRecv("sticker")} className="bg-gradient-to-r from-green-500 to-emerald-600">
              <ArrowDownCircle className="w-4 h-4 mr-1" /> Sticker Recv
            </Button>
          </PermGate>
          <PermGate action="recv" path="/sticker-printer">
            <Button onClick={() => openRecv("ribbon")} className="bg-gradient-to-r from-pink-500 to-rose-600">
              <ArrowDownCircle className="w-4 h-4 mr-1" /> Ribbon Recv
            </Button>
          </PermGate>
          <PermGate action="issue" path="/sticker-printer">
            <Button onClick={() => openRibbonIssue()} className="bg-gradient-to-r from-orange-500 to-red-500">
              <ArrowUpCircle className="w-4 h-4 mr-1" /> Ribbon Issue
            </Button>
          </PermGate>
        </div>
      </div>

      <Dialog open={!!recvDialog} onOpenChange={(o) => !o && setRecvDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{recvDialog === "sticker" ? "Sticker Receive" : "Ribbon Receive"}</DialogTitle>
          </DialogHeader>
          {(() => {
            const selBuyer = buyers.find((b) => b.id === recvForm.buyer_id);
            const rollNum = parseFloat(recvForm.roll) || 0;
            const pprNum = parseFloat(recvForm.pcs_per_roll) || 0;
            const totalPcs = rollNum * pprNum;
            const isSticker = recvDialog === "sticker";
            const autoRibbonSi = !isSticker
              ? String(txns.filter((t) => t.type === "ribbon_receive").length + 1)
              : "";
            return (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Receive Date</Label>
                  <Input type="date" value={recvForm.receive_date} onChange={(e) => setRecvForm({ ...recvForm, receive_date: e.target.value })} />
                </div>
                {isSticker && (() => {
                  const nextSl = txns.filter((t) => t.buyer_id === recvForm.buyer_id && t.type === "sticker_receive").length + 1;
                  return (
                    <div>
                      <Label>Sl (auto / custom)</Label>
                      <Input value={recvForm.sl_no} onChange={(e) => setRecvForm({ ...recvForm, sl_no: e.target.value })} placeholder={String(nextSl)} />
                    </div>
                  );
                })()}
                {!isSticker && (
                  <div>
                    <Label>SI</Label>
                    <Input value={recvForm.si_number || autoRibbonSi} readOnly className="bg-muted font-semibold" />
                  </div>
                )}
                {isSticker && (<div>
                  <Label>Buyer Name *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={recvForm.buyer_id}
                    onChange={(e) => setRecvForm({ ...recvForm, buyer_id: e.target.value })}
                  >
                    <option value="">-- Select Buyer --</option>
                    {buyers.filter((b) => b.status === "Active").map((b) => (
                      <option key={b.id} value={b.id}>{b.buyer_name}</option>
                    ))}
                  </select>
                </div>)}
                {isSticker && (
                  <>
                    <div><Label>Merchandiser Name</Label><Input value={selBuyer?.merchandiser_name || ""} readOnly className="bg-muted" /></div>
                    <div><Label>Gpq Name</Label><Input value={selBuyer?.gpq_name || ""} readOnly className="bg-muted" /></div>
                    <div className="col-span-2"><Label>Store Officer Name</Label><Input value={selBuyer?.store_officer_name || ""} readOnly className="bg-muted" /></div>
                    <div><Label>Delivered By</Label><Input value={recvForm.delivered_by} onChange={(e) => setRecvForm({ ...recvForm, delivered_by: e.target.value })} /></div>
                    <div><Label>Designation</Label><Input value={recvForm.designation} onChange={(e) => setRecvForm({ ...recvForm, designation: e.target.value })} /></div>
                    <div><Label>Phone Number</Label><Input value={recvForm.phone} onChange={(e) => setRecvForm({ ...recvForm, phone: e.target.value })} /></div>
                    <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
                      <Label className="mb-2 block">Sticker Size</Label>
                      {(() => {
                        const m = (recvForm.sticker_size || "").match(/^\s*([\d.]*)\s*[x×]\s*([\d.]*)\s*(mm|inch)?\s*$/i);
                        const w = m ? m[1] : "";
                        const h = m ? m[2] : "";
                        const unit = stickerSizeUnit;
                        const build = (nw: string, nh: string, nu: string) => (nw || nh) ? `${nw}×${nh}${nu && nu !== "wh" ? " " + nu : ""}` : "";
                        return (
                          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:grid-cols-[8rem_1fr_auto_1fr] sm:items-end">
                            <div className="col-span-3 sm:col-span-1">
                              <Label className="text-xs text-muted-foreground">Unit</Label>
                              <Select value={unit} onValueChange={(v: "mm" | "inch" | "wh") => { setStickerSizeUnit(v); setRecvForm({ ...recvForm, sticker_size: build(w, h, v) }); }}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mm">mm</SelectItem>
                                  <SelectItem value="inch">inch</SelectItem>
                                  <SelectItem value="wh">W×H</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Width</Label>
                              <Input type="number" placeholder="Width" value={w} onChange={(e) => setRecvForm({ ...recvForm, sticker_size: build(e.target.value, h, unit) })} />
                            </div>
                            <span className="pb-2 text-center text-lg font-semibold text-muted-foreground">×</span>
                            <div>
                              <Label className="text-xs text-muted-foreground">Height</Label>
                              <Input type="number" placeholder="Height" value={h} onChange={(e) => setRecvForm({ ...recvForm, sticker_size: build(w, e.target.value, unit) })} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div><Label>Receive Roll Qty</Label><Input type="number" value={recvForm.roll} onChange={(e) => setRecvForm({ ...recvForm, roll: e.target.value })} /></div>
                    <div><Label>Pcs Per Roll</Label><Input type="number" value={recvForm.pcs_per_roll} onChange={(e) => setRecvForm({ ...recvForm, pcs_per_roll: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label>Total Pcs (Auto)</Label><Input value={totalPcs || ""} readOnly className="bg-muted font-semibold" /></div>
                  </>
                )}
                {!isSticker && (
                  <>
                    <div><Label>Receive Roll Qty</Label><Input type="number" value={recvForm.roll} onChange={(e) => setRecvForm({ ...recvForm, roll: e.target.value })} /></div>
                    <div><Label>Length Per Roll</Label><Input type="number" value={recvForm.length_per_roll} onChange={(e) => setRecvForm({ ...recvForm, length_per_roll: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label>Total Length (Auto)</Label><Input value={((parseFloat(recvForm.roll) || 0) * (parseFloat(recvForm.length_per_roll) || 0)) || ""} readOnly className="bg-muted font-semibold" /></div>
                  </>
                )}
                <div className="sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={recvForm.note} onChange={(e) => setRecvForm({ ...recvForm, note: e.target.value })} /></div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecvDialog(null)}>Cancel</Button>
            <Button disabled={saving} onClick={saveRecv} className={`bg-gradient-to-r ${recvDialog === "sticker" ? "from-green-500 to-emerald-600" : "from-pink-500 to-rose-600"}`}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <DashboardView buyers={buyers} txns={txns} totals={globalTotals} onOpenBuyer={setSelectedBuyerId} />

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Buyers</h2>
          {filteredBuyers.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <Sticker className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No buyers yet. Click "Add Buyer" to create one.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBuyers.map((b, i) => {
                const bt = buyerTotals(txns.filter((t) => t.buyer_id === b.id || t.type === "ribbon_receive" || t.type === "ribbon_issue"));
                const lowStock = bt.stickerRoll <= LOW_STOCK_ROLL || bt.ribbonRoll <= LOW_STOCK_ROLL;
                const palettes = [
                  { grad: "from-indigo-500 via-purple-500 to-pink-500", head: "from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40", glow: "hover:shadow-purple-300/40" },
                  { grad: "from-emerald-500 via-teal-500 to-cyan-500", head: "from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-cyan-950/40", glow: "hover:shadow-emerald-300/40" },
                  { grad: "from-amber-500 via-orange-500 to-rose-500", head: "from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-rose-950/40", glow: "hover:shadow-orange-300/40" },
                  { grad: "from-sky-500 via-blue-500 to-indigo-500", head: "from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-indigo-950/40", glow: "hover:shadow-blue-300/40" },
                  { grad: "from-fuchsia-500 via-pink-500 to-rose-500", head: "from-fuchsia-50 via-pink-50 to-rose-50 dark:from-fuchsia-950/40 dark:via-pink-950/40 dark:to-rose-950/40", glow: "hover:shadow-pink-300/40" },
                ];
                const p = lowStock
                  ? { grad: "from-red-500 via-rose-500 to-orange-500", head: "from-red-50 via-rose-50 to-orange-50 dark:from-red-950/40 dark:via-rose-950/40 dark:to-orange-950/40", glow: "hover:shadow-red-300/50" }
                  : palettes[i % palettes.length];
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBuyerId(b.id)}
                    className={`group relative cursor-pointer rounded-xl p-px bg-gradient-to-br ${p.grad} shadow-md hover:shadow-2xl ${p.glow} hover:-translate-y-1 transition-all duration-300`}
                  >
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${p.grad} opacity-0 group-hover:opacity-60 blur-lg -z-10 transition-opacity`} />
                    <Card onClick={() => setSelectedBuyerId(b.id)} className="rounded-[10px] overflow-hidden border-0 bg-card cursor-pointer">
                    <div className={`h-1.5 bg-gradient-to-r ${p.grad}`} />
                    <CardHeader className={`bg-gradient-to-br ${p.head} pb-3`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {b.logo ? (
                            <img src={b.logo} alt={b.buyer_name} className={`h-12 w-12 rounded-lg object-contain bg-white p-0.5 ring-2 ring-offset-1 ring-transparent bg-gradient-to-br ${p.grad}`} style={{ padding: 2 }} />
                          ) : (
                            <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${p.grad} text-white flex items-center justify-center font-bold text-lg shadow-md`}>
                              {b.buyer_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">{b.buyer_name}</CardTitle>
                            <Badge variant={b.status === "Active" ? "default" : "secondary"} className="mt-1 text-[10px]">{b.status}</Badge>
                          </div>
                        </div>
                         <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                           <AlertDialog>
                             <DropdownMenu>
                               <DropdownMenuTrigger asChild>
                                 <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                               </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <PermGate action="edit" path="/sticker-printer">
                                   <DropdownMenuItem onClick={() => openEdit(b)}>
                                     <Pencil className="w-4 h-4 mr-2" /> Edit
                                   </DropdownMenuItem>
                                 </PermGate>
                                 <PermGate action="delete" path="/sticker-printer">
                                   <AlertDialogTrigger asChild>
                                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                       <Trash2 className="w-4 h-4 mr-2" /> Delete
                                     </DropdownMenuItem>
                                   </AlertDialogTrigger>
                                 </PermGate>
                               </DropdownMenuContent>
                             </DropdownMenu>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Buyer?</AlertDialogTitle>
                                <AlertDialogDescription>Delete "{b.buyer_name}" and all related transactions?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(b.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2 text-sm" onClick={() => setSelectedBuyerId(b.id)}>
                      {(() => {
                        const readyMsg = `your print ready please come to IT room and take it`;
                        const subj = encodeURIComponent(`Print Page Ready — ${b.buyer_name}`);
                        const body = encodeURIComponent(readyMsg);
                        const wa = (p: string) => `https://wa.me/${p.replace(/\D/g,"")}?text=${encodeURIComponent(readyMsg)}`;
                        const ml = (e: string) => `mailto:${e}?subject=${subj}&body=${body}`;
                        return (<>
                          {b.merchandiser_name && (<div className="flex items-center gap-2"><User className="w-4 h-4 text-indigo-500 shrink-0" /><span className="text-muted-foreground">Mr:</span><span className="font-medium truncate flex-1">{b.merchandiser_name}</span>{canContact && b.merchandiser_phone && (<a href={wa(b.merchandiser_phone)} target="_blank" rel="noreferrer" title={`WhatsApp ${b.merchandiser_phone}`} onClick={(e) => e.stopPropagation()}><MessageCircle className="w-4 h-4 text-green-600 hover:text-green-700" /></a>)}{canContact && b.merchandiser_email && (<a href={ml(b.merchandiser_email)} title={`Email ${b.merchandiser_email}`} onClick={(e) => e.stopPropagation()}><Mail className="w-4 h-4 text-blue-600 hover:text-blue-700" /></a>)}</div>)}
                          {b.gpq_name && (<div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-500 shrink-0" /><span className="text-muted-foreground">Gpq:</span><span className="font-medium truncate flex-1">{b.gpq_name}</span>{canContact && b.gpq_phone && (<a href={wa(b.gpq_phone)} target="_blank" rel="noreferrer" title={`WhatsApp ${b.gpq_phone}`} onClick={(e) => e.stopPropagation()}><MessageCircle className="w-4 h-4 text-green-600 hover:text-green-700" /></a>)}{canContact && b.gpq_email && (<a href={ml(b.gpq_email)} title={`Email ${b.gpq_email}`} onClick={(e) => e.stopPropagation()}><Mail className="w-4 h-4 text-blue-600 hover:text-blue-700" /></a>)}</div>)}
                          {b.store_officer_name && (<div className="flex items-center gap-2"><UserCheck className="w-4 h-4 text-teal-500 shrink-0" /><span className="text-muted-foreground">So:</span><span className="font-medium truncate flex-1">{b.store_officer_name}</span>{canContact && b.store_officer_phone && (<a href={wa(b.store_officer_phone)} target="_blank" rel="noreferrer" title={`WhatsApp ${b.store_officer_phone}`} onClick={(e) => e.stopPropagation()}><MessageCircle className="w-4 h-4 text-green-600 hover:text-green-700" /></a>)}{canContact && b.store_officer_email && (<a href={ml(b.store_officer_email)} title={`Email ${b.store_officer_email}`} onClick={(e) => e.stopPropagation()}><Mail className="w-4 h-4 text-blue-600 hover:text-blue-700" /></a>)}</div>)}
                        </>);
                      })()}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                        <StatMini label="Stk Roll" value={bt.stickerRoll} color="text-indigo-600" />
                        <StatMini label="Stk Pcs" value={bt.stickerPcs} color="text-purple-600" />
                        <StatMini label="Rbn Roll" value={bt.ribbonRoll} color="text-pink-600" />
                      </div>
                    </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
      {ribbonIssueDialogEl}
    </div>
  );
};

type CropTool = { path: string; title: string; badge: string; desc: string; icon: React.ComponentType<{ className?: string }>; gradient: string; headerBg: string; shadow: string };
const CROP_TOOLS: CropTool[] = [
  { path: "/sticker-printer/crop", title: "Crop", badge: "Batch Tool", desc: "Upload PDF/images, set 3 crop zones, batch export as ZIP.", icon: Scissors, gradient: "from-emerald-500 via-teal-500 to-cyan-500", headerBg: "from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-cyan-950/40", shadow: "hover:shadow-emerald-300/40" },
  { path: "/sticker-printer/barcode-reader", title: "Barcode Reader", badge: "Scan Tool", desc: "Scan barcodes with camera or upload an image to decode.", icon: ScanBarcode, gradient: "from-indigo-500 via-purple-500 to-fuchsia-500", headerBg: "from-indigo-50 via-purple-50 to-fuchsia-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-fuchsia-950/40", shadow: "hover:shadow-indigo-300/40" },
  { path: "/sticker-printer/pdf-edit", title: "PDF Edit", badge: "Edit Tool", desc: "Reorder, rotate, delete pages, split by ranges, or merge PDFs.", icon: FileEdit, gradient: "from-rose-500 via-pink-500 to-orange-500", headerBg: "from-rose-50 via-pink-50 to-orange-50 dark:from-rose-950/40 dark:via-pink-950/40 dark:to-orange-950/40", shadow: "hover:shadow-rose-300/40" },
  { path: "/sticker-printer/image-editor", title: "Image Editor", badge: "Edit Tool", desc: "Crop, resize, rotate, flip, adjust colors, filters, watermark, convert format.", icon: ImageIcon, gradient: "from-amber-500 via-orange-500 to-yellow-500", headerBg: "from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-yellow-950/40", shadow: "hover:shadow-amber-300/40" },
  { path: "/sticker-printer/ocr", title: "OCR", badge: "Text Recognition", desc: "Image or scanned PDF → editable text, searchable PDF, multi-language.", icon: ScanText, gradient: "from-cyan-500 via-sky-500 to-blue-500", headerBg: "from-cyan-50 via-sky-50 to-blue-50 dark:from-cyan-950/40 dark:via-sky-950/40 dark:to-blue-950/40", shadow: "hover:shadow-cyan-300/40" },
  { path: "/sticker-printer/pdf-annotate", title: "PDF Annotate", badge: "Draw Tool", desc: "Freehand, shapes, arrows, text, sticky notes, signature — burned into PDF.", icon: Edit3, gradient: "from-violet-500 via-purple-500 to-indigo-500", headerBg: "from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/40 dark:via-purple-950/40 dark:to-indigo-950/40", shadow: "hover:shadow-violet-300/40" },
  { path: "/sticker-printer/pdf-viewer", title: "PDF Viewer", badge: "Read Tool", desc: "Continuous scrolling with zoom, page counter, and go-to-page.", icon: BookOpen, gradient: "from-teal-500 via-emerald-500 to-green-500", headerBg: "from-teal-50 via-emerald-50 to-green-50 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-green-950/40", shadow: "hover:shadow-teal-300/40" },
  { path: "/sticker-printer/barcode-qr", title: "Barcode & QR Tools", badge: "Generate · Extract", desc: "Generate barcodes/QR codes, extract & search codes inside PDFs, batch export.", icon: QrCode, gradient: "from-pink-500 via-rose-500 to-red-500", headerBg: "from-pink-50 via-rose-50 to-red-50 dark:from-pink-950/40 dark:via-rose-950/40 dark:to-red-950/40", shadow: "hover:shadow-pink-300/40" },
  { path: "/sticker-printer/pdf-tools", title: "PDF Advanced Tools", badge: "Form · Sign · Redact", desc: "Form fill, create fillable, signature, redaction, bookmarks, hyperlinks, search-replace, compare.", icon: FileSignature, gradient: "from-fuchsia-500 via-purple-500 to-indigo-500", headerBg: "from-fuchsia-50 via-purple-50 to-indigo-50 dark:from-fuchsia-950/40 dark:via-purple-950/40 dark:to-indigo-950/40", shadow: "hover:shadow-fuchsia-300/40" },
];

const CropToolsGrid = ({ navigate }: { navigate: (path: string) => void }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {CROP_TOOLS.map((t) => {
      const Icon = t.icon;
      return (
        <div
          key={t.path}
          role="button"
          tabIndex={0}
          onClick={() => navigate(t.path)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(t.path); } }}
          className={`group relative cursor-pointer rounded-xl p-px bg-gradient-to-br ${t.gradient} shadow-md hover:shadow-2xl ${t.shadow} hover:-translate-y-1 transition-all duration-300`}
        >
          <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${t.gradient} opacity-0 group-hover:opacity-60 blur-lg -z-10 transition-opacity`} />
          <Card className="rounded-[10px] overflow-hidden border-0 bg-card">
            <div className={`h-1.5 bg-gradient-to-r ${t.gradient}`} />
            <CardHeader className={`bg-gradient-to-br ${t.headerBg} pb-3`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${t.gradient} text-white flex items-center justify-center shadow-md`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{t.title}</CardTitle>
                  <Badge variant="secondary" className="mt-1 text-[10px]">{t.badge}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 text-sm text-muted-foreground">{t.desc}</CardContent>
          </Card>
        </div>
      );
    })}
  </div>
);

const StatMini = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="text-center">
    <p className={`text-lg font-bold ${color}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

// ================= Dashboard =================

const DashboardView = ({ buyers, txns, totals, onOpenBuyer }: {
  buyers: Buyer[]; txns: Txn[];
  totals: ReturnType<typeof buyerTotals>;
  onOpenBuyer: (id: string) => void;
}) => {
  const lowStockBuyers = buyers
    .map((b) => ({ b, t: buyerTotals(txns.filter((t) => t.buyer_id === b.id)) }))
    .filter(({ t }) => t.stickerRoll <= LOW_STOCK_ROLL || t.ribbonRoll <= LOW_STOCK_ROLL);

  const [ribbonDetail, setRibbonDetail] = useState<null | "recv" | "iss" | "stock">(null);
  const [stickerDetail, setStickerDetail] = useState<null | "recv" | "stock" | "iss" | "dmg">(null);
  const [stickerQuery, setStickerQuery] = useState("");
  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.buyer_name || (id === "__global_ribbon__" ? "— Global —" : "—");
  const ribbonRecvTxns = txns.filter((t) => t.type === "ribbon_receive").slice().sort((a, b) => b.date.localeCompare(a.date));
  const ribbonIssTxns = txns.filter((t) => t.type === "ribbon_issue").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stickerRecvTxns = txns.filter((t) => t.type === "sticker_receive").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stickerIssTxns = txns.filter((t) => t.type === "sticker_issue").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stickerDmgTxns = txns.filter((t) => t.type === "sticker_damage").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stickerStockRows = stickerRecvTxns.map((r) => {
    const key = (r.roll_no || "").trim();
    const related = (t: Txn) => t.source_receive_id === r.id || (!t.source_receive_id && !!key && (t.roll_no || "").trim() === key);
    const iss = txns.filter((t) => t.type === "sticker_issue" && related(t)).reduce((s, t) => s + (t.pcs || 0), 0);
    const dmg = txns.filter((t) => t.type === "sticker_damage" && related(t)).reduce((s, t) => s + (t.pcs || 0), 0);
    return { r, iss, dmg, bal: (r.pcs || 0) - iss - dmg };
  });
  const qMatch = (fields: (string | undefined)[]) => {
    const q = stickerQuery.trim().toLowerCase();
    if (!q) return true;
    return fields.some((f) => (f || "").toLowerCase().includes(q));
  };
  const stickerDetailTitle = stickerDetail === "recv" ? "Sticker Receive Details"
    : stickerDetail === "stock" ? "Sticker Stock — Roll Balance"
    : stickerDetail === "iss" ? "Sticker Issue Details"
    : stickerDetail === "dmg" ? "Sticker Damage Details" : "";
  const printDialog = () => {
    const el = document.getElementById("sticker-detail-print");
    if (!el) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>${stickerDetailTitle}</title>${mnrPrintStyles}<style>table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#4f46e5;color:#fff}</style></head><body>${mnrPrintHead(stickerDetailTitle)}${el.innerHTML}${mnrPrintFooter}${mnrPrintScript}</body></html>`);
    w.document.close();
    w.focus();
  };
  const detailTitle = ribbonDetail === "recv" ? "Ribbon Receive Details"
    : ribbonDetail === "iss" ? "Ribbon Issue Details"
    : "Ribbon Stock — Roll Balance";
  const detailRows: Txn[] = ribbonDetail === "recv" ? ribbonRecvTxns
    : ribbonDetail === "iss" ? ribbonIssTxns
    : ribbonRecvTxns;

  return (
    <div className="space-y-6">
      {/* Sticker */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Sticker className="w-5 h-5 text-indigo-500" /> Sticker</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div onClick={() => { setStickerDetail("recv"); setStickerQuery(""); }} style={{ borderColor: "#22c55e", color: "#16a34a" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Received</p>
                <p className="text-2xl font-bold leading-tight">{totals.stickerRollRecv} <span className="text-sm opacity-80">Roll</span></p>
                <p className="text-lg font-semibold leading-tight">{totals.stickerPcsRecv} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <ArrowDownCircle className="w-8 h-8 opacity-80" />
            </div>
          </div>
          <div onClick={() => { setStickerDetail("stock"); setStickerQuery(""); }} style={{ borderColor: "#6366f1", color: "#4f46e5" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Stock</p>
                <p className="text-2xl font-bold leading-tight">{totals.stickerRoll} <span className="text-sm opacity-80">Roll</span></p>
                <p className="text-lg font-semibold leading-tight">{totals.stickerPcs} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <Package className="w-8 h-8 opacity-80" />
            </div>
          </div>
          <div onClick={() => { setStickerDetail("iss"); setStickerQuery(""); }} style={{ borderColor: "#f97316", color: "#ea580c" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Issued</p>
                <p className="text-2xl font-bold leading-tight">{totals.stickerRollIss} <span className="text-sm opacity-80">Roll</span></p>
                <p className="text-lg font-semibold leading-tight">{totals.stickerPcsIss} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <ArrowUpCircle className="w-8 h-8 opacity-80" />
            </div>
          </div>
          <StockStat label="Damage Pcs" value={totals.stickerPcsDmg} icon={AlertTriangle} color="from-red-500 to-rose-600" onClick={() => { setStickerDetail("dmg"); setStickerQuery(""); }} />
        </div>
        <Dialog open={!!stickerDetail} onOpenChange={(o) => !o && setStickerDetail(null)}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Sticker className="w-5 h-5 text-indigo-600" /> {stickerDetailTitle}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Input placeholder="Search by roll no, buyer, Po, style or note..." value={stickerQuery} onChange={(e) => setStickerQuery(e.target.value)} className="flex-1" />
              <Button variant="outline" size="sm" onClick={printDialog} className="hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-700 dark:hover:text-indigo-200"><Printer className="w-4 h-4 mr-1" /> Print</Button>
            </div>
            <div id="sticker-detail-print" className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 stock-table-wrap">
              {stickerDetail === "recv" && (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Roll</TableHead><TableHead className="text-right">Pcs</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stickerRecvTxns.filter((t) => qMatch([t.roll_no, t.po_no, t.style, t.note, buyerName(t.buyer_id)])).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-medium">{buyerName(t.buyer_id)}</TableCell>
                        <TableCell className="text-right font-semibold text-indigo-700">{t.roll || 0}</TableCell>
                        <TableCell className="text-right font-semibold">{t.pcs || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {stickerDetail === "stock" && (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Recv Pcs</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Damage</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stickerStockRows.filter(({ r }) => qMatch([r.roll_no, r.po_no, r.style, r.note, buyerName(r.buyer_id)])).map(({ r, iss, dmg, bal }) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.date).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-medium">{buyerName(r.buyer_id)}</TableCell>
                        <TableCell className="text-right font-semibold text-indigo-700">{r.pcs || 0}</TableCell>
                        <TableCell className="text-right text-orange-600">{iss}</TableCell>
                        <TableCell className="text-right text-red-600">{dmg}</TableCell>
                        <TableCell className={`text-right font-bold ${bal <= 0 ? "text-muted-foreground" : "text-indigo-600"}`}>{bal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {stickerDetail === "iss" && (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Buyer</TableHead><TableHead>Po</TableHead><TableHead>Style</TableHead><TableHead className="text-right">Roll</TableHead><TableHead className="text-right">Pcs</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stickerIssTxns.filter((t) => qMatch([t.roll_no, t.po_no, t.style, t.note, buyerName(t.buyer_id)])).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-medium">{buyerName(t.buyer_id)}</TableCell>
                        <TableCell className="text-xs">{t.po_no || "-"}</TableCell>
                        <TableCell className="text-xs">{t.style || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{t.roll || 0}</TableCell>
                        <TableCell className="text-right font-semibold text-orange-600">{t.pcs || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {stickerDetail === "dmg" && (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Pcs</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {stickerDmgTxns.filter((t) => qMatch([t.roll_no, t.po_no, t.style, t.note, buyerName(t.buyer_id)])).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-medium">{buyerName(t.buyer_id)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{t.pcs || 0}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ribbon */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package className="w-5 h-5 text-pink-500" /> Ribbon</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StockStat label="Total Ribbon Roll Received" value={totals.ribbonRollRecv} icon={ArrowDownCircle} color="from-pink-500 to-rose-600" onClick={() => setRibbonDetail("recv")} />
          <StockStat label="Total Ribbon Roll Stock" value={totals.ribbonRoll} icon={Package} color="from-fuchsia-500 to-pink-600" onClick={() => setRibbonDetail("stock")} />
          <StockStat label="Total Ribbon Roll Issue" value={totals.ribbonRollIss} icon={ArrowUpCircle} color="from-orange-500 to-red-500" onClick={() => setRibbonDetail("iss")} />
        </div>
        <Dialog open={!!ribbonDetail} onOpenChange={(o) => !o && setRibbonDetail(null)}>
          <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-3 sm:p-6">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-pink-600" /> {detailTitle}</DialogTitle></DialogHeader>
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 stock-table-wrap">
            {ribbonDetail === "stock" ? (
              <Table>
                <TableHeader><TableRow><TableHead>Sl</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Recv Roll</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ribbonRecvTxns.map((r) => {
                    const key = (r.roll_no || "").trim();
                    const iss = txns.filter((t) => t.type === "ribbon_issue" && (t.source_receive_id === r.id || (!t.source_receive_id && !!key && (t.roll_no || "").trim() === key))).reduce((s, t) => s + (t.roll || 0), 0);
                    const bal = (r.roll || 0) - iss;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>{r.sl_no || "-"}</TableCell>
                        <TableCell className="text-xs">{new Date(r.date).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-indigo-700">{r.roll || 0}</TableCell>
                        <TableCell className="text-right text-orange-600">{iss}</TableCell>
                        <TableCell className={`text-right font-bold ${bal <= 0 ? "text-muted-foreground" : "text-pink-600"}`}>{bal}</TableCell>
                      </TableRow>
                    );
                  })}
                  {ribbonRecvTxns.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No ribbon receives</TableCell></TableRow>}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Sl</TableHead><TableHead>Date</TableHead>{ribbonDetail === "iss" && <TableHead>Buyer</TableHead>}<TableHead className="text-right">Roll</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detailRows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.sl_no || "-"}</TableCell>
                      <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                      {ribbonDetail === "iss" && <TableCell className="text-xs font-medium">{buyerName(t.buyer_id)}</TableCell>}
                      <TableCell className="text-right font-semibold">{t.roll || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {detailRows.length === 0 && <TableRow><TableCell colSpan={ribbonDetail === "iss" ? 5 : 4} className="text-center text-muted-foreground">No entries</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buyers */}
    </div>
  );
};

// ================= Reports =================

const ReportsView = ({ buyers, txns }: { buyers: Buyer[]; txns: Txn[] }) => {
  const [rep, setRep] = useState("buyer_recv");
  const buyerName = (id: string) => buyers.find((b) => b.id === id)?.buyer_name || "-";

  const buyerReceive = buyers.map((b) => {
    const list = txns.filter((t) => t.buyer_id === b.id && t.type === "sticker_receive");
    return { name: b.buyer_name, roll: list.reduce((s, t) => s + t.roll, 0), pcs: list.reduce((s, t) => s + t.pcs, 0) };
  });
  const buyerIssue = buyers.map((b) => {
    const list = txns.filter((t) => t.buyer_id === b.id && t.type === "sticker_issue");
    return { name: b.buyer_name, roll: list.reduce((s, t) => s + t.roll, 0), pcs: list.reduce((s, t) => s + t.pcs, 0) };
  });

  const groupBy = (key: "po_no" | "style" | "roll_no") => {
    const map = new Map<string, { recv: number; iss: number; dmg: number }>();
    for (const t of txns) {
      const k = (t[key] || "").trim(); if (!k) continue;
      const cur = map.get(k) || { recv: 0, iss: 0, dmg: 0 };
      if (t.type === "sticker_receive") cur.recv += t.pcs;
      else if (t.type === "sticker_issue") cur.iss += t.pcs;
      else if (t.type === "sticker_damage") cur.dmg += t.pcs;
      map.set(k, cur);
    }
    return Array.from(map.entries()).map(([k, v]) => ({ key: k, ...v }));
  };

  const daily = () => {
    const map = new Map<string, { recv: number; iss: number; dmg: number }>();
    for (const t of txns) {
      const d = t.date.slice(0, 10);
      const cur = map.get(d) || { recv: 0, iss: 0, dmg: 0 };
      if (t.type === "sticker_receive") cur.recv += t.pcs;
      else if (t.type === "sticker_issue") cur.iss += t.pcs;
      else if (t.type === "sticker_damage") cur.dmg += t.pcs;
      map.set(d, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([d, v]) => ({ key: d, ...v }));
  };

  const monthly = () => {
    const map = new Map<string, { recv: number; iss: number; dmg: number }>();
    for (const t of txns) {
      const d = t.date.slice(0, 7);
      const cur = map.get(d) || { recv: 0, iss: 0, dmg: 0 };
      if (t.type === "sticker_receive") cur.recv += t.pcs;
      else if (t.type === "sticker_issue") cur.iss += t.pcs;
      else if (t.type === "sticker_damage") cur.dmg += t.pcs;
      map.set(d, cur);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([d, v]) => ({ key: d, ...v }));
  };

  const ledger = [...txns].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="flex justify-between items-center mb-3 print:hidden">
        <Tabs value={rep} onValueChange={setRep}>
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="buyer_recv">Buyer Receive</TabsTrigger>
            <TabsTrigger value="buyer_iss">Buyer Issue</TabsTrigger>
            <TabsTrigger value="po">Po Wise</TabsTrigger>
            <TabsTrigger value="style">Style Wise</TabsTrigger>
            <TabsTrigger value="roll">Roll Wise</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" onClick={() => window.print()} className="border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-100"><Printer className="w-4 h-4 mr-1" /> Print</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rep === "buyer_recv" && (
            <ReportGrid title="Buyer Wise Receive" cols={["Buyer", "Roll", "Pcs"]} rows={buyerReceive.map((r) => [r.name, r.roll, r.pcs])} />
          )}
          {rep === "buyer_iss" && (
            <ReportGrid title="Buyer Wise Issue" cols={["Buyer", "Roll", "Pcs"]} rows={buyerIssue.map((r) => [r.name, r.roll, r.pcs])} />
          )}
          {rep === "po" && (
            <ReportGrid title="Po Wise" cols={["Po", "Received Pcs", "Issued Pcs", "Damage Pcs"]} rows={groupBy("po_no").map((r) => [r.key, r.recv, r.iss, r.dmg])} />
          )}
          {rep === "style" && (
            <ReportGrid title="Style Wise" cols={["Style", "Received Pcs", "Issued Pcs", "Damage Pcs"]} rows={groupBy("style").map((r) => [r.key, r.recv, r.iss, r.dmg])} />
          )}
          {rep === "roll" && (
            <ReportGrid title="Roll Wise" cols={["Roll No", "Received Pcs", "Issued Pcs", "Damage Pcs"]} rows={groupBy("roll_no").map((r) => [r.key, r.recv, r.iss, r.dmg])} />
          )}
          {rep === "daily" && (
            <ReportGrid title="Daily Report" cols={["Date", "Received Pcs", "Issued Pcs", "Damage Pcs"]} rows={daily().map((r) => [r.key, r.recv, r.iss, r.dmg])} />
          )}
          {rep === "monthly" && (
            <ReportGrid title="Monthly Report" cols={["Month", "Received Pcs", "Issued Pcs", "Damage Pcs"]} rows={monthly().map((r) => [r.key, r.recv, r.iss, r.dmg])} />
          )}
          {rep === "ledger" && (
            <ReportGrid
              title="Stock Ledger"
              cols={["Date", "Buyer", "Type", "Po", "Style", "Roll No", "Roll", "Pcs"]}
              rows={ledger.map((t) => [new Date(t.date).toLocaleString(), buyerName(t.buyer_id), LABEL[t.type], t.po_no || "-", t.style || "-", t.roll_no || "-", t.roll || 0, t.pcs || 0])}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ReportGrid = ({ title, cols, rows }: { title: string; cols: string[]; rows: (string | number)[][] }) => (
  <div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <Table>
      <TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={cols.length} className="text-center text-muted-foreground">No data</TableCell></TableRow>
        ) : rows.map((r, i) => (
          <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

// ================= Buyer Detail =================

const BuyerDetail = ({ buyer, txns, totals, onBack, onChange, onOpenRecv, onOpenRibbonIssue }: {
  buyer: Buyer;
  txns: Txn[];
  totals: ReturnType<typeof buyerTotals>;
  onBack: () => void;
  onChange: () => void;
  onOpenRecv: (kind: "sticker" | "ribbon") => void;
  onOpenRibbonIssue: () => void;
}) => {
  const [tab, setTab] = useState<TxnType | "rolls" | "report" | "history">("rolls");
  const [form, setForm] = useState({ roll: "", pcs: "", po_no: "", style: "", roll_no: "", note: "" });
  const [stkDetail, setStkDetail] = useState<null | "recv" | "stock" | "iss" | "dmg" | "rbn_recv" | "rbn_stock" | "rbn_iss">(null);
  const [stkQuery, setStkQuery] = useState("");

  const stkRecv = txns.filter((t) => t.type === "sticker_receive").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stkIss = txns.filter((t) => t.type === "sticker_issue").slice().sort((a, b) => b.date.localeCompare(a.date));
  const stkDmg = txns.filter((t) => t.type === "sticker_damage");
  const stkStockRows = stkRecv.map((r) => {
    const key = (r.roll_no || "").trim();
    const related = (t: Txn) => t.source_receive_id === r.id || (!t.source_receive_id && !!key && (t.roll_no || "").trim() === key);
    const iss = stkIss.filter(related).reduce((s, t) => s + (t.pcs || 0), 0);
    const dmg = stkDmg.filter(related).reduce((s, t) => s + (t.pcs || 0), 0);
    return { r, iss, dmg, bal: (r.pcs || 0) - iss - dmg };
  });
  const qm = (fields: (string | undefined)[]) => {
    const q = stkQuery.trim().toLowerCase();
    if (!q) return true;
    return fields.some((f) => (f || "").toLowerCase().includes(q));
  };
  const rbnRecv = txns.filter((t) => t.type === "ribbon_receive").slice().sort((a, b) => b.date.localeCompare(a.date));
  const rbnIss = txns.filter((t) => t.type === "ribbon_issue").slice().sort((a, b) => b.date.localeCompare(a.date));
  const rbnStockRows = rbnRecv.map((r) => {
    const key = (r.roll_no || "").trim();
    const related = (t: Txn) => t.source_receive_id === r.id || (!t.source_receive_id && !!key && (t.roll_no || "").trim() === key);
    const iss = rbnIss.filter(related).reduce((s, t) => s + (t.roll || 0), 0);
    return { r, iss, bal: (r.roll || 0) - iss };
  });
  const stkTitle = stkDetail === "recv" ? "Sticker Receive Details"
    : stkDetail === "stock" ? "Sticker Stock — Roll Balance"
    : stkDetail === "iss" ? "Sticker Issue Details"
    : stkDetail === "dmg" ? "Sticker Damage Details"
    : stkDetail === "rbn_recv" ? "Ribbon Receive Details"
    : stkDetail === "rbn_stock" ? "Ribbon Stock — Roll Balance"
    : stkDetail === "rbn_iss" ? "Ribbon Issue Details" : "";
  const printStkDialog = () => {
    const el = document.getElementById("buyer-sticker-detail-print");
    if (!el) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const _hd = `${buyer.buyer_name} — ${stkTitle}`;
    w.document.write(`<html><head><title>${_hd}</title>${mnrPrintStyles}<style>table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#4f46e5;color:#fff}</style></head><body>${mnrPrintHead(_hd)}${el.innerHTML}${mnrPrintFooter}${mnrPrintScript}</body></html>`);
    w.document.close();
    w.focus();
  };

  const submit = async (type: TxnType) => {
    const roll = parseFloat(form.roll) || 0;
    const pcs = parseFloat(form.pcs) || 0;
    if (roll <= 0 && pcs <= 0) { toast.error("Enter roll or pcs"); return; }
    const newTxn: Txn = {
      id: `txn_${Date.now()}`, buyer_id: buyer.id, type,
      roll, pcs: type.startsWith("sticker") ? pcs : 0,
      po_no: form.po_no, style: form.style, roll_no: form.roll_no,
      note: form.note, date: new Date().toISOString(),
    };
    await dbService.add("buyer_transactions", newTxn);
    toast.success("Transaction saved");
    setForm({ roll: "", pcs: "", po_no: "", style: "", roll_no: "", note: "" });
    onChange();
  };

  const sorted = useMemo(() => [...txns].sort((a, b) => b.date.localeCompare(a.date)), [txns]);

  const txnTypes: TxnType[] = ["sticker_receive", "sticker_issue", "sticker_damage", "ribbon_receive", "ribbon_issue"];

  return (
    <div className="w-full max-w-none py-4 sm:py-6 px-2 sm:px-4 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4 print:hidden">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Back" className="h-9 w-9 rounded-full border-2 border-primary text-primary bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40 shadow-sm hover:scale-105 transition">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <PermGate action="recv" path="/sticker-printer">
            <Button size="sm" onClick={() => onOpenRecv("sticker")} className="bg-gradient-to-r from-green-500 to-emerald-600 h-9 px-2 sm:px-3">
              <ArrowDownCircle className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Sticker Recv</span>
            </Button>
          </PermGate>
          <PermGate action="issue" path="/sticker-printer">
            <Button size="sm" onClick={() => onOpenRibbonIssue()} className="bg-gradient-to-r from-orange-500 to-red-500 h-9 px-2 sm:px-3">
              <ArrowUpCircle className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Ribbon Issue</span>
            </Button>
          </PermGate>
          <Button size="sm" variant="outline" className="h-9 px-2 sm:px-3 border-indigo-300 dark:border-indigo-500 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-100" onClick={() => {
            const w = window.open("", "_blank", "width=1000,height=800");
            if (!w) return;
            const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
            const now = new Date();
            const summaryRows = [
              ["Sticker Roll", totals.stickerRollRecv, totals.stickerRollIss, "-", totals.stickerRoll],
              ["Sticker Pcs", totals.stickerPcsRecv, totals.stickerPcsIss, totals.stickerPcsDmg, totals.stickerPcs],
              ["Ribbon Roll", totals.ribbonRollRecv, totals.ribbonRollIss, "-", totals.ribbonRoll],
            ].map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? "" : ' style="text-align:right"'}>${esc(c)}</td>`).join("")}</tr>`).join("");
            const isReceiveType = (t: Txn) => t.type === "sticker_receive" || t.type === "ribbon_receive";
            const recvList = sorted.filter(isReceiveType);
            const issList = sorted.filter((t) => !isReceiveType(t));
            const rowHtml = (t: Txn, sl: number, withPoStyle: boolean) => {
              const dt = new Date(t.date);
              return `<tr>
                <td style="text-align:center">${sl}</td>
                <td>${dt.toLocaleDateString()} <span style="color:#888;font-size:9px">${dt.toLocaleDateString(undefined,{weekday:"short"})}</span></td>
                <td>${esc(LABEL[t.type])}</td>
                ${withPoStyle ? `<td>${esc(t.po_no || "-")}</td><td>${esc(t.style || "-")}</td>` : ""}
                <td style="text-align:right">${t.roll || "-"}</td>
                <td style="text-align:right">${t.pcs || "-"}</td>
              </tr>`;
            };
            const recvRows = recvList.map((t, i) => rowHtml(t, i + 1, false)).join("");
            const issRows = issList.map((t, i) => rowHtml(t, i + 1, true)).join("");
            const recvTotals = recvList.reduce((a, t) => ({ roll: a.roll + (t.roll || 0), pcs: a.pcs + (t.pcs || 0) }), { roll: 0, pcs: 0 });
            const issTotals = issList.reduce((a, t) => ({ roll: a.roll + (t.roll || 0), pcs: a.pcs + (t.pcs || 0) }), { roll: 0, pcs: 0 });
            const subtitle = `Stock Report · ${now.toLocaleDateString()} (${now.toLocaleDateString(undefined,{weekday:"long"})}) · ${now.toLocaleTimeString()}`;
            const html = `<!doctype html><html><head><title>${esc(buyer.buyer_name)} — Stock Report</title>${mnrPrintStyles}<style>
              table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
              th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}
              th{background:#4f46e5;color:#fff}
              .b-info{width:100%;margin:6px 0 10px;font-size:12px}
              .b-info td{border:1px solid #ddd;padding:6px 8px}
              .b-info td.l{background:#f3f4f6;font-weight:600;color:#4f46e5;width:22%}
              .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0 12px}
              .stat{border:1px solid #ddd;border-left:4px solid #4f46e5;padding:6px 10px;border-radius:4px}
              .stat .l{font-size:10px;text-transform:uppercase;color:#666}
              .stat .v{font-size:16px;font-weight:700}
              h3{margin:14px 0 4px;color:#4f46e5;font-size:13px;border-left:4px solid #4f46e5;padding-left:8px}
              .txn-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}
              .txn-col{border:1px solid #ddd;border-radius:6px;overflow:hidden}
              .txn-col .hd{padding:6px 10px;color:#fff;font-weight:700;font-size:12px;display:flex;justify-content:space-between;align-items:center}
              .txn-col.recv .hd{background:linear-gradient(90deg,#059669,#10b981)}
              .txn-col.iss .hd{background:linear-gradient(90deg,#ea580c,#f97316)}
              .txn-col table{margin:0;font-size:10px}
              .txn-col th{background:#f3f4f6;color:#111;font-weight:600}
              .txn-col.recv tbody tr:nth-child(even){background:#f0fdf4}
              .txn-col.iss tbody tr:nth-child(even){background:#fff7ed}
              .txn-col tfoot td{background:#f9fafb;font-weight:700}
              .pill{background:rgba(255,255,255,.25);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
            </style></head><body>
              ${mnrPrintHead(`${esc(buyer.buyer_name)} — ${subtitle}`)}
              <table class="b-info"><tbody>
                <tr><td class="l">Buyer</td><td>${esc(buyer.buyer_name)}</td><td class="l">Status</td><td>${esc(buyer.status || "-")}</td></tr>
                <tr><td class="l">Merchandiser</td><td>${esc(buyer.merchandiser_name || "-")}</td><td class="l">Phone</td><td>${esc(buyer.merchandiser_phone || "-")}</td></tr>
                <tr><td class="l">GPQ</td><td>${esc(buyer.gpq_name || "-")}</td><td class="l">Phone</td><td>${esc(buyer.gpq_phone || "-")}</td></tr>
                <tr><td class="l">Store Officer</td><td>${esc(buyer.store_officer_name || "-")}</td><td class="l">Phone</td><td>${esc(buyer.store_officer_phone || "-")}</td></tr>
              </tbody></table>
              <div class="stats">
                <div class="stat"><div class="l">Sticker Roll</div><div class="v">${totals.stickerRoll}</div></div>
                <div class="stat"><div class="l">Sticker Pcs</div><div class="v">${totals.stickerPcs}</div></div>
                <div class="stat"><div class="l">Ribbon Roll</div><div class="v">${totals.ribbonRoll}</div></div>
                <div class="stat"><div class="l">Damage Pcs</div><div class="v">${totals.stickerPcsDmg}</div></div>
              </div>
              <h3>Stock Summary</h3>
              <table><thead><tr><th>Item</th><th style="text-align:right">Received</th><th style="text-align:right">Issued</th><th style="text-align:right">Damage</th><th style="text-align:right">Balance</th></tr></thead><tbody>${summaryRows}</tbody></table>
              <h3>Transaction History (${sorted.length})</h3>
              <div class="txn-grid">
                <div class="txn-col recv">
                  <div class="hd"><span>⬇ Receive</span><span class="pill">${recvList.length} entries</span></div>
                  <table>
                    <thead><tr><th style="width:24px">Sl</th><th>Date</th><th>Type</th><th style="text-align:right">Roll</th><th style="text-align:right">Pcs</th></tr></thead>
                    <tbody>${recvRows || `<tr><td colspan="5" style="text-align:center;color:#888;padding:10px">No receive entries</td></tr>`}</tbody>
                    ${recvList.length ? `<tfoot><tr><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">${recvTotals.roll}</td><td style="text-align:right">${recvTotals.pcs}</td></tr></tfoot>` : ""}
                  </table>
                </div>
                <div class="txn-col iss">
                  <div class="hd"><span>⬆ Issue / Damage</span><span class="pill">${issList.length} entries</span></div>
                  <table>
                    <thead><tr><th style="width:24px">Sl</th><th>Date</th><th>Type</th><th>PO</th><th>Style</th><th style="text-align:right">Roll</th><th style="text-align:right">Pcs</th></tr></thead>
                    <tbody>${issRows || `<tr><td colspan="7" style="text-align:center;color:#888;padding:10px">No issue entries</td></tr>`}</tbody>
                    ${issList.length ? `<tfoot><tr><td colspan="5" style="text-align:right">Total</td><td style="text-align:right">${issTotals.roll}</td><td style="text-align:right">${issTotals.pcs}</td></tr></tfoot>` : ""}
                  </table>
                </div>
              </div>
              ${mnrPrintFooter}
              <script>
                function doPrint(){ try{ window.focus(); window.print(); }catch(e){} }
                window.addEventListener('load', function(){
                  var img=document.querySelector('.mnr-head img');
                  if(img && !img.complete){ img.onload=function(){ setTimeout(doPrint,300); }; img.onerror=function(){ setTimeout(doPrint,300); }; }
                  else { setTimeout(doPrint,400); }
                });
              <\/script>
            </body></html>`;
            w.document.write(html); w.document.close();
          }}><Printer className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Print</span></Button>
        </div>
      </div>

      <Card className="mb-6 border-t-4 border-t-indigo-500">
        <CardHeader className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div className="flex items-center gap-4">
            {buyer.logo ? (
              <img src={buyer.logo} alt={buyer.buyer_name} className="h-16 w-16 rounded-lg object-contain bg-white border" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-2xl">
                {buyer.buyer_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle className="text-2xl">{buyer.buyer_name}</CardTitle>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                {buyer.merchandiser_name && <span>Mr: {buyer.merchandiser_name}</span>}
                {buyer.gpq_name && <span>Gpq: {buyer.gpq_name}</span>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div onClick={() => { setStkDetail("recv"); setStkQuery(""); }} style={{ borderColor: "#22c55e", color: "#16a34a" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Stk Receive</p>
                <p className="text-xl font-bold leading-tight">{totals.stickerRollRecv} <span className="text-xs opacity-80">Roll</span></p>
                <p className="text-base font-semibold leading-tight">{totals.stickerPcsRecv} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <ArrowDownCircle className="w-7 h-7 opacity-80" />
            </div>
          </div>
          <div onClick={() => { setStkDetail("stock"); setStkQuery(""); }} style={{ borderColor: "#6366f1", color: "#4f46e5" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Stk Stock</p>
                <p className="text-xl font-bold leading-tight">{totals.stickerRoll} <span className="text-xs opacity-80">Roll</span></p>
                <p className="text-base font-semibold leading-tight">{totals.stickerPcs} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <Package className="w-7 h-7 opacity-80" />
            </div>
          </div>
          <div onClick={() => { setStkDetail("iss"); setStkQuery(""); }} style={{ borderColor: "#f97316", color: "#ea580c" }} className="p-4 rounded-xl bg-card border-2 shadow-sm cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80">Stk Issue</p>
                <p className="text-xl font-bold leading-tight">{totals.stickerRollIss} <span className="text-xs opacity-80">Roll</span></p>
                <p className="text-base font-semibold leading-tight">{totals.stickerPcsIss} <span className="text-xs opacity-80">Pcs</span></p>
              </div>
              <ArrowUpCircle className="w-7 h-7 opacity-80" />
            </div>
          </div>
          <StockStat label="Damage Pcs" value={totals.stickerPcsDmg} icon={AlertTriangle} color="from-amber-500 to-red-500" onClick={() => { setStkDetail("dmg"); setStkQuery(""); }} />
          <StockStat label="Ribbon Roll Recv" value={totals.ribbonRollRecv} icon={ArrowDownCircle} color="from-pink-500 to-rose-600" onClick={() => { setStkDetail("rbn_recv"); setStkQuery(""); }} />
          <StockStat label="Ribbon Roll Stock" value={totals.ribbonRoll} icon={Package} color="from-fuchsia-500 to-pink-600" onClick={() => { setStkDetail("rbn_stock"); setStkQuery(""); }} />
          <StockStat label="Ribbon Roll Issue" value={totals.ribbonRollIss} icon={ArrowUpCircle} color="from-orange-500 to-red-500" onClick={() => { setStkDetail("rbn_iss"); setStkQuery(""); }} />
        </CardContent>
      </Card>

      <Dialog open={!!stkDetail} onOpenChange={(o) => !o && setStkDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sticker className="w-5 h-5 text-indigo-600" /> {stkTitle}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Input placeholder="Search by roll no, Po, style or note..." value={stkQuery} onChange={(e) => setStkQuery(e.target.value)} className="flex-1" />
            <Button variant="outline" size="sm" onClick={printStkDialog} className="hover:bg-indigo-100 dark:hover:bg-indigo-900 hover:text-indigo-700 dark:hover:text-indigo-200"><Printer className="w-4 h-4 mr-1" /> Print</Button>
          </div>
          <div id="buyer-sticker-detail-print">
            {stkDetail === "recv" && (
              <Table className="[&_th]:border [&_td]:border [&_th]:border-indigo-300 [&_td]:border-indigo-200">
                <TableHeader><TableRow className="bg-indigo-50"><TableHead>Date</TableHead><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Roll</TableHead><TableHead className="text-right">Pcs</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stkRecv.filter((t) => qm([t.roll_no, t.po_no, t.style, t.note, t.delivered_by, t.phone])).map((t) => {
                    const d = new Date(t.date);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{d.toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{d.toLocaleDateString(undefined, { weekday: "long" })}</TableCell>
                        <TableCell className="text-xs">{d.toLocaleTimeString()}</TableCell>
                        <TableCell className="text-xs font-medium">{t.delivered_by || "-"}</TableCell>
                        <TableCell className="text-xs">{t.phone ? (<a href={`https://wa.me/${t.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">{t.phone}</a>) : "-"}</TableCell>
                        <TableCell className="text-right font-semibold text-indigo-700">{t.roll || 0}</TableCell>
                        <TableCell className="text-right font-semibold">{t.pcs || 0}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {stkDetail === "stock" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Recv Pcs</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Damage</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stkStockRows.filter(({ r }) => qm([r.roll_no, r.po_no, r.style, r.note])).map(({ r, iss, dmg, bal }) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.date).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-indigo-700">{r.pcs || 0}</TableCell>
                      <TableCell className="text-right text-orange-600">{iss}</TableCell>
                      <TableCell className="text-right text-red-600">{dmg}</TableCell>
                      <TableCell className={`text-right font-bold ${bal <= 0 ? "text-muted-foreground" : "text-indigo-600"}`}>{bal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {stkDetail === "iss" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Po</TableHead><TableHead>Style</TableHead><TableHead className="text-right">Roll</TableHead><TableHead className="text-right">Pcs</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stkIss.filter((t) => qm([t.roll_no, t.po_no, t.style, t.note])).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{t.po_no || "-"}</TableCell>
                      <TableCell className="text-xs">{t.style || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{t.roll || 0}</TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">{t.pcs || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {stkDetail === "dmg" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Po</TableHead><TableHead>Style</TableHead><TableHead className="text-right">Pcs</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stkDmg.slice().sort((a,b)=>b.date.localeCompare(a.date)).filter((t) => qm([t.roll_no, t.po_no, t.style, t.note])).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{t.po_no || "-"}</TableCell>
                      <TableCell className="text-xs">{t.style || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">{t.pcs || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {stkDetail === "rbn_recv" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Roll</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rbnRecv.filter((t) => qm([t.roll_no, t.po_no, t.style, t.note])).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-pink-700">{t.roll || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {stkDetail === "rbn_stock" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Recv Roll</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rbnStockRows.filter(({ r }) => qm([r.roll_no, r.po_no, r.style, r.note])).map(({ r, iss, bal }) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.date).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-pink-700">{r.roll || 0}</TableCell>
                      <TableCell className="text-right text-orange-600">{iss}</TableCell>
                      <TableCell className={`text-right font-bold ${bal <= 0 ? "text-muted-foreground" : "text-fuchsia-600"}`}>{bal}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {stkDetail === "rbn_iss" && (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Roll</TableHead><TableHead>Note</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rbnIss.filter((t) => qm([t.roll_no, t.po_no, t.style, t.note])).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-medium">{buyer.buyer_name}</TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">{t.roll || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="print:hidden">
        <TabsList className="flex flex-wrap h-auto w-full justify-start">
          <TabsTrigger value="rolls"><Layers className="w-4 h-4 mr-1" />Roll Stock</TabsTrigger>
          <TabsTrigger value="ribbon_rolls"><Package className="w-4 h-4 mr-1" />Ribbon Roll Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="rolls">
          <RollStockTables buyer={buyer} txns={txns} onChange={onChange} only="sticker" />
        </TabsContent>

        <TabsContent value="ribbon_rolls">
          <RollStockTables buyer={buyer} txns={txns} onChange={onChange} only="ribbon" />
        </TabsContent>

        {txnTypes.map((t) => (
          <TabsContent key={t} value={t}>
            <Card>
              <CardHeader><CardTitle className="text-lg">{LABEL[t]}</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-3">
                <div><Label>Roll</Label><Input type="number" value={form.roll} onChange={(e) => setForm({ ...form, roll: e.target.value })} /></div>
                {t.startsWith("sticker") && (
                  <div><Label>Pcs</Label><Input type="number" value={form.pcs} onChange={(e) => setForm({ ...form, pcs: e.target.value })} /></div>
                )}
                <div><Label>Po No</Label><Input value={form.po_no} onChange={(e) => setForm({ ...form, po_no: e.target.value })} /></div>
                <div><Label>Style</Label><Input value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} /></div>
                <div><Label>Roll No</Label><Input value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} /></div>
                <div className="md:col-span-3"><Label>Note</Label><Textarea rows={1} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                <div className="md:col-span-4">
                  <Button onClick={() => submit(t)} className={`bg-gradient-to-r ${t === "sticker_damage" ? "from-red-500 to-rose-600" : t.endsWith("receive") ? "from-green-500 to-emerald-600" : "from-orange-500 to-red-600"}`}>
                    {LABEL[t]}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="report">
          <Card>
            <CardHeader><CardTitle>Stock Report</CardTitle></CardHeader>
            <CardContent><ReportTable txns={txns} totals={totals} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
            <CardContent><HistoryTable txns={sorted} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="hidden print:block print-area buyer-print-area">
        <style>{`
          @media print {
            @page { size: A4; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-area { font-family: Arial, sans-serif; color: #111; }
            .print-area table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .print-area th, .print-area td { border: 1px solid #999; padding: 4px 6px; }
            .print-area thead { background: #4f46e5; color: #fff; }
            .print-area tbody tr:nth-child(even) { background: #f5f3ff; }
            .print-header { border-bottom: 3px solid #4f46e5; padding-bottom: 8px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
            .print-title { font-size: 20px; font-weight: 700; color: #4f46e5; }
            .print-sub { font-size: 12px; color: #555; }
            .print-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 14px; }
            .print-stat { border: 1px solid #ddd; border-left: 4px solid #4f46e5; padding: 6px 10px; border-radius: 4px; }
            .print-stat .l { font-size: 10px; text-transform: uppercase; color: #666; }
            .print-stat .v { font-size: 18px; font-weight: 700; color: #111; }
            .print-section { font-size: 14px; font-weight: 700; margin: 14px 0 6px; color: #4f46e5; border-left: 4px solid #4f46e5; padding-left: 8px; }
            .print-footer { margin-top: 16px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ddd; padding-top: 6px; }
          }
        `}</style>
        <div className="print-header">
          {buyer.logo && <img src={buyer.logo} alt="" style={{ height: 50, width: 50, objectFit: "contain" }} />}
          <div style={{ flex: 1 }}>
            <div className="print-title">{buyer.buyer_name}</div>
            <div className="print-sub">
              {buyer.merchandiser_name && <>Merchandiser: {buyer.merchandiser_name} {buyer.merchandiser_phone && `(${buyer.merchandiser_phone})`} · </>}
              {buyer.gpq_name && <>Gpq: {buyer.gpq_name} {buyer.gpq_phone && `(${buyer.gpq_phone})`}</>}
            </div>
          </div>
          <div className="print-sub" style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700 }}>Stock Report</div>
            <div>{new Date().toLocaleString()}</div>
          </div>
        </div>
        <div className="print-stats">
          <div className="print-stat"><div className="l">Sticker Roll</div><div className="v">{totals.stickerRoll}</div></div>
          <div className="print-stat"><div className="l">Sticker Pcs</div><div className="v">{totals.stickerPcs}</div></div>
          <div className="print-stat"><div className="l">Ribbon Roll</div><div className="v">{totals.ribbonRoll}</div></div>
          <div className="print-stat"><div className="l">Damage Pcs</div><div className="v">{totals.stickerPcsDmg}</div></div>
        </div>
        <div className="print-section">Stock Summary</div>
        <ReportTable txns={txns} totals={totals} />
        <div className="print-section">Transaction History</div>
        <HistoryTable txns={sorted} />
        <div className="print-footer">Generated by Sticker Printer · {buyer.buyer_name}</div>
      </div>
    </div>
  );
};

// ============ Roll Stock Tables ============

type RollKind = "sticker" | "ribbon";

const RollStockTables = ({ buyer, txns, onChange, only }: { buyer: Buyer; txns: Txn[]; onChange: () => void; only?: "sticker" | "ribbon" }) => {
  const perm = usePerm("/sticker-printer");
  const [action, setAction] = useState<null | {
    mode: "issue" | "damage" | "edit";
    kind: RollKind;
    receiveTxn: Txn;
  }>(null);
  const [confirmDel, setConfirmDel] = useState<Txn | null>(null);
  const [historyDialog, setHistoryDialog] = useState<null | { title: string; entries: Txn[]; kind: "date" | "issue" | "damage" }>(null);
  const [printRow, setPrintRow] = useState<null | { r: Txn; kind: RollKind }>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [stkSearch, setStkSearch] = useState("");
  const [stkFrom, setStkFrom] = useState("");
  const [stkTo, setStkTo] = useState("");
  const [rbnSearch, setRbnSearch] = useState("");
  const [rbnFrom, setRbnFrom] = useState("");
  const [rbnTo, setRbnTo] = useState("");

  useEffect(() => { setHistorySearch(""); setHistoryFrom(""); setHistoryTo(""); }, [historyDialog]);

  const printHistory = (title: string, entries: Txn[], kind: "date" | "issue" | "damage") => {
    const isReceive = kind === "date";
    const isRibbon = entries.some((t) => t.type === "ribbon_issue" || t.type === "ribbon_receive");
    const showPoStyle = !isReceive && !isRibbon;
    const rows = entries
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => {
        const dt = new Date(t.date);
        return `<tr>
          <td>${dt.toLocaleDateString()}</td>
          <td>${dt.toLocaleDateString(undefined, { weekday: "long" })}</td>
          <td>${dt.toLocaleTimeString()}</td>
          ${showPoStyle ? `<td>${t.po_no || "-"}</td><td>${t.style || "-"}</td>` : ""}
          <td style="text-align:right">${t.roll || 0}</td>
          <td style="text-align:right">${t.pcs || 0}</td>
          <td>${(t.note || "-").replace(/</g, "&lt;")}</td>
        </tr>`;
      })
      .join("");
    const totalRoll = entries.reduce((s, t) => s + (t.roll || 0), 0);
    const totalPcs = entries.reduce((s, t) => s + (t.pcs || 0), 0);
    const html = `<!doctype html><html><head><title>${title}</title>
      ${mnrPrintStyles}
      <style>
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
        th,td{border:1px solid #999;padding:6px 8px}
        th{background:#4f46e5;color:#fff;text-align:left}
        tfoot td{font-weight:bold;background:#f3f4f6}
      </style></head><body>
      ${mnrPrintHead(`${buyer.buyer_name} — ${title}`)}
      <table>
        <thead><tr><th>Date</th><th>Day</th><th>Time</th>${showPoStyle ? "<th>Po</th><th>Style</th>" : ""}<th>Roll</th><th>Pcs</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="${showPoStyle ? 5 : 3}" style="text-align:right">TOTAL</td><td style="text-align:right">${totalRoll}</td><td style="text-align:right">${totalPcs}</td><td></td></tr></tfoot>
      </table>
      ${mnrPrintFooter}
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}<\/script>
      </body></html>`;
    const w = window.open("", "_blank", "width=1000,height=700");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const doPrintSizeRow = (g: {
    size: string; recvRoll: number; recvPcs: number; issRoll: number; issPcs: number; dmgPcs: number; lastDate: string; sample: Txn;
  }, sl: number | string) => {
    const balRoll = g.recvRoll - g.issRoll;
    const balPcs = g.recvPcs - g.issPcs - g.dmgPcs;
    const d = new Date(g.lastDate);
    const title = "Sticker Roll Stock";
    const html = `<!doctype html><html><head><title>${title}</title>${mnrPrintStyles}<style>
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{border:1px solid #999;padding:6px 8px;text-align:left}
      th{background:#4f46e5;color:#fff}
    </style></head><body>
      ${mnrPrintHead(`${buyer.buyer_name} — ${title}`)}
      <table>
        <thead><tr>
          <th>Sl</th><th>Date</th><th>Size</th>
          <th>Recv Roll / Pcs</th><th>Stock Roll / Pcs</th>
          <th>Issue Roll / Pcs</th><th>Dmg Pcs</th>
        </tr></thead>
        <tbody><tr>
          <td>${sl}</td>
          <td>${d.toLocaleDateString()} <span style="color:#666">(${d.toLocaleDateString(undefined,{weekday:"long"})})</span></td>
          <td>${g.size || "-"}</td>
          <td>${g.recvRoll} / ${g.recvPcs}</td>
          <td>${balRoll} / ${balPcs}</td>
          <td>${g.issRoll} / ${g.issPcs}</td>
          <td>${g.dmgPcs}</td>
        </tr></tbody>
      </table>
      ${mnrPrintFooter}
      <script>
        function doPrint(){ try{ window.focus(); window.print(); }catch(e){} }
        var img = document.querySelector('.mnr-head img');
        if (img && !img.complete) { img.onload = doPrint; img.onerror = doPrint; } else { setTimeout(doPrint, 100); }
      <\/script>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html); w.document.close();
  };

  const doPrintRow = (r: Txn, kind: RollKind) => {
    const rows: [string, string | number][] = [
      ["Sl No", r.sl_no || "-"],
      ["Receive Date", new Date(r.date).toLocaleDateString()],
      ["Si Number", r.si_number || "-"],
      ["Roll No", r.roll_no || "-"],
      ["Po Number", r.po_no || "-"],
      ["Style", r.style || "-"],
      ["Color", r.color || "-"],
      ...(kind === "sticker" ? [["Sticker Size", r.sticker_size || "-"] as [string, string]] : []),
      ["Roll Qty", r.roll || 0],
      ...(kind === "sticker"
        ? [["Pcs Per Roll", r.pcs_per_roll || "-"] as [string, string | number], ["Total Pcs", r.pcs || 0] as [string, string | number]]
        : [["Length / Roll", r.length_per_roll || "-"] as [string, string | number], ["Total Length", r.total_length || "-"] as [string, string | number]]),
      ["Delivered By", r.delivered_by || "-"],
      ["Designation", r.designation || "-"],
      ["Phone", r.phone || "-"],
      ["Note", r.note || "-"],
    ];
    const title = `${kind === "sticker" ? "Sticker" : "Ribbon"} Roll Card`;
    const html = `<!doctype html><html><head><title>${title}</title>${mnrPrintStyles}<style>
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      td{border:1px solid #ccc;padding:6px 10px}
      td.l{background:#f3f4f6;font-weight:600;width:35%;color:#4f46e5}
    </style></head><body>
      ${mnrPrintHead(`${buyer.buyer_name} — ${title}`)}
      <div class="print-section-title" style="font-size:14px;font-weight:700;color:#4f46e5;margin:4px 0 6px">Buyer Details</div>
      <table style="margin-bottom:14px"><tbody>
        <tr><td class="l">Buyer Name</td><td>${buyer.buyer_name || "-"}</td><td class="l">Status</td><td>${buyer.status || "-"}</td></tr>
        <tr><td class="l">Merchandiser</td><td>${buyer.merchandiser_name || "-"}</td><td class="l">Phone</td><td>${buyer.merchandiser_phone || "-"}</td></tr>
        <tr><td class="l">GPQ</td><td>${buyer.gpq_name || "-"}</td><td class="l">Phone</td><td>${buyer.gpq_phone || "-"}</td></tr>
        <tr><td class="l">Store Officer</td><td>${buyer.store_officer_name || "-"}</td><td class="l">Phone</td><td>${buyer.store_officer_phone || "-"}</td></tr>
      </tbody></table>
      <div class="print-section-title" style="font-size:14px;font-weight:700;color:#4f46e5;margin:4px 0 6px">${title}</div>
      <table><tbody>${rows.map(([l, v]) => `<tr><td class="l">${l}</td><td>${v}</td></tr>`).join("")}</tbody></table>
      ${mnrPrintFooter}
      <script>
        function doPrint(){ try{ window.focus(); window.print(); }catch(e){} }
        var img = document.querySelector('.mnr-head img');
        if (img && !img.complete) { img.onload = doPrint; img.onerror = doPrint; } else { setTimeout(doPrint, 100); }
      <\/script>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const doPrintRibbonStockRow = (r: Txn, issRoll: number, balRoll: number, sl: number | string) => {
    const title = "Ribbon Roll Stock — Row Details";
    const cells: [string, string | number][] = [
      ["Sl", sl || "-"],
      ["Date", new Date(r.date).toLocaleDateString()],
      ["Recv Roll Total", r.roll || 0],
      ["Stock Roll Total", balRoll],
      ["Issue Roll Total", issRoll],
    ];
    const html = `<!doctype html><html><head><title>${title}</title>${mnrPrintStyles}<style>
      table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
      th,td{border:1px solid #e5b4c4;padding:8px 10px;text-align:left}
      th{background:linear-gradient(90deg,#ec4899,#e11d48);color:#fff;font-weight:700}
      tr:nth-child(even) td{background:#fdf2f8}
    </style></head><body>
      ${mnrPrintHead(`${buyer.buyer_name} — ${title}`)}
      <table>
        <thead><tr>${cells.map(([l]) => `<th>${l}</th>`).join("")}</tr></thead>
        <tbody><tr>${cells.map(([, v]) => `<td>${v}</td>`).join("")}</tr></tbody>
      </table>
      ${mnrPrintFooter}
      <script>
        function doPrint(){ try{ window.focus(); window.print(); }catch(e){} }
        var img = document.querySelector('.mnr-head img');
        if (img && !img.complete) { img.onload = doPrint; img.onerror = doPrint; } else { setTimeout(doPrint, 100); }
      <\/script>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const buildRows = (kind: RollKind) => {
    const recvType: TxnType = kind === "sticker" ? "sticker_receive" : "ribbon_receive";
    const issType: TxnType = kind === "sticker" ? "sticker_issue" : "ribbon_issue";
    const receives = txns.filter((t) => t.type === recvType);
    return receives.map((r) => {
      const key = (r.roll_no || "").trim();
      const related = txns.filter((t) => {
        if (t.id === r.id) return false;
        if (t.source_receive_id === r.id) return true;
        if (!t.source_receive_id && key && (t.roll_no || "").trim() === key) return true;
        return false;
      });
      const iss = related.filter((t) => t.type === issType);
      const dmg = kind === "sticker" ? related.filter((t) => t.type === "sticker_damage") : [];
      const issRoll = iss.reduce((s, t) => s + (t.roll || 0), 0);
      const issPcs = iss.reduce((s, t) => s + (t.pcs || 0), 0);
      const dmgPcs = dmg.reduce((s, t) => s + (t.pcs || 0), 0);
      return {
        r, issRoll, issPcs, dmgPcs,
        balRoll: (r.roll || 0) - issRoll,
        balPcs: (r.pcs || 0) - issPcs - dmgPcs,
      };
    });
  };

  const stickerRows = buildRows("sticker");
  const ribbonRows = buildRows("ribbon");

  // Group sticker rolls by size; issues/damages deduct from total received per size (can go negative)
  const stickerReceives = txns.filter((t) => t.type === "sticker_receive");
  const stickerIssues = txns.filter((t) => t.type === "sticker_issue");
  const stickerDamages = txns.filter((t) => t.type === "sticker_damage");
  const sizeKey = (s?: string) => (s || "").trim() || "-";
  const sizeGroupMap = new Map<string, {
    size: string; recvRoll: number; recvPcs: number; issRoll: number; issPcs: number; dmgPcs: number; lastDate: string; sample: Txn;
  }>();
  for (const r of stickerReceives) {
    const k = sizeKey(r.sticker_size);
    const g = sizeGroupMap.get(k) || { size: k, recvRoll: 0, recvPcs: 0, issRoll: 0, issPcs: 0, dmgPcs: 0, lastDate: r.date, sample: r };
    g.recvRoll += r.roll || 0;
    g.recvPcs += r.pcs || 0;
    if (new Date(r.date) > new Date(g.lastDate)) { g.lastDate = r.date; g.sample = r; }
    sizeGroupMap.set(k, g);
  }
  const findSize = (t: Txn) => {
    if (t.sticker_size) return t.sticker_size;
    if (t.roll_no) {
      const rc = stickerReceives.find((r) => (r.roll_no || "").trim() === (t.roll_no || "").trim());
      if (rc) return rc.sticker_size;
    }
    return undefined;
  };
  for (const t of stickerIssues) {
    const k = sizeKey(findSize(t));
    const g = sizeGroupMap.get(k) || sizeGroupMap.values().next().value;
    if (g) { g.issPcs += t.pcs || 0; g.issRoll += t.roll || 0; }
  }
  for (const t of stickerDamages) {
    const k = sizeKey(findSize(t));
    const g = sizeGroupMap.get(k) || sizeGroupMap.values().next().value;
    if (g) g.dmgPcs += t.pcs || 0;
  }
  const stickerSizeRowsAll = Array.from(sizeGroupMap.values());
  const stickerSizeRows = stickerSizeRowsAll.filter((g) => {
    const q = stkSearch.trim().toLowerCase();
    if (q && !(g.size || "").toLowerCase().includes(q)) return false;
    const d = g.lastDate?.slice(0, 10) || "";
    if (stkFrom && d < stkFrom) return false;
    if (stkTo && d > stkTo) return false;
    return true;
  });
  const ribbonRowsFiltered = ribbonRows.filter(({ r }) => {
    const q = rbnSearch.trim().toLowerCase();
    if (q) {
      const hay = [r.sl_no, r.si_number, r.roll_no, r.po_no, r.style, r.note, r.delivered_by].map((v) => String(v || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    const d = r.date?.slice(0, 10) || "";
    if (rbnFrom && d < rbnFrom) return false;
    if (rbnTo && d > rbnTo) return false;
    return true;
  });

  const handleDelete = async (t: Txn) => {
    await dbService.delete("buyer_transactions", t.id);
    toast.success("Roll deleted");
    setConfirmDel(null);
    onChange();
  };

  return (
    <div className="space-y-6">
      {only !== "ribbon" && (
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2"><Sticker className="w-4 h-4 text-indigo-500" /> Sticker Roll Stock</CardTitle>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
              <Input type="date" value={stkFrom} onChange={(e) => setStkFrom(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
              <Input type="date" value={stkTo} onChange={(e) => setStkTo(e.target.value)} className="h-8" />
            </div>
            {(stkFrom || stkTo) && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => { setStkSearch(""); setStkFrom(""); setStkTo(""); }}>Clear</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-[10px] sm:text-sm border border-indigo-200 dark:border-indigo-800 rounded-lg overflow-hidden [&_th]:border [&_th]:border-indigo-300 dark:[&_th]:border-indigo-700 [&_td]:border [&_td]:border-indigo-100 dark:[&_td]:border-indigo-900 [&_th]:px-1.5 sm:[&_th]:px-3 [&_td]:px-1.5 sm:[&_td]:px-3 [&_th]:text-[10px] sm:[&_th]:text-xs">
            <TableHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-white font-semibold w-12">Sl</TableHead>
                <TableHead className="text-white font-semibold">Date</TableHead>
                <TableHead className="text-white font-semibold">Size</TableHead>
                <TableHead className="text-white font-semibold">Recv Roll / Pcs</TableHead>
                <TableHead className="text-white font-semibold">Stock Roll / Pcs</TableHead>
                <TableHead className="text-white font-semibold">Issue Roll / Pcs</TableHead>
                <TableHead className="text-white font-semibold">Dmg Pcs</TableHead>
                <TableHead className="text-white font-semibold text-center w-32">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:nth-child(even)]:bg-indigo-50/40 dark:[&_tr:nth-child(even)]:bg-indigo-950/30 [&_tr:hover]:bg-indigo-100/60 dark:[&_tr:hover]:bg-indigo-900/40">
              {stickerSizeRows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No sticker rolls received</TableCell></TableRow>
              ) : stickerSizeRows.map((g, idx) => {
                const balPcs = g.recvPcs - g.issPcs - g.dmgPcs;
                const balRoll = g.recvRoll - g.issRoll;
                const r = g.sample;
                const d = new Date(g.lastDate);
                const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
                const timeStr = d.toLocaleTimeString();
                const sizeReceives = stickerReceives.filter((t) => sizeKey(t.sticker_size) === g.size);
                const sizeRollNos = new Set(sizeReceives.map((r) => (r.roll_no || "").trim()).filter(Boolean));
                const sizeIssues = stickerIssues.filter((t) => {
                  if (sizeKey(findSize(t)) === g.size) return true;
                  const rk = (t.roll_no || "").trim();
                  return rk ? sizeRollNos.has(rk) : false;
                });
                return (
                 <TableRow key={g.size}>
                   <TableCell className="text-center font-semibold text-indigo-700 dark:text-indigo-300">{r.sl_no || (idx + 1)}</TableCell>
                  <TableCell
                    className="text-xs cursor-pointer select-none hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded"
                    title={`${dayName} · ${d.toLocaleString()} — click for history`}
                    onClick={() => setHistoryDialog({ title: `Receive History — ${g.size}`, entries: sizeReceives, kind: "date" })}
                  >
                    <div className="leading-tight">
                      <div className="font-medium">{d.toLocaleDateString()}</div>
                      <div className="text-[10px] text-muted-foreground">{dayName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
                    {(() => {
                      const s = g.size;
                      if (!s) return "-";
                      const m = s.match(/^(.*?)\s*(mm|inch)\s*$/i);
                      const val = m ? m[1] : s;
                      const unit = m ? m[2].toLowerCase() : "wh";
                      const label = unit === "inch" ? "inch" : unit === "mm" ? "mm" : "W×H";
                       const cls = unit === "inch" ? "bg-emerald-100 text-indigo-700 dark:bg-emerald-900/40 dark:text-emerald-200" : unit === "mm" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200";
                      return (
                        <span className="inline-flex items-center gap-1">
                          <span>{val}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{label}</span>
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell><span className="font-semibold text-emerald-600 dark:text-emerald-400">{g.recvRoll}</span> <span className="text-muted-foreground">/</span> <span className="font-semibold text-indigo-700 dark:text-indigo-300">{g.recvPcs}</span></TableCell>
                  <TableCell
                    className={perm.issue ? "cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded" : ""}
                    title={perm.issue ? "Click to Issue" : ""}
                    onClick={perm.issue ? () => setAction({ mode: "issue", kind: "sticker", receiveTxn: r }) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`font-bold ${balRoll < 0 ? "text-red-600 dark:text-red-400" : balRoll === 0 ? "text-red-600 dark:text-red-400" : balRoll === 1 ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-300"}`}>{balRoll}</span> <span className="text-muted-foreground">/</span> <span className={`font-bold ${balPcs < 0 ? "text-red-600 dark:text-red-400" : balPcs === 0 ? "text-muted-foreground" : "text-indigo-600 dark:text-indigo-300"}`}>{balPcs}</span>
                      {(balRoll <= 0 || balRoll === 1) && buyer.merchandiser_phone && (perm.issue || perm.recv || perm.edit) && (() => {
                        const isOut = balRoll <= 0;
                        const phone = buyer.merchandiser_phone.replace(/\D/g, "");
                        const mr = buyer.merchandiser_name || "Sir";
                        const msg = isOut
                          ? `Dear ${mr},\nSticker (Size: ${g.size || "-"}) stock is OUT for buyer "${buyer.buyer_name}".\nCurrent stock: 0 roll / ${balPcs} pcs.\nPlease arrange new sticker rolls urgently.\nThank you.`
                          : `Dear ${mr},\nSticker (Size: ${g.size || "-"}) stock is LOW for buyer "${buyer.buyer_name}".\nOnly 1 roll (${balPcs} pcs) left in stock.\nPlease arrange new sticker rolls soon.\nThank you.`;
                        const href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={isOut ? `Stock Out — WhatsApp ${buyer.merchandiser_name || ""}` : `Low Stock — WhatsApp ${buyer.merchandiser_name || ""}`}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${isOut ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            {isOut ? "Stock Out" : "Low Stock"}
                            <MessageCircle className="w-3 h-3 text-green-600" />
                          </a>
                        );
                      })()}
                    </span>
                  </TableCell>
                  <TableCell
                    className="cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded"
                    title="Click for issue history"
                    onClick={() => setHistoryDialog({ title: `Issue History — ${g.size}`, entries: sizeIssues, kind: "issue" })}
                  >
                    <span className="font-semibold text-orange-600 dark:text-orange-400">{g.issRoll}</span> <span className="text-muted-foreground">/</span> <span className="font-semibold text-orange-700 dark:text-orange-300">{g.issPcs}</span>
                  </TableCell>
                  <TableCell
                    className="text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 rounded font-semibold"
                    title="Click for damage history"
                    onClick={() => {
                      const sizeDmg = stickerDamages.filter((t) => {
                        if (sizeKey(findSize(t)) === g.size) return true;
                        const rk = (t.roll_no || "").trim();
                        return rk ? sizeRollNos.has(rk) : false;
                      });
                      setHistoryDialog({ title: `Damage History — ${g.size}`, entries: sizeDmg, kind: "damage" });
                    }}
                  >{g.dmgPcs}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         {perm.edit && (
                           <DropdownMenuItem onClick={() => setAction({ mode: "edit", kind: "sticker", receiveTxn: r })}>
                             <Pencil className="w-4 h-4 mr-2" /> Edit
                           </DropdownMenuItem>
                         )}
                         {perm.issue && (
                           <DropdownMenuItem onClick={() => setAction({ mode: "damage", kind: "sticker", receiveTxn: r })}>
                             <AlertTriangle className="w-4 h-4 mr-2 text-red-600" /> Dmg Pcs Issue
                           </DropdownMenuItem>
                         )}
                         <DropdownMenuItem onClick={() => doPrintSizeRow(g, r.sl_no || (idx + 1))}>
                           <Printer className="w-4 h-4 mr-2" /> Print
                         </DropdownMenuItem>
                         {perm.delete && (
                           <>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(r)}>
                               <Trash2 className="w-4 h-4 mr-2" /> Delete
                             </DropdownMenuItem>
                           </>
                         )}
                       </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {only !== "sticker" && (
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-pink-500" /> Ribbon Roll Stock</CardTitle>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
              <Input type="date" value={rbnFrom} onChange={(e) => setRbnFrom(e.target.value)} className="h-8" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
              <Input type="date" value={rbnTo} onChange={(e) => setRbnTo(e.target.value)} className="h-8" />
            </div>
            {(rbnFrom || rbnTo) && (
              <Button size="sm" variant="outline" className="h-8" onClick={() => { setRbnSearch(""); setRbnFrom(""); setRbnTo(""); }}>Clear</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-[10px] sm:text-sm border border-pink-200 dark:border-pink-800 rounded-lg overflow-hidden [&_th]:border [&_th]:border-pink-300 dark:[&_th]:border-pink-700 [&_td]:border [&_td]:border-pink-100 dark:[&_td]:border-pink-900 [&_th]:px-1.5 sm:[&_th]:px-3 [&_td]:px-1.5 sm:[&_td]:px-3 [&_th]:text-[10px] sm:[&_th]:text-xs">
            <TableHeader className="bg-gradient-to-r from-pink-500 to-rose-600 [&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-white font-semibold w-12">Sl</TableHead>
                <TableHead className="text-white font-semibold">Date</TableHead>
                <TableHead className="text-white font-semibold">Recv Roll Total</TableHead>
                <TableHead className="text-white font-semibold">Stock Roll Total</TableHead>
                <TableHead className="text-white font-semibold">Issue Roll Total</TableHead>
                <TableHead className="text-white font-semibold text-center w-20">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:nth-child(even)]:bg-pink-50/40 dark:[&_tr:nth-child(even)]:bg-pink-950/30 [&_tr:hover]:bg-pink-100/60 dark:[&_tr:hover]:bg-pink-900/40">
              {ribbonRowsFiltered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No ribbon rolls received</TableCell></TableRow>
              ) : ribbonRowsFiltered.map(({ r, issRoll, balRoll }, idx) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center font-semibold text-pink-700 dark:text-pink-300">{r.sl_no || (idx + 1)}</TableCell>
                  <TableCell className="text-xs">{new Date(r.date).toLocaleDateString()}</TableCell>
                  <TableCell><span className="font-semibold text-indigo-700 dark:text-indigo-300">{r.roll}</span></TableCell>
                  <TableCell className="font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`rounded px-1 ${perm.issue ? "cursor-pointer hover:bg-pink-50 dark:hover:bg-pink-950/40" : ""} ${balRoll <= 0 ? "text-muted-foreground" : "text-pink-600 dark:text-pink-300"}`}
                        title={perm.issue ? "Click to Issue" : ""}
                        onClick={perm.issue ? () => setAction({ mode: "issue", kind: "ribbon", receiveTxn: r }) : undefined}
                      >{balRoll}</span>
                      {(balRoll <= 0 || balRoll === 1) && (buyer.store_officer_phone || buyer.store_officer_email) && (perm.issue || perm.recv || perm.edit) && (() => {
                        const isOut = balRoll <= 0;
                        const so = buyer.store_officer_name || "Sir";
                        const msg = isOut
                          ? `Dear ${so},\nRibbon roll stock is OUT for buyer "${buyer.buyer_name}".\nCurrent stock: 0 roll.\nPlease arrange new ribbon rolls urgently.\nThank you.`
                          : `Dear ${so},\nRibbon roll stock is LOW for buyer "${buyer.buyer_name}".\nOnly 1 roll left in stock.\nPlease arrange new ribbon rolls soon.\nThank you.`;
                        const subj = isOut ? `Ribbon Stock Out — ${buyer.buyer_name}` : `Ribbon Low Stock — ${buyer.buyer_name}`;
                        const cls = isOut ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900/60" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60";
                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {isOut ? "Stock Out" : "Low Stock"}
                            {buyer.store_officer_phone && (
                              <a
                                href={`https://wa.me/${buyer.store_officer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`WhatsApp Store Officer ${buyer.store_officer_name || ""} (${buyer.store_officer_phone})`}
                              >
                                <MessageCircle className="w-3 h-3 text-green-600" />
                              </a>
                            )}
                            {buyer.store_officer_email && (
                              <a
                                href={`mailto:${buyer.store_officer_email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`}
                                onClick={(e) => e.stopPropagation()}
                                title={`Email Store Officer ${buyer.store_officer_email}`}
                              >
                                <Mail className="w-3 h-3 text-blue-600" />
                              </a>
                            )}
                          </span>
                        );
                      })()}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-orange-600 dark:text-orange-400 font-semibold cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded"
                    title="Click for issue history"
                    onClick={() => {
                      const rk = (r.roll_no || "").trim();
                      const entries = txns.filter((t) => t.type === "ribbon_issue" && (
                        t.source_receive_id === r.id ||
                        (!t.source_receive_id && !!rk && (t.roll_no || "").trim() === rk)
                      ));
                      setHistoryDialog({ title: `Issue History — Ribbon #${r.sl_no || r.roll_no || ""}`, entries, kind: "issue" });
                    }}
                  >{issRoll}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {perm.edit && (
                          <DropdownMenuItem onClick={() => setAction({ mode: "edit", kind: "ribbon", receiveTxn: r })}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => doPrintRibbonStockRow(r, issRoll, balRoll, r.sl_no || (idx + 1))}>
                          <Printer className="w-4 h-4 mr-2" /> Print
                        </DropdownMenuItem>
                        {perm.delete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDel(r)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {action && (
        <RollActionDialog
          action={action}
          buyerId={buyer.id}
          allTxns={txns}
          onClose={() => setAction(null)}
          onSaved={() => { setAction(null); onChange(); }}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Roll?</AlertDialogTitle>
            <AlertDialogDescription>Delete roll "{confirmDel?.roll_no || "-"}"? Related issue/damage entries will remain.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && handleDelete(confirmDel)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyDialog} onOpenChange={(o) => !o && setHistoryDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> {historyDialog?.title}
            </DialogTitle>
          </DialogHeader>
          {historyDialog && historyDialog.entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No history yet</p>
          ) : historyDialog && (() => {
            const q = historySearch.trim().toLowerCase();
            const fromMs = historyFrom ? new Date(historyFrom + "T00:00:00").getTime() : -Infinity;
            const toMs = historyTo ? new Date(historyTo + "T23:59:59").getTime() : Infinity;
            const filtered = historyDialog.entries.filter((t) => {
              const ts = new Date(t.date).getTime();
              if (ts < fromMs || ts > toMs) return false;
              if (!q) return true;
              return [t.roll_no, t.po_no, t.style, t.color, t.note, t.sl_no,
                new Date(t.date).toLocaleDateString(),
                new Date(t.date).toLocaleDateString(undefined, { weekday: "long" })]
                .some((v) => (v || "").toString().toLowerCase().includes(q));
            });
            const totalRoll = filtered.reduce((s, t) => s + (t.roll || 0), 0);
            const totalPcs = filtered.reduce((s, t) => s + (t.pcs || 0), 0);
            const isReceive = historyDialog.kind === "date";
            const isRibbon = historyDialog.entries.some((t) => t.type === "ribbon_issue" || t.type === "ribbon_receive");
            const showPoStyle = !isReceive && !isRibbon;
            return (
            <>
            <div className="flex flex-wrap gap-2 mb-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search date, roll, Po, style, note..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs whitespace-nowrap">From</Label>
                <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="w-36" />
                <Label className="text-xs whitespace-nowrap">To</Label>
                <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="w-36" />
                {(historyFrom || historyTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}>Clear</Button>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => printHistory(historyDialog.title, filtered, historyDialog.kind)}
                className="gap-1"
              >
                <Printer className="w-4 h-4" /> Print
              </Button>
            </div>
            <Table className="border border-indigo-200 rounded-lg overflow-hidden [&_th]:border [&_td]:border">
              <TableHeader className="bg-gradient-to-r from-indigo-500 to-purple-600">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Day</TableHead>
                  <TableHead className="text-white">Time</TableHead>
                  {showPoStyle && <TableHead className="text-white">Po</TableHead>}
                  {showPoStyle && <TableHead className="text-white">Style</TableHead>}
                  <TableHead className="text-white">Roll</TableHead>
                  <TableHead className="text-white">Pcs</TableHead>
                  <TableHead className="text-white">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((t) => {
                    const dt = new Date(t.date);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{dt.toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{dt.toLocaleDateString(undefined, { weekday: "long" })}</TableCell>
                        <TableCell className="text-xs">{dt.toLocaleTimeString()}</TableCell>
                        {showPoStyle && <TableCell>{t.po_no || "-"}</TableCell>}
                        {showPoStyle && <TableCell>{t.style || "-"}</TableCell>}
                        <TableCell className="text-right">{t.roll || "-"}</TableCell>
                        <TableCell className="text-right font-semibold">{t.pcs || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                 <TableRow className="bg-indigo-50 font-bold">
                   <TableCell colSpan={showPoStyle ? 5 : 3} className="text-right">TOTAL</TableCell>
                  <TableCell className="text-right text-indigo-700">{totalRoll}</TableCell>
                  <TableCell className="text-right text-indigo-700">{totalPcs}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {printRow && (
        <div className="print-only" style={{ display: "none" }}>
          <div className="print-container">
            <div className="print-header">
              <h1>{buyer.buyer_name}</h1>
              <h2>{printRow.kind === "sticker" ? "Sticker" : "Ribbon"} Roll Card</h2>
            </div>
            <div className="print-section">
              <div className="print-section-title">Roll Details</div>
              <div className="print-info-grid">
                <div className="print-info-item"><div className="print-info-label">Sl No</div><div className="print-info-value">{printRow.r.sl_no || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Receive Date</div><div className="print-info-value">{new Date(printRow.r.date).toLocaleDateString()}</div></div>
                <div className="print-info-item"><div className="print-info-label">Si Number</div><div className="print-info-value">{printRow.r.si_number || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Roll No</div><div className="print-info-value">{printRow.r.roll_no || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Po Number</div><div className="print-info-value">{printRow.r.po_no || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Style</div><div className="print-info-value">{printRow.r.style || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Color</div><div className="print-info-value">{printRow.r.color || "-"}</div></div>
                {printRow.kind === "sticker" && (
                  <div className="print-info-item"><div className="print-info-label">Sticker Size</div><div className="print-info-value">{printRow.r.sticker_size || "-"}</div></div>
                )}
                <div className="print-info-item"><div className="print-info-label">Roll Qty</div><div className="print-info-value">{printRow.r.roll || 0}</div></div>
                {printRow.kind === "sticker" ? (
                  <>
                    <div className="print-info-item"><div className="print-info-label">Pcs Per Roll</div><div className="print-info-value">{printRow.r.pcs_per_roll || "-"}</div></div>
                    <div className="print-info-item"><div className="print-info-label">Total Pcs</div><div className="print-info-value">{printRow.r.pcs || 0}</div></div>
                  </>
                ) : (
                  <>
                    <div className="print-info-item"><div className="print-info-label">Length / Roll</div><div className="print-info-value">{printRow.r.length_per_roll || "-"}</div></div>
                    <div className="print-info-item"><div className="print-info-label">Total Length</div><div className="print-info-value">{printRow.r.total_length || "-"}</div></div>
                  </>
                )}
                <div className="print-info-item"><div className="print-info-label">Delivered By</div><div className="print-info-value">{printRow.r.delivered_by || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Designation</div><div className="print-info-value">{printRow.r.designation || "-"}</div></div>
                <div className="print-info-item"><div className="print-info-label">Phone</div><div className="print-info-value">{printRow.r.phone || "-"}</div></div>
              </div>
              {printRow.r.note && (
                <div className="print-info-item" style={{ marginTop: 10 }}>
                  <div className="print-info-label">Note</div>
                  <div className="print-info-value">{printRow.r.note}</div>
                </div>
              )}
            </div>
            <div className="print-footer">Printed on {new Date().toLocaleString()} · MNR Group</div>
          </div>
        </div>
      )}
    </div>
  );
};

const RollActionDialog = ({ action, buyerId, allTxns, onClose, onSaved }: {
  action: { mode: "issue" | "damage" | "edit"; kind: RollKind; receiveTxn: Txn };
  buyerId: string;
  allTxns: Txn[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const { mode, kind, receiveTxn } = action;
  const isEdit = mode === "edit";
  const isStickerDamage = mode === "damage" && kind === "sticker";
  const isStickerIssue = (mode === "issue" || mode === "damage") && kind === "sticker";

  const isStickerIssueInit = (action.mode === "issue" || action.mode === "damage") && action.kind === "sticker";
  const [selectedRollId, setSelectedRollId] = useState<string>(isStickerIssueInit ? "" : receiveTxn.id);
  const [selectedVRollIds, setSelectedVRollIds] = useState<string[]>([]);

  // Available rolls for sticker issue module
  const recvType: TxnType = kind === "sticker" ? "sticker_receive" : "ribbon_receive";
  const issType: TxnType = kind === "sticker" ? "sticker_issue" : "ribbon_issue";
  const availableRolls = allTxns.filter((t) => t.type === recvType);

  // Compute per-roll balance and hide rolls with no Pcs left (sticker issue only)
  const sizeFilter = isStickerIssueInit ? (receiveTxn.sticker_size || "").trim() : "";
  const scopedRolls = sizeFilter
    ? availableRolls.filter((r) => (r.sticker_size || "").trim() === sizeFilter)
    : availableRolls;

  // Expand each receive into individual physical rolls with per-roll balances.
  // Each virtual roll id = `${receiveId}#${index}`. Issues/damages consume from
  // their recorded sub_roll_index, or sequentially from index 0 for legacy rows.
  type VRoll = { id: string; receive: Txn; idx: number; cap: number; balPcs: number };
  const virtualRolls: VRoll[] = [];
  for (const r of scopedRolls) {
    const rollCount = Math.max(1, Math.floor(r.roll || 0) || (r.pcs ? 1 : 0));
    if (rollCount === 0) continue;
    const cap = r.pcs_per_roll || (r.roll ? Math.round((r.pcs || 0) / r.roll) : (r.pcs || 0));
    const vs: VRoll[] = Array.from({ length: rollCount }, (_, i) => ({
      id: `${r.id}#${i}`, receive: r, idx: i, cap, balPcs: cap,
    }));
    const rk = (r.roll_no || "").trim();
    const matches = (t: Txn) => t.source_receive_id === r.id || (!t.source_receive_id && !!rk && (t.roll_no || "").trim() === rk);
    const consume = (t: Txn) => {
      let remaining = t.pcs || 0;
      if (remaining <= 0) return;
      const start = typeof t.sub_roll_index === "number" && t.sub_roll_index >= 0 && t.sub_roll_index < vs.length ? t.sub_roll_index : 0;
      for (let i = start; i < vs.length && remaining > 0; i++) {
        const take = Math.min(vs[i].balPcs, remaining);
        vs[i].balPcs -= take;
        remaining -= take;
      }
    };
    allTxns.filter((t) => t.type === issType && matches(t)).forEach(consume);
    if (kind === "sticker") allTxns.filter((t) => t.type === "sticker_damage" && matches(t)).forEach(consume);
    virtualRolls.push(...vs);
  }
  const selectableVRolls = virtualRolls.filter((v) => v.balPcs > 0);
  // Legacy compat: keep single-select shape for damage/edit modes
  const rollBalances = scopedRolls.map((r) => {
    const total = virtualRolls.filter((v) => v.receive.id === r.id).reduce((s, v) => s + v.balPcs, 0);
    return { r, balPcs: total };
  });
  const selectableRolls = rollBalances.filter((x) => x.balPcs > 0);

  // Auto-select first available virtual roll so Available Pcs shows immediately
  useEffect(() => {
    if (isStickerIssueInit && selectedVRollIds.length === 0 && selectableVRolls.length > 0) {
      setSelectedVRollIds([selectableVRolls[0].id]);
      const first = selectableVRolls[0];
      setSelectedRollId(first.receive.id);
      setF((prev) => ({
        ...prev,
        po_no: first.receive.po_no || "",
        style: first.receive.style || "",
        color: first.receive.color || "",
        roll_no: first.receive.roll_no || "",
        pcs: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedVRolls = selectableVRolls.filter((v) => selectedVRollIds.includes(v.id));
  const currentRoll = availableRolls.find((r) => r.id === selectedRollId) || (isStickerIssueInit ? (selectedVRolls[0]?.receive || null) : receiveTxn);
  const rollKey = (currentRoll?.roll_no || "").trim();
  const matchCurrent = (t: Txn) =>
    (!!currentRoll && t.source_receive_id === currentRoll.id) ||
    (!!rollKey && (t.roll_no || "").trim() === rollKey);
  const relatedIss = currentRoll
    ? allTxns.filter((t) => t.type === issType && matchCurrent(t))
    : [];
  const relatedDmg = kind === "sticker" && currentRoll
    ? allTxns.filter((t) => t.type === "sticker_damage" && matchCurrent(t))
    : [];
  const availablePcs = isStickerIssueInit
    ? selectedVRolls.reduce((s, v) => s + v.balPcs, 0)
    : (currentRoll?.pcs || 0)
      - relatedIss.reduce((s, t) => s + (t.pcs || 0), 0)
      - relatedDmg.reduce((s, t) => s + (t.pcs || 0), 0);
  const availableRoll = isStickerIssueInit
    ? selectedVRolls.length
    : (currentRoll?.roll || 0) - relatedIss.reduce((s, t) => s + (t.roll || 0), 0);

  const [f, setF] = useState({
    roll: isEdit ? String(receiveTxn.roll || "") : "",
    pcs: isEdit ? String(receiveTxn.pcs || "") : "",
    po_no: receiveTxn.po_no || "",
    style: receiveTxn.style || "",
    color: receiveTxn.color || "",
    roll_no: receiveTxn.roll_no || "",
    note: isEdit ? receiveTxn.note || "" : "",
    issue_date: new Date().toISOString().slice(0, 10),
    receive_date: receiveTxn.receive_date || new Date().toISOString().slice(0, 10),
    si_number: receiveTxn.si_number || "",
    delivered_by: receiveTxn.delivered_by || "",
    designation: receiveTxn.designation || "",
    phone: receiveTxn.phone || "",
    sticker_size: receiveTxn.sticker_size || "",
    pcs_per_roll: receiveTxn.pcs_per_roll ? String(receiveTxn.pcs_per_roll) : "",
    length_per_roll: receiveTxn.length_per_roll ? String(receiveTxn.length_per_roll) : "",
    sl_no: receiveTxn.sl_no ? String(receiveTxn.sl_no) : "",
  });

  // Auto-fill Po/style/color/roll_no when roll selection changes (sticker issue mode)
  const handleRollChange = (rollId: string) => {
    setSelectedRollId(rollId);
    const r = availableRolls.find((x) => x.id === rollId);
    if (r) {
      setF((prev) => ({
        ...prev,
        po_no: r.po_no || "",
        style: r.style || "",
        color: r.color || "",
        roll_no: r.roll_no || "",
        pcs: "",
      }));
    }
  };

  const issuePcsNum = parseFloat(f.pcs) || 0;
  const balancePcs = availablePcs - issuePcsNum;

  const title = isEdit
    ? `Edit ${kind === "sticker" ? "Sticker" : "Ribbon"} Roll`
    : mode === "issue"
      ? kind === "sticker" ? "Sticker Issue" : `Issue from Roll ${receiveTxn.roll_no || ""}`
      : `Damage from Roll ${receiveTxn.roll_no || ""}`;

  const save = async () => {
    const roll = parseFloat(f.roll) || 0;
    const pcs = parseFloat(f.pcs) || 0;

    if (isStickerIssue) {
      if (selectedVRollIds.length === 0) { toast.error("Please select at least one roll"); return; }
      if (pcs <= 0) { toast.error(isStickerDamage ? "Enter Damage Pcs" : "Enter Issue Pcs"); return; }
      if (availablePcs <= 0) { toast.error("This roll has no Pcs available"); return; }
      if (pcs > availablePcs) { toast.error(`Only ${availablePcs} Pcs available — negative balance not allowed`); return; }
      // Distribute pcs across selected virtual rolls sequentially, creating one
      // sticker_issue txn per consumed virtual roll (tagged with sub_roll_index).
      let remaining = pcs;
      const dateIso = f.issue_date ? new Date(f.issue_date).toISOString() : new Date().toISOString();
      let n = 0;
      const txnType: TxnType = isStickerDamage ? "sticker_damage" : "sticker_issue";
      for (const v of selectedVRolls) {
        if (remaining <= 0) break;
        const take = Math.min(v.balPcs, remaining);
        if (take <= 0) continue;
        const rollsConsumed = take >= v.balPcs ? 1 : 0;
        await dbService.add("buyer_transactions", {
          id: `txn_${Date.now()}_${n++}`, buyer_id: buyerId, type: txnType,
          roll: isStickerDamage ? 0 : rollsConsumed, pcs: take,
          po_no: v.receive.po_no || f.po_no,
          style: v.receive.style || f.style,
          color: v.receive.color || f.color,
          roll_no: v.receive.roll_no || f.roll_no,
          sticker_size: v.receive.sticker_size,
          source_receive_id: v.receive.id,
          sub_roll_index: v.idx,
          note: f.note,
          date: dateIso,
        });
        remaining -= take;
      }
      toast.success(`${isStickerDamage ? "Damage" : "Issued"} ${pcs} Pcs from ${selectedVRolls.length} roll(s)`);
      onSaved();
      return;
    }

    if (roll <= 0 && pcs <= 0) { toast.error("Enter roll or pcs"); return; }

    if (isEdit) {
      await dbService.put("buyer_transactions", {
        ...receiveTxn,
        roll,
        pcs: kind === "sticker" ? (parseFloat(f.pcs) || (roll * (parseFloat(f.pcs_per_roll) || 0))) : 0,
        po_no: f.po_no,
        style: f.style,
        color: f.color,
        roll_no: f.roll_no,
        note: f.note,
        receive_date: f.receive_date,
        si_number: f.si_number || undefined,
        delivered_by: f.delivered_by,
        designation: f.designation,
        phone: f.phone,
        sticker_size: kind === "sticker" ? f.sticker_size : undefined,
        pcs_per_roll: kind === "sticker" ? (parseFloat(f.pcs_per_roll) || undefined) : undefined,
        length_per_roll: kind === "ribbon" ? (parseFloat(f.length_per_roll) || undefined) : undefined,
        total_length: kind === "ribbon" ? (roll * (parseFloat(f.length_per_roll) || 0)) || undefined : undefined,
        sl_no: f.sl_no ? f.sl_no.trim() : undefined,
        date: (() => {
          if (!f.receive_date) return receiveTxn.date;
          const prev = new Date(receiveTxn.date);
          const [y, m, d] = f.receive_date.split("-").map(Number);
          const dt = new Date(y, (m || 1) - 1, d || 1, prev.getHours(), prev.getMinutes(), prev.getSeconds());
          return dt.toISOString();
        })(),
      });
      toast.success("Roll updated");
    } else {
      const type: TxnType = mode === "damage"
        ? "sticker_damage"
        : kind === "sticker" ? "sticker_issue" : "ribbon_issue";
      const existingSls = allTxns
        .filter((t) => t.buyer_id === buyerId && t.type === type)
        .map((t) => parseInt(String(t.sl_no || "0"), 10))
        .filter((n) => !isNaN(n));
      const autoSl = (existingSls.length ? Math.max(...existingSls) : 0) + 1;
      await dbService.add("buyer_transactions", {
        id: `txn_${Date.now()}`, buyer_id: buyerId, type,
        roll: kind === "ribbon" ? roll : (mode === "damage" ? 0 : roll),
        pcs: kind === "sticker" ? pcs : 0,
        po_no: f.po_no, style: f.style, color: f.color, roll_no: f.roll_no,
        source_receive_id: receiveTxn.id,
        sl_no: f.sl_no ? f.sl_no.trim() : String(autoSl),
        note: f.note,
        date: f.issue_date ? new Date(f.issue_date).toISOString() : new Date().toISOString(),
      });
      toast.success(mode === "damage" ? "Damage recorded" : "Issued");
    }
    onSaved();
  };

  if (isStickerIssue) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isStickerDamage
                ? <><AlertTriangle className="w-5 h-5 text-red-600" /> Sticker Damage</>
                : <><ArrowUpCircle className="w-5 h-5 text-orange-600" /> Sticker Issue</>}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{isStickerDamage ? "Damage Date" : "Issue Date"}</Label>
              <Input type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Select Rolls * <span className="text-xs text-muted-foreground">(check one or more)</span></Label>
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border p-2 space-y-1 bg-background">
                {selectableVRolls.length === 0 ? (
                  <div className="px-1 py-1 text-xs text-muted-foreground">No rolls with balance</div>
                ) : selectableVRolls.map((v) => {
                  const checked = selectedVRollIds.includes(v.id);
                  return (
                    <label key={v.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const next = c
                            ? [...selectedVRollIds, v.id]
                            : selectedVRollIds.filter((id) => id !== v.id);
                          setSelectedVRollIds(next);
                          const first = selectableVRolls.find((x) => next.includes(x.id));
                          if (first) {
                            setSelectedRollId(first.receive.id);
                            setF((prev) => ({
                              ...prev,
                              po_no: first.receive.po_no || "",
                              style: first.receive.style || "",
                              color: first.receive.color || "",
                              roll_no: first.receive.roll_no || "",
                            }));
                          }
                        }}
                      />
                      <span className="flex-1">
                        Sl {v.receive.sl_no || ""} · Roll #{v.idx + 1}
                        {v.receive.style ? ` — ${v.receive.style}` : ""}
                        {v.receive.roll_no ? ` (${v.receive.roll_no})` : ""}
                        {" "}· <span className="font-semibold text-indigo-700">{v.balPcs}</span>/{v.cap} Pcs
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div><Label>Po Number</Label><Input value={f.po_no} onChange={(e) => setF({ ...f, po_no: e.target.value })} /></div>
            <div><Label>Style Number</Label><Input value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })} /></div>
            <div className="col-span-2"><Label>Color</Label><Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
            <div>
              <Label>Available Pcs</Label>
              <Input value={availablePcs} readOnly className="bg-muted font-semibold text-indigo-700" />
            </div>
            <div>
              <Label>Selected Rolls</Label>
              <Input value={selectedVRolls.length} readOnly className="bg-muted font-semibold text-indigo-700" />
            </div>
            <div>
              <Label>{isStickerDamage ? "Damage Pcs *" : "Issue Pcs *"}</Label>
              <Input type="number" min="0" max={availablePcs} value={f.pcs} onChange={(e) => setF({ ...f, pcs: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Balance Pcs</Label>
              <Input value={balancePcs} readOnly className={`bg-muted font-semibold ${balancePcs < 0 ? "text-red-600" : "text-green-700"}`} />
            </div>
            <div className="col-span-2"><Label>Note</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} className={`bg-gradient-to-r ${isStickerDamage ? "from-red-500 to-rose-600" : "from-orange-500 to-red-500"}`}>
              {isStickerDamage ? "Save Damage" : "Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (isEdit) {
    const rollNum = parseFloat(f.roll) || 0;
    const pprNum = parseFloat(f.pcs_per_roll) || 0;
    const lprNum = parseFloat(f.length_per_roll) || 0;
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-indigo-600" /> Edit {kind === "sticker" ? "Sticker" : "Ribbon"} Receive
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Receive Date</Label><Input type="date" value={f.receive_date} onChange={(e) => setF({ ...f, receive_date: e.target.value })} /></div>
            <div><Label>SL</Label><Input value={f.sl_no} onChange={(e) => setF({ ...f, sl_no: e.target.value })} placeholder="Auto (leave blank)" /></div>
            <div><Label>Delivered By</Label><Input value={f.delivered_by} onChange={(e) => setF({ ...f, delivered_by: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })} /></div>
            <div><Label>Phone Number</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            {kind === "sticker" && (
              <div><Label>Sticker Size</Label><Input value={f.sticker_size} onChange={(e) => setF({ ...f, sticker_size: e.target.value })} placeholder="e.g. 50x30 mm" /></div>
            )}
            {kind === "sticker" ? (
              <>
                <div><Label>Receive Roll Qty</Label><Input type="number" value={f.roll} onChange={(e) => setF({ ...f, roll: e.target.value })} /></div>
                <div><Label>Pcs Per Roll</Label><Input type="number" value={f.pcs_per_roll} onChange={(e) => setF({ ...f, pcs_per_roll: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Total Pcs</Label><Input type="number" value={f.pcs} onChange={(e) => setF({ ...f, pcs: e.target.value })} placeholder={String((rollNum * pprNum) || "")} /></div>
              </>
            ) : (
              <>
                <div><Label>Receive Roll Qty</Label><Input type="number" value={f.roll} onChange={(e) => setF({ ...f, roll: e.target.value })} /></div>
                <div><Label>Length Per Roll</Label><Input type="number" value={f.length_per_roll} onChange={(e) => setF({ ...f, length_per_roll: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Total Length (Auto)</Label><Input value={(rollNum * lprNum) || ""} readOnly className="bg-muted font-semibold" /></div>
              </>
            )}
            <div className="sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-to-r from-indigo-500 to-purple-600">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {(() => {
          const issType: TxnType = mode === "damage"
            ? "sticker_damage"
            : kind === "sticker" ? "sticker_issue" : "ribbon_issue";
          const existingSls = allTxns
            .filter((t) => t.buyer_id === buyerId && t.type === issType)
            .map((t) => parseInt(String(t.sl_no || "0"), 10))
            .filter((n) => !isNaN(n));
          const nextSl = (existingSls.length ? Math.max(...existingSls) : 0) + 1;
          return (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sl Number</Label>
                <Input value={f.sl_no || String(nextSl)} onChange={(e) => setF({ ...f, sl_no: e.target.value })} placeholder={`Auto (${nextSl})`} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} />
              </div>
              {(kind === "ribbon" || mode !== "damage") && (
                <div><Label>Roll Quantity</Label><Input type="number" value={f.roll} onChange={(e) => setF({ ...f, roll: e.target.value })} /></div>
              )}
              {kind === "sticker" && (
                <div><Label>Pcs</Label><Input type="number" value={f.pcs} onChange={(e) => setF({ ...f, pcs: e.target.value })} /></div>
              )}
              <div className="col-span-2"><Label>Note</Label><Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
            </div>
          );
        })()}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const gradientToHex = (color: string): string => {
  const m = color.match(/from-([a-z]+)-(\d+)/);
  if (!m) return "#6366f1";
  const palette: Record<string, Record<string, string>> = {
    green: { "500": "#22c55e", "600": "#16a34a" },
    emerald: { "500": "#10b981", "600": "#059669" },
    orange: { "500": "#f97316", "600": "#ea580c" },
    red: { "500": "#ef4444", "600": "#dc2626" },
    rose: { "500": "#f43f5e", "600": "#e11d48" },
    indigo: { "500": "#6366f1", "600": "#4f46e5" },
    purple: { "500": "#a855f7", "600": "#9333ea" },
    pink: { "500": "#ec4899", "600": "#db2777" },
    fuchsia: { "500": "#d946ef", "600": "#c026d3" },
    amber: { "500": "#f59e0b", "600": "#d97706" },
    sky: { "500": "#0ea5e9", "600": "#0284c7" },
    blue: { "500": "#3b82f6", "600": "#2563eb" },
    teal: { "500": "#14b8a6", "600": "#0d9488" },
  };
  return palette[m[1]]?.[m[2]] || "#6366f1";
};
const StockStat = ({ label, value, icon: Icon, color, onClick }: { label: string; value: number; icon: any; color: string; onClick?: () => void }) => {
  const c = gradientToHex(color);
  return (
    <div
      onClick={onClick}
      style={{ borderColor: c, color: c }}
      className={`p-4 rounded-xl bg-card border-2 shadow-sm ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs opacity-80">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="w-8 h-8 opacity-80" />
      </div>
    </div>
  );
};

const ReportTable = ({ txns, totals }: { txns: Txn[]; totals: ReturnType<typeof buyerTotals> }) => (
  <Table>
    <TableHeader>
      <TableRow><TableHead>Item</TableHead><TableHead>Received</TableHead><TableHead>Issued</TableHead><TableHead>Damage</TableHead><TableHead>Balance</TableHead></TableRow>
    </TableHeader>
    <TableBody>
      <TableRow><TableCell>Sticker Roll</TableCell><TableCell>{totals.stickerRollRecv}</TableCell><TableCell>{totals.stickerRollIss}</TableCell><TableCell>-</TableCell><TableCell className="font-bold">{totals.stickerRoll}</TableCell></TableRow>
      <TableRow><TableCell>Sticker Pcs</TableCell><TableCell>{totals.stickerPcsRecv}</TableCell><TableCell>{totals.stickerPcsIss}</TableCell><TableCell>{totals.stickerPcsDmg}</TableCell><TableCell className="font-bold">{totals.stickerPcs}</TableCell></TableRow>
      <TableRow><TableCell>Ribbon Roll</TableCell><TableCell>{totals.ribbonRollRecv}</TableCell><TableCell>{totals.ribbonRollIss}</TableCell><TableCell>-</TableCell><TableCell className="font-bold">{totals.ribbonRoll}</TableCell></TableRow>
    </TableBody>
  </Table>
);

const HistoryTable = ({ txns }: { txns: Txn[] }) => {
  if (!txns.length) return <p className="text-center text-muted-foreground py-6">No transactions yet</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Po</TableHead><TableHead>Style</TableHead><TableHead>Roll No</TableHead><TableHead>Roll</TableHead><TableHead>Pcs</TableHead><TableHead>Note</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        {txns.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="text-xs">{new Date(t.date).toLocaleString()}</TableCell>
            <TableCell><Badge variant={t.type.endsWith("receive") ? "default" : "secondary"}>{LABEL[t.type]}</Badge></TableCell>
            <TableCell>{t.po_no || "-"}</TableCell>
            <TableCell>{t.style || "-"}</TableCell>
            <TableCell>{t.roll_no || "-"}</TableCell>
            <TableCell>{t.roll || "-"}</TableCell>
            <TableCell>{t.pcs || "-"}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{t.note || "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default StickerPrinter;