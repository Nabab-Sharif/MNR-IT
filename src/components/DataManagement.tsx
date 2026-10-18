import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import indexedDB from "@/services/indexedDBService";
import dbService from "@/services/dbService";
import { sendManyToRecycleBin } from "@/lib/recycleBin";
import { ALL_SOURCES, DataSource } from "@/lib/pageDataRegistry";
import { readSource, writeSource, downloadJSON, pickJSONFile } from "@/lib/dataIO";
import { Download, Upload, DatabaseBackup, Filter, Loader2, Trash2 } from "lucide-react";
import LocalToCloudMigrationButton from "./LocalToCloudMigrationButton";

const COLLECTION_MAP: Record<string, string> = {
  units: "Unit",
  departments: "Department",
  it_assets: "ITAsset",
  accessories: "Accessory",
  products: "Product",
  printers: "Printer",
  ip_addresses: "IPAddress",
  wifi_networks: "WifiNetwork",
  ip_phones: "IPPhone",
  nvrs: "NVR",
  cctv_cameras: "CCTVCamera",
  cctv_checklists: "CCTVChecklist",
};

const ENTITY_LABELS: Record<string, string> = {
  units: "Unit / Office", departments: "Department", it_assets: "IT Asset",
  accessories: "Accessory", products: "Product", printers: "Printer",
  ip_addresses: "IP Address", wifi_networks: "WiFi Network", ip_phones: "IP Phone",
  nvrs: "NVR", cctv_cameras: "CCTV Camera", cctv_checklists: "CCTV Checklist",
  switches: "Switch", switch_ports: "Switch Port", switch_locations: "Switch Location", switch_gates: "Switch Gate",
  sticker_buyers: "Sticker Buyer", sticker_transactions: "Sticker Transaction",
};

const itemUnit = (it: any): string => String(it?.unit_office ?? it?.unit ?? it?.unit_name ?? it?.office ?? "").trim();
const itemCreated = (it: any): number => {
  const v = it?.created_at ?? it?.createdAt ?? it?.date;
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
};

export default function DataManagement() {
  const [busy, setBusy] = useState(false);
  const [srcKey, setSrcKey] = useState<string>("it_assets");
  const [unitFilter, setUnitFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [softDelete, setSoftDelete] = useState(true);
  const [preview, setPreview] = useState<any[] | null>(null);

  const source: DataSource | undefined = useMemo(
    () => ALL_SOURCES.find((s) => s.store === srcKey),
    [srcKey]
  );

  const runPreview = async () => {
    if (!source) return;
    setBusy(true);
    try {
      const items = await readSource(source);
      const from = fromDate ? new Date(fromDate).getTime() : null;
      const to = toDate ? new Date(toDate).getTime() + 86400000 : null;
      const uf = unitFilter.trim().toLowerCase();
      const matched = items.filter((it) => {
        if (uf && !itemUnit(it).toLowerCase().includes(uf)) return false;
        if (from || to) {
          const t = itemCreated(it);
          if (!Number.isFinite(t)) return false;
          if (from && t < from) return false;
          if (to && t > to) return false;
        }
        return true;
      });
      setPreview(matched);
      toast.success(`${matched.length} record(s) match — review then confirm delete`);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const runDelete = async () => {
    if (!source || !preview) return;
    setBusy(true);
    try {
      const itemsWithIds = preview.filter((it) => it?.id != null);
      if (softDelete) {
        await sendManyToRecycleBin(preview.map((it) => ({
            entity: ENTITY_LABELS[source.store] || source.store,
            entity_id: it?.id ? String(it.id) : null,
            entity_label: String(it?.name ?? it?.title ?? it?.label ?? it?.id ?? ""),
            collection: COLLECTION_MAP[source.store],
            payload: it,
          })));
      }
      if (source.kind === "cloud") {
        const ids = itemsWithIds.map((it) => it.id);
        if (ids.length > 0) {
          const { error } = await supabase.from(source.store as any).delete().in("id", ids);
          if (error) throw error;
        }
      } else {
        const ids = itemsWithIds.map((it) => it.id);
        if (source.store === "it_assets") {
          await (dbService as any).bulkDeleteITAssets(ids);
        } else {
          await (indexedDB as any).bulkDelete(source.store, ids);
        }
      }
      toast.success(`Successfully deleted all ${itemsWithIds.length} record(s) at once${softDelete ? " and sent to Recycle Bin" : ""}`);
      setPreview(null);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const bundle: Record<string, any[]> = {};
      for (const s of ALL_SOURCES) {
        try { bundle[s.store] = await readSource(s); } catch { bundle[s.store] = []; }
      }
      const meta = { exported_at: new Date().toISOString(), stores: Object.keys(bundle), version: 1 };
      downloadJSON(`mnr-full-export_${new Date().toISOString().slice(0, 10)}.json`, { meta, data: bundle });
      toast.success("Full site data exported");
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const importAll = async () => {
    const raw = await pickJSONFile();
    if (!raw) return;
    const bundle: Record<string, any[]> | null =
      raw?.data && typeof raw.data === "object" ? raw.data : (typeof raw === "object" && !Array.isArray(raw)) ? raw : null;
    if (!bundle) { toast.error("File must be a full-export JSON"); return; }
    if (!confirm("Import will REPLACE existing data for every store in the file. Continue?")) return;
    setBusy(true);
    let total = 0, stores = 0;
    try {
      for (const s of ALL_SOURCES) {
        const items = bundle[s.store];
        if (!Array.isArray(items)) continue;
        try { total += await writeSource(s, items, "replace"); stores++; } catch { /* keep going */ }
      }
      toast.success(`Imported ${total} records across ${stores} stores. Reload to see changes.`);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  return (
    <Card id="data-management" className="border-2 border-violet-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DatabaseBackup className="w-4 h-4 text-sky-500" /> Data Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Full export/import */}
        <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full Site Backup</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportAll} disabled={busy} variant="outline">
              <Download className="w-4 h-4 mr-1.5 text-emerald-600" /> Export Full Data (JSON)
            </Button>
            <Button onClick={importAll} disabled={busy} variant="outline">
              <Upload className="w-4 h-4 mr-1.5 text-sky-600" /> Import Full Data (JSON)
            </Button>
            <LocalToCloudMigrationButton />
          </div>
        </div>

        {/* Filtered delete */}
        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filtered Delete
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Entity</Label>
              <Select value={srcKey} onValueChange={(v) => { setSrcKey(v); setPreview(null); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {ALL_SOURCES.map((s) => (
                    <SelectItem key={s.store} value={s.store}>
                      {ENTITY_LABELS[s.store] || s.store} {s.kind === "cloud" ? "· cloud" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unit / Office contains</Label>
              <Input value={unitFilter} onChange={(e) => { setUnitFilter(e.target.value); setPreview(null); }} placeholder="e.g. Unit-01" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From (created)</Label>
              <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPreview(null); }} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To (created)</Label>
              <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPreview(null); }} className="h-9" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={softDelete} onCheckedChange={(v) => setSoftDelete(!!v)} />
            <span>Send to Recycle Bin (soft delete — can be restored)</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runPreview} disabled={busy} variant="outline">
              {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Filter className="w-4 h-4 mr-1.5" />}
              Preview Matches
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={busy || !preview || preview.length === 0}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete {preview?.length ?? 0} matched
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {preview?.length ?? 0} {ENTITY_LABELS[srcKey] || srcKey}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {softDelete
                      ? "Items will be moved to the Recycle Bin and can be restored."
                      : "This is a HARD delete and cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={runDelete}>Confirm Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {preview && preview.length > 0 && (
            <div className="rounded-md border max-h-56 overflow-y-auto text-xs">
              <div className="sticky top-0 bg-muted/70 backdrop-blur px-2 py-1 font-semibold">Preview ({preview.length})</div>
              <ul className="divide-y">
                {preview.slice(0, 200).map((it, i) => (
                  <li key={i} className="px-2 py-1 flex justify-between gap-2">
                    <span className="truncate">{String(it?.name ?? it?.title ?? it?.label ?? it?.id ?? "(no name)")}</span>
                    <span className="text-muted-foreground truncate">{itemUnit(it)}</span>
                  </li>
                ))}
                {preview.length > 200 && (
                  <li className="px-2 py-1 text-muted-foreground text-center">…and {preview.length - 200} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}