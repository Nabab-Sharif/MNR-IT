import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import ReactCrop, { type Crop, type PixelCrop, convertToPixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, Scissors, Download, Trash2, Loader2, Plus, Printer, Folder as FolderIcon, FolderPlus, FolderOpen, FolderInput, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, RotateCcw, AlertCircle, MoreVertical, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import dbService from "@/services/indexedDBService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PermGate from "@/components/PermGate";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Zone = PixelCrop;
type SourceType = "pdf" | "image";
type PdfPreviewPage = { src: string; width: number; height: number };
type Batch = { id: string; name: string; pages: string[]; sourceTypes?: SourceType[]; createdAt: number; seq?: number; croppedAt?: number; pdfDataUrl?: string; pdfBlob?: Blob; pdfPages?: PdfPreviewPage[]; folderId?: string | null; text?: string; zones?: (Zone | null)[] };
type Folder = { id: string; name: string; createdAt: number };
const FOLDERS_KEY = "crop_folders_v1";

const zoneColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#0ea5e9", "#f97316"];
const zoneLabel = (i: number) => `Crop-${i + 1}`;
const PDF_RENDER_SCALE = 4;
const MAX_PDF_IMAGE_DIMENSION = 2200;
const PDF_IMAGE_QUALITY = 0.9;
const hasCropSize = (crop?: Partial<Crop> | Partial<PixelCrop> | null) =>
  Number(crop?.width) > 0 && Number(crop?.height) > 0;
const getBatchPdfSource = (batch?: Batch | null) => batch?.pdfBlob || batch?.pdfDataUrl || null;
const hasBatchPdfPreview = (batch?: Batch | null) => !!getBatchPdfSource(batch);

const CropTool = () => {
  const [pages, setPages] = useState<string[]>([]);
  const [sourceTypes, setSourceTypes] = useState<SourceType[]>([]);
  const [activeZone, setActiveZone] = useState(0);
  const [zones, setZones] = useState<(Zone | null)[]>([null, null, null, null]);
  const [crops, setCrops] = useState<(Crop | undefined)[]>([undefined, undefined, undefined]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [failed, setFailed] = useState<{ page: number; zone?: number; error: string }[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<"all" | "cropped" | "uncropped">("all");
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [previewBatch, setPreviewBatch] = useState<Batch | null>(null);
  const [zoneSaveStatus, setZoneSaveStatus] = useState<"idle" | "saving" | "saved" | "restored">("idle");
  const imgRef = useRef<HTMLImageElement>(null);
  const [folders, setFolders] = useState<Folder[]>(() => {
    try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]"); } catch { return []; }
  });
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); }, [folders]);
  const createFolder = (name: string) => {
    const n = name.trim();
    if (!n) return;
    setFolders((p) => [...p, { id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: n, createdAt: Date.now() }]);
  };
  const createDateFolder = () => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const parent = folders.find((f) => f.id === currentFolder);
    const name = parent ? `${parent.name} / ${dateStr}` : dateStr;
    const existing = folders.find((f) => f.name === name);
    if (existing) {
      setCurrentFolder(existing.id);
      toast.success(`Opened folder ${name}`);
      return;
    }
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFolders((p) => [...p, { id, name, createdAt: Date.now() }]);
    setCurrentFolder(id);
    toast.success(`Created date folder ${name}`);
  };
  const deleteFolder = async (id: string) => {
    // move batches in folder back to root
    const affected = batches.filter((b) => b.folderId === id);
    for (const b of affected) {
      await dbService.put("crop_batches", { ...b, folderId: null });
    }
    setFolders((p) => p.filter((f) => f.id !== id));
    if (currentFolder === id) setCurrentFolder(null);
    await loadBatches();
  };
  const renameFolder = (id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    setFolders((p) => p.map((f) => (f.id === id ? { ...f, name: n } : f)));
  };
  const moveBatchToFolder = async (batchId: string, folderId: string | null) => {
    const b = batches.find((x) => x.id === batchId);
    if (!b) return;
    await dbService.put("crop_batches", { ...b, folderId });
    await loadBatches();
    toast.success(folderId ? "Moved to folder" : "Moved to root");
  };
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const on = () => setResizeTick((t) => t + 1);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const loadBatches = async () => {
    try {
      const all = (await dbService.getAll("crop_batches")) as Batch[];
      setBatches(all.sort((a, b) => (a.seq ?? a.createdAt) - (b.seq ?? b.createdAt)));
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => { loadBatches(); }, []);

  // Persist crop zones per batch to IndexedDB so they survive reloads
  useEffect(() => {
    if (!activeBatchId) return;
    setZoneSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        const cur = batches.find((x) => x.id === activeBatchId);
        if (!cur) return;
        const updated = { ...cur, zones };
        await dbService.put("crop_batches", updated);
        setBatches((prev) => prev.map((b) => (b.id === activeBatchId ? updated : b)));
        setZoneSaveStatus("saved");
        setTimeout(() => setZoneSaveStatus("idle"), 1200);
      } catch (e) { console.error(e); setZoneSaveStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [zones, activeBatchId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const uploadName = Array.from(files).map((f) => f.name).join(", ").slice(0, 80);
    const duplicate = batches.find(
      (b) => (b.folderId ?? null) === (currentFolder ?? null) && b.name === uploadName,
    );
    if (duplicate) {
      toast.custom((id) => (
        <div className="flex items-start gap-3 rounded-xl border-2 border-destructive/60 bg-card shadow-lg p-4 pr-6 min-w-[320px] max-w-md animate-in slide-in-from-top-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-destructive">Duplicate file</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              A file with the same name already exists in this folder:
            </div>
            <div className="text-sm font-medium mt-1 truncate capitalize" title={duplicate.name}>
              "{duplicate.name}"
            </div>
          </div>
          <button
            onClick={() => toast.dismiss(id)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ), { duration: 5000 });
      return;
    }
    setBusy(true);
    const collected: string[] = [];
    const collectedTypes: SourceType[] = [];
    const names: string[] = [];
    const textChunks: string[] = [];
    try {
      for (const f of Array.from(files)) {
        names.push(f.name);
        if (f.type === "application/pdf") {
          const buf = await f.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            try {
              const tc = await page.getTextContent();
              const t = tc.items.map((it: any) => it.str || "").join(" ");
              if (t.trim()) textChunks.push(t);
            } catch {}
            const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            collected.push(canvas.toDataURL("image/png"));
            collectedTypes.push("pdf");
          }
        } else if (f.type.startsWith("image/")) {
          const url = await new Promise<string>((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.readAsDataURL(f);
          });
          collected.push(url);
          collectedTypes.push("image");
        }
      }
      if (!collected.length) { toast.error("No valid pages"); return; }
      // Scanned-PDF fallback: if native text extraction was minimal, OCR every page (digits-only)
      let ocrText = "";
      const cleaned = textChunks.join(" ").replace(/\s+/g, " ").trim();
      if (cleaned.length < 50) {
        try {
          const { recognize } = await import("tesseract.js");
          const parts: string[] = [];
          for (const url of collected) {
            try {
              const res = await recognize(url, "eng", {
                // @ts-ignore
                tessedit_char_whitelist: "0123456789",
              } as any);
              const t = (res?.data?.text || "").replace(/\s+/g, " ").trim();
              if (t) parts.push(t);
            } catch {}
          }
          ocrText = parts.join(" \n ");
        } catch {}
      }
      const batch: Batch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: names.join(", ").slice(0, 80),
        pages: collected,
        sourceTypes: collectedTypes,
        createdAt: Date.now(),
        seq: (batches.reduce((m, b) => Math.max(m, b.seq ?? 0), 0)) + 1,
        folderId: currentFolder,
        text: [textChunks.join(" \n "), ocrText].filter(Boolean).join(" \n ").slice(0, 20000),
      };
      await dbService.put("crop_batches", batch);
      await loadBatches();
      setActiveBatchId(batch.id);
      setPages(collected);
      setSourceTypes(collectedTypes);
      setZones([null, null, null]);
      setCrops([undefined, undefined, undefined]);
      toast.success(`Saved batch with ${collected.length} pages`);
    } catch (e: any) {
      toast.error("Failed to load: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const openBatch = (b: Batch) => {
    setActiveBatchId(b.id);
    setPages(b.pages);
    setSourceTypes(b.sourceTypes ?? b.pages.map(() => "pdf"));
    const savedZones = b.zones && b.zones.length ? b.zones : [null, null, null];
    setZones(savedZones);
    setCrops(savedZones.map(() => undefined));
    setProgress(0);
    setFailed([]);
    if (b.zones && b.zones.some((z) => hasCropSize(z))) {
      setZoneSaveStatus("restored");
      setTimeout(() => setZoneSaveStatus("idle"), 1500);
    }
  };

  const deleteBatch = async (id: string) => {
    try {
      await dbService.delete("crop_batches", id);
      if (activeBatchId === id) {
        setActiveBatchId(null);
        setPages([]);
      }
      await loadBatches();
      toast.success("Batch deleted");
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    }
  };

  const commitZone = (c: Crop) => {
    if (!imgRef.current || !c.width || !c.height) return;
    const img = imgRef.current;
    const displayed = c.unit === "%" ? convertToPixelCrop(c, img.width, img.height) : (c as PixelCrop);
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    let pixel: PixelCrop = {
      unit: "px",
      x: displayed.x * scaleX,
      y: displayed.y * scaleY,
      width: displayed.width * scaleX,
      height: displayed.height * scaleY,
    };
    setZones((prev) => {
      const next = [...prev];
      next[activeZone] = pixel;
      return next;
    });
  };

  // When switching to any empty zone, auto-fill it with the first saved zone's size (resizable)
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.width || !img.height || !img.naturalWidth || !img.naturalHeight) return;
    if (hasCropSize(zones[activeZone])) return;
    const ref = zones.find((z, i) => i !== activeZone && hasCropSize(z)) as PixelCrop | undefined;
    if (!ref) return;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const dispW = ref.width / scaleX;
    const dispH = ref.height / scaleY;
    // Find a spot that doesn't overlap existing zones by scanning left-to-right, top-to-bottom
    const existing = zones
      .map((z, i) => (i !== activeZone && hasCropSize(z) ? (z as PixelCrop) : null))
      .filter(Boolean) as PixelCrop[];
    const overlaps = (px: number, py: number) =>
      existing.some((e) => {
        const ex = e.x / scaleX;
        const ey = e.y / scaleY;
        const ew = e.width / scaleX;
        const eh = e.height / scaleY;
        return px < ex + ew && px + dispW > ex && py < ey + eh && py + dispH > ey;
      });
    const maxX = Math.max(0, img.width - dispW);
    const maxY = Math.max(0, img.height - dispH);
    const step = 8;
    let x = Math.min(maxX, (img.width - dispW) / 2);
    let y = Math.min(maxY, (img.height - dispH) / 2);
    let found = !overlaps(x, y);
    if (!found) {
      outer: for (let py = 0; py <= maxY; py += step) {
        for (let px = 0; px <= maxX; px += step) {
          if (!overlaps(px, py)) { x = px; y = py; found = true; break outer; }
        }
      }
    }
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    const dispCrop: PixelCrop = { unit: "px", x, y, width: dispW, height: dispH };
    setCrops((prev) => { const n = [...prev]; n[activeZone] = dispCrop; return n; });
    setZones((prev) => {
      const n = [...prev];
      n[activeZone] = { unit: "px", x: x * scaleX, y: y * scaleY, width: ref.width, height: ref.height };
      return n;
    });
  }, [activeZone, zones, pages, imgNatural]);

  const cropAllAndDownload = useCallback(async () => {
    if (!pages.length) return toast.error("Upload pages first");
    if (!zones.length || zones.some((z) => !hasCropSize(z))) return toast.error("Set all crop zones on page 1");
    setBusy(true);
    setProgress(0);
    setFailed([]);
    setStatusMsg("Starting…");
    const errors: { page: number; zone?: number; error: string }[] = [];
    let successCount = 0;
    const allImages = sourceTypes.length === pages.length && sourceTypes.every((t) => t === "image");
    try {
      let pdf: jsPDF | null = null;
      let firstAdded = false;
      const zip = allImages ? new JSZip() : null;
      const pdfPages: PdfPreviewPage[] = [];
      for (let i = 0; i < pages.length; i++) {
        setStatusMsg(`Processing page ${i + 1} of ${pages.length}…`);
        let img: HTMLImageElement;
        try {
          img = await new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("Image failed to load"));
            im.src = pages[i];
          });
        } catch (e: any) {
          errors.push({ page: i + 1, error: e.message || "Load failed" });
          setProgress(Math.round(((i + 1) / pages.length) * 100));
          continue;
        }
        // Build one PDF page per source page containing ALL crops stacked vertically
        const crops: { dataUrl: string; w: number; h: number }[] = [];
        for (let z = 0; z < zones.length; z++) {
          try {
            const zone = zones[z]!;
            const sx = Math.max(0, Math.round(zone.x));
            const sy = Math.max(0, Math.round(zone.y));
            const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(zone.width)));
            const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(zone.height)));
            const scale = zip ? 1 : Math.min(1, MAX_PDF_IMAGE_DIMENSION / Math.max(sw, sh));
            const outW = Math.max(1, Math.round(sw * scale));
            const outH = Math.max(1, Math.round(sh * scale));
            const c = document.createElement("canvas");
            c.width = outW;
            c.height = outH;
            const ctx = c.getContext("2d");
            if (!ctx) throw new Error("Canvas context unavailable");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.imageSmoothingEnabled = scale < 1;
            if (scale < 1) ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
            crops.push({ dataUrl: zip ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", PDF_IMAGE_QUALITY), w: c.width, h: c.height });
          } catch (e: any) {
            errors.push({ page: i + 1, zone: z + 1, error: e.message || "Crop failed" });
          }
        }
        // Output per crop — keep source format: image→image (zip), pdf→pdf page
        for (let ci = 0; ci < crops.length; ci++) {
          const cr = crops[ci];
          if (zip) {
            const b64 = cr.dataUrl.split(",")[1];
            zip.file(`page-${i + 1}-crop-${ci + 1}.png`, b64, { base64: true });
            firstAdded = true;
            successCount++;
            continue;
          }
          const orient = cr.w >= cr.h ? "landscape" : "portrait";
          if (!pdf) {
            pdf = new jsPDF({
              unit: "px",
              format: [cr.w, cr.h],
              orientation: orient,
              hotfixes: ["px_scaling"],
              compress: true,
            });
          } else {
            pdf.addPage([cr.w, cr.h], orient);
          }
          const pW = pdf.internal.pageSize.getWidth();
          const pH = pdf.internal.pageSize.getHeight();
          pdf.addImage(cr.dataUrl, "JPEG", 0, 0, pW, pH, undefined, "FAST");
          pdfPages.push({ src: cr.dataUrl, width: cr.w, height: cr.h });
          firstAdded = true;
          successCount++;
        }
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }
      if (!firstAdded) throw new Error("No crops were produced");
      if (zip) {
        setStatusMsg("Building ZIP…");
        if (successCount === 1) {
          // single image: download directly as PNG instead of a zip
          const only = Object.values((zip as any).files)[0] as any;
          const b64 = await only.async("base64");
          const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
          saveAs(blob, `crop-${Date.now()}.png`);
        } else {
          const blob = await zip.generateAsync({ type: "blob" });
          saveAs(blob, `crops-${Date.now()}.zip`);
        }
        if (activeBatchId) {
          const cur = batches.find((x) => x.id === activeBatchId);
          if (cur) {
            await dbService.put("crop_batches", { ...cur, croppedAt: Date.now(), zones });
            await loadBatches();
          }
        }
      } else if (pdf) {
        setStatusMsg("Building PDF…");
        const blob = pdf.output("blob");
        saveAs(blob, `crops-${Date.now()}.pdf`);
        if (activeBatchId) {
          const cur = batches.find((x) => x.id === activeBatchId);
          if (cur) {
            const updated: Batch = { ...cur, croppedAt: Date.now(), pdfBlob: blob, pdfDataUrl: undefined, pdfPages, zones };
            await dbService.put("crop_batches", updated);
            await loadBatches();
            setPreviewBatch(updated);
          }
        }
      }
      setFailed(errors);
      if (errors.length) {
        toast.warning(`Done: ${successCount} exported, ${errors.length} failed`);
      } else {
        toast.success(zip ? `Downloaded ${successCount} image${successCount === 1 ? "" : "s"}` : `Downloaded PDF with ${successCount} page${successCount === 1 ? "" : "s"}`);
      }
      setStatusMsg(`Complete — ${successCount} exported${errors.length ? `, ${errors.length} failed` : ""}`);
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "Unknown error"));
      setStatusMsg("Failed: " + (e.message || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }, [pages, zones, sourceTypes, activeBatchId, batches]);

  const reset = () => {
    setPages([]);
    setSourceTypes([]);
    setZones([null, null, null]);
    setActiveZone(0);
    setCrops([undefined, undefined, undefined]);
    setProgress(0);
    setFailed([]);
    setStatusMsg("");
  };

  const previewPdfSource = getBatchPdfSource(previewBatch);

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {!currentFolder && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Scissors className="w-6 h-6 text-emerald-500" /> Batch Crop Tool
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">
                  {
                    folders.filter((f) => {
                      const name = f.name.trim();
                      if (/\d{4}-\d{2}-\d{2}$/.test(name)) return false;
                      const hasSubDate = folders.some((s) => s.name.trim().startsWith(`${name} / `));
                      const hasBatch = batches.some((b) => b.folderId === f.id);
                      return hasSubDate || hasBatch;
                    }).length
                  }
                </span>{" "}
                buyer(s)
              </p>
            </div>
          </div>
        </div>
      )}

      {pages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>{pages.length} page(s) loaded</Badge>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        </div>
      )}

      <BatchLibrary
          batches={batches}
          activeBatchId={activeBatchId}
          search={batchSearch}
          setSearch={setBatchSearch}
          filter={batchFilter}
          setFilter={setBatchFilter}
          onOpen={openBatch}
          onDelete={deleteBatch}
          onPreview={setPreviewBatch}
          folders={folders}
          currentFolder={currentFolder}
          setCurrentFolder={setCurrentFolder}
          onCreateFolder={createFolder}
          onCreateDateFolder={createDateFolder}
          onDeleteFolder={deleteFolder}
          onRenameFolder={renameFolder}
          onMoveBatch={moveBatchToFolder}
          onUpload={(files) => handleFiles(files)}
        />

      {pages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <Scissors className="w-4 h-4 shrink-0" />
                <span className="truncate">Step 2: Define Crop Zones on Page 1 ({zones.length})</span>
                {zoneSaveStatus !== "idle" && (
                  <span
                    className={`ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      zoneSaveStatus === "saving"
                        ? "border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                        : zoneSaveStatus === "saved"
                        ? "border-emerald-400/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-sky-400/40 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                    }`}
                  >
                    {zoneSaveStatus === "saving" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {zoneSaveStatus === "saving" ? "Saving zones…" : zoneSaveStatus === "saved" ? "Zones saved" : "Zones restored"}
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={reset} disabled={busy}><Trash2 className="w-4 h-4 mr-1" /> Reset</Button>
                <Button size="sm" onClick={cropAllAndDownload} disabled={busy || !pages.length || zones.some((z) => !hasCropSize(z))}>
                  {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                  <span className="hidden sm:inline">Crop All & Download</span><span className="sm:hidden">Crop All</span>{progress > 0 && busy ? ` (${progress}%)` : ""}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              {(() => null)()}
              {(() => {
                const refZone = zones.find((z) => hasCropSize(z)) as PixelCrop | undefined;
                const refW = refZone ? Math.round(refZone.width) : 0;
                const refH = refZone ? Math.round(refZone.height) : 0;
                const applyZoneSize = (i: number, w: number, h: number) => {
                  const img = imgRef.current;
                  if (!img || !img.width || !img.height || !img.naturalWidth || !img.naturalHeight) return;
                  if (!w || !h || w < 1 || h < 1) return;
                  const scaleX = img.naturalWidth / img.width;
                  const scaleY = img.naturalHeight / img.height;
                  const existing = zones[i] as PixelCrop | null | undefined;
                  const natX = existing ? existing.x : 0;
                  const natY = existing ? existing.y : 0;
                  const clampedW = Math.min(w, img.naturalWidth);
                  const clampedH = Math.min(h, img.naturalHeight);
                  const nx = Math.max(0, Math.min(natX, img.naturalWidth - clampedW));
                  const ny = Math.max(0, Math.min(natY, img.naturalHeight - clampedH));
                  setZones((prev) => {
                    const n = [...prev];
                    n[i] = { unit: "px", x: nx, y: ny, width: clampedW, height: clampedH };
                    return n;
                  });
                  setCrops((prev) => {
                    const n = [...prev];
                    n[i] = { unit: "px", x: nx / scaleX, y: ny / scaleY, width: clampedW / scaleX, height: clampedH / scaleY };
                    return n;
                  });
                };
                return zones.map((z, i) => {
                  const w = z ? Math.round(z.width) : 0;
                  const h = z ? Math.round(z.height) : 0;
                  const matches = !!z && !!refZone && w === refW && h === refH;
                  const color = zoneColors[i % zoneColors.length];
                  return (
                    <div key={i} className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={activeZone === i ? "default" : "outline"}
                        onClick={() => setActiveZone(i)}
                        style={activeZone === i ? { backgroundColor: color } : { borderColor: color, color }}
                      >
                        {zoneLabel(i)}
                        {z ? (
                          <span
                            className="ml-1.5 text-[10px] font-mono px-1 rounded"
                            style={{
                              backgroundColor: matches ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                              color: activeZone === i ? "#fff" : matches ? "#10b981" : "#ef4444",
                            }}
                          >
                            {w}×{h}{matches ? " ✓" : " !"}
                          </span>
                        ) : null}
                      </Button>
                      <input
                        type="number"
                        min={1}
                        value={w || ""}
                        placeholder={refW ? String(refW) : "W"}
                        onChange={(e) => applyZoneSize(i, Number(e.target.value), h || refH || Number(e.target.value))}
                        className="h-8 w-16 rounded border border-input bg-background px-1.5 text-xs"
                        title="Width (px)"
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <input
                        type="number"
                        min={1}
                        value={h || ""}
                        placeholder={refH ? String(refH) : "H"}
                        onChange={(e) => applyZoneSize(i, w || refW || Number(e.target.value), Number(e.target.value))}
                        className="h-8 w-16 rounded border border-input bg-background px-1.5 text-xs"
                        title="Height (px)"
                      />
                      {refZone && !matches && z ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-[11px]"
                          onClick={() => applyZoneSize(i, refW, refH)}
                          title={`Match ${refW}×${refH}`}
                        >
                          = ref
                        </Button>
                      ) : null}
                    </div>
                  );
                });
              })()}
              <Button size="sm" variant="outline" onClick={() => { setZones((p) => [...p, null]); setCrops((p) => [...p, undefined]); setActiveZone(zones.length); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Zone
              </Button>
              {zones.length > 1 && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                  setZones((p) => p.filter((_, i) => i !== activeZone));
                  setCrops((p) => p.filter((_, i) => i !== activeZone));
                  setActiveZone((a) => Math.max(0, a - 1));
                }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remove Active
                </Button>
              )}
              <span className="text-xs text-muted-foreground w-full sm:w-auto sm:ml-2">Drag on the image — auto-saves to active zone.</span>
            </div>
            <div className="border rounded-lg overflow-auto max-h-[80vh] bg-muted/30 flex justify-center">
              <div className="relative w-full">
                <ReactCrop
                  key={activeZone}
                  crop={crops[activeZone]}
                  onChange={(c) => setCrops((prev) => { const n = [...prev]; n[activeZone] = c; return n; })}
                  onComplete={(c) => commitZone(c)}
                  className="!w-full"
                >
                  <img
                    ref={imgRef}
                    src={pages[0]}
                    alt="page 1"
                    style={{ width: "100%", height: "auto", display: "block" }}
                    onLoad={(e) => {
                      const t = e.currentTarget;
                      setImgNatural({ w: t.naturalWidth, h: t.naturalHeight });
                    }}
                  />
                </ReactCrop>
                {imgNatural && zones.map((z, i) => {
                  if (!z || i === activeZone) return null;
                  const color = zoneColors[i % zoneColors.length];
                  const img = imgRef.current;
                  if (!img || !img.width || !img.height) return null;
                  const sx = img.width / imgNatural.w;
                  const sy = img.height / imgNatural.h;
                  return (
                    <div
                      key={i}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${z.x * sx + img.offsetLeft}px`,
                        top: `${z.y * sy + img.offsetTop}px`,
                        width: `${z.width * sx}px`,
                        height: `${z.height * sy}px`,
                        border: `2px dashed ${color}`,
                        background: `${color}22`,
                        boxShadow: `0 0 0 1px ${color}55 inset`,
                        zIndex: 5,
                      }}
                    >
                      <span
                        className="absolute top-0 left-0 text-[10px] font-bold px-1 rounded-br"
                        style={{ background: color, color: "#fff" }}
                      >
                        {zoneLabel(i)} ✓
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 text-xs">
              {zones.map((z, i) => (
                <div key={i} className="border rounded p-2" style={{ borderColor: zoneColors[i % zoneColors.length] }}>
                  <div className="font-semibold" style={{ color: zoneColors[i % zoneColors.length] }}>{zoneLabel(i)}</div>
                  {z ? (
                    <div className="text-muted-foreground mt-1">
                      X:{Math.round(z.x)} Y:{Math.round(z.y)}<br />
                      W:{Math.round(z.width)} H:{Math.round(z.height)}
                    </div>
                  ) : <div className="text-muted-foreground mt-1">Not set</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Pages ({pages.length}) — same {zones.length} crop{zones.length !== 1 ? "s" : ""} auto-apply to every page</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {pages.map((src, i) => (
                <div key={i} className="border rounded-md overflow-hidden bg-muted/30">
                  <img src={src} alt={`page ${i + 1}`} className="w-full h-32 object-contain" loading="lazy" />
                  <div className="text-[10px] text-center py-1 bg-background border-t">Page {i + 1}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(busy || progress > 0 || failed.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Batch Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{statusMsg || (progress === 100 ? "Complete" : "Idle")}</span>
              <Badge variant="outline">{progress}%</Badge>
            </div>
            {failed.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <div className="text-sm font-semibold text-destructive mb-1">
                  {failed.length} failure(s)
                </div>
                <ul className="text-xs text-destructive/90 space-y-0.5 max-h-40 overflow-auto">
                  {failed.map((f, i) => (
                    <li key={i}>Page {f.page}{f.zone ? ` · Zone ${f.zone}` : ""}: {f.error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!previewBatch} onOpenChange={(o) => !o && setPreviewBatch(null)}>
        <DialogContent className="max-w-6xl w-[calc(100vw-0.5rem)] sm:w-[95vw] h-[95vh] sm:h-[90vh] flex flex-col p-2 sm:p-4">
          <DialogHeader>
            <DialogTitle className="truncate text-sm sm:text-base">
              Cropped PDF — #{previewBatch?.seq} {previewBatch?.name}
            </DialogTitle>
          </DialogHeader>
          {previewPdfSource ? (
            <CroppedPdfViewer key={previewBatch?.id} source={previewPdfSource} previewPages={previewBatch?.pdfPages} name={previewBatch?.name || "Cropped PDF"} />
          ) : previewBatch ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <p>PDF preview missing — crop again to create a new printable PDF.</p>
              <Button size="sm" onClick={() => { openBatch(previewBatch); setPreviewBatch(null); }}>
                <Scissors className="w-4 h-4 mr-1" /> Re-crop to generate PDF
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CropTool;

type LibProps = {
  batches: Batch[];
  activeBatchId: string | null;
  search: string;
  setSearch: (s: string) => void;
  filter: "all" | "cropped" | "uncropped";
  setFilter: (f: "all" | "cropped" | "uncropped") => void;
  onOpen: (b: Batch) => void;
  onDelete: (id: string) => void;
  onPreview: (b: Batch) => void;
  folders: Folder[];
  currentFolder: string | null;
  setCurrentFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => void;
  onCreateDateFolder: () => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onMoveBatch: (batchId: string, folderId: string | null) => void;
  onUpload: (files: FileList | null) => void;
};

const pdfSourceToBlobUrl = (source: string | Blob) => {
  if (source instanceof Blob) return URL.createObjectURL(source);
  const [head, b64] = source.split(",");
  const mime = head.match(/data:(.*?);/)?.[1] || "application/pdf";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
};

const pdfSourceToBytes = async (source: string | Blob) => {
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
  const base64 = source.split(",")[1] || "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const openPdfAndPrint = (source: string | Blob, name: string) => {
  const url = pdfSourceToBlobUrl(source);
  const w = window.open(url, "_blank");
  if (!w) { URL.revokeObjectURL(url); return toast.error("Popup blocked — please allow popups"); }
  try { w.document.title = name || "Cropped PDF"; } catch {}
  w.addEventListener("load", () => { try { w.print(); } catch {} });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

const parsePageRanges = (input: string, max: number): number[] => {
  const s = input.trim();
  if (!s) return Array.from({ length: max }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of s.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) continue;
    const a = Math.max(1, Math.min(max, parseInt(m[1], 10)));
    const b = m[2] ? Math.max(1, Math.min(max, parseInt(m[2], 10))) : a;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    for (let i = lo; i <= hi; i++) out.add(i);
  }
  return Array.from(out).sort((x, y) => x - y);
};

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const compactSearchText = (value: string) => normalizeSearchText(value).replace(/[^\p{L}\p{N}]+/gu, "");
const digitSearchText = (value: string) => value.replace(/\D+/g, "");
const textMatchesQuery = (text: string | undefined, query: string) => {
  const q = query.trim();
  if (!q || !text) return false;
  if (/^\d+$/.test(q)) return digitSearchText(text).includes(q);
  const normalizedQuery = normalizeSearchText(q);
  const normalizedText = normalizeSearchText(text);
  return normalizedText.includes(normalizedQuery) || compactSearchText(text).includes(compactSearchText(q));
};

const loadOcrImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("OCR image failed to load"));
  img.src = src;
});

const rotateImageForOcr = async (src: string, degrees: number) => {
  const img = await loadOcrImage(src);
  const normalized = ((degrees % 360) + 360) % 360;
  const sideways = normalized === 90 || normalized === 270;
  const width = sideways ? img.naturalHeight : img.naturalWidth;
  const height = sideways ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OCR canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL("image/jpeg", PDF_IMAGE_QUALITY);
};

const buildDigitOcrSources = async (src: string) => {
  const rotated = await Promise.all([90, 270, 180].map((degrees) => rotateImageForOcr(src, degrees)));
  return [src, ...rotated];
};

const CroppedPdfViewer = ({ source, previewPages, name }: { source: string | Blob; previewPages?: PdfPreviewPage[]; name: string }) => {
  const [pageImgs, setPageImgs] = useState<PdfPreviewPage[]>(() => previewPages || []);
  const [loading, setLoading] = useState(!previewPages?.length);
  const [query, setQuery] = useState("");
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrError, setOcrError] = useState("");
  const [ocrIndexedAt, setOcrIndexedAt] = useState<number | null>(null);
  const autoOcrRef = useRef(false);
  type OcrMode = "full" | "digits" | "alnum" | "custom";
  const [ocrMode, setOcrMode] = useState<OcrMode>(() => (localStorage.getItem("crop_ocr_mode") as OcrMode) || "full");
  const [ocrLang, setOcrLang] = useState<string>(() => localStorage.getItem("crop_ocr_lang") || "eng");
  const [ocrCustom, setOcrCustom] = useState<string>(() => localStorage.getItem("crop_ocr_custom") || "");
  useEffect(() => { localStorage.setItem("crop_ocr_mode", ocrMode); }, [ocrMode]);
  useEffect(() => { localStorage.setItem("crop_ocr_lang", ocrLang); }, [ocrLang]);
  useEffect(() => { localStorage.setItem("crop_ocr_custom", ocrCustom); }, [ocrCustom]);
  const [printOpen, setPrintOpen] = useState(false);
  const [printSel, setPrintSel] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (previewPages?.length) {
        setPageImgs(previewPages);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const bytes = await pdfSourceToBytes(source);
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const imgs: PdfPreviewPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, MAX_PDF_IMAGE_DIMENSION / Math.max(baseViewport.width, baseViewport.height));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          imgs.push({ src: canvas.toDataURL("image/jpeg", PDF_IMAGE_QUALITY), width: baseViewport.width, height: baseViewport.height });
          if (cancelled) return;
        }
        if (!cancelled) setPageImgs(imgs);
      } catch (e: any) {
        toast.error("Failed to load PDF: " + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [source, previewPages]);

  // Indexing is now manual — user clicks the "Index text (OCR)" button.
  // Auto-run was removed so opening a PDF is instant; OCR only runs on demand.

  const q = query.trim();
  // Range syntax: only "1,3-5" style (must contain comma or dash), never a bare long number
  const isRangeSyntax = q !== "" && /^[\d,\s\-]+$/.test(q) && /[,\-]/.test(q);
  const ql = q.toLowerCase();
  const textMatched = q && pageTexts.length
    ? pageTexts.map((t, i) => (textMatchesQuery(t, ql) ? i + 1 : 0)).filter((n) => n > 0)
    : [];
  const filtered = q === ""
    ? parsePageRanges(q, pageImgs.length)
    : isRangeSyntax
      ? parsePageRanges(q, pageImgs.length)
      : textMatched.length
        ? textMatched
        : /^\d+$/.test(q) && parseInt(q, 10) <= pageImgs.length
          ? parsePageRanges(q, pageImgs.length)
          : [];
  const isRangeQuery = q === "" || isRangeSyntax;

  const runOcr = async () => {
    if (ocrRunning || !pageImgs.length) return;
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrError("");
    setOcrStatus(`Starting OCR for ${pageImgs.length} page${pageImgs.length === 1 ? "" : "s"}…`);
    try {
      const { createScheduler, createWorker } = await import("tesseract.js");
      const scheduler = createScheduler();
      const workerCount = Math.min(
        pageImgs.length,
        Math.max(2, (navigator.hardwareConcurrency || 4) - 1),
        6,
      );
      const workers = await Promise.all(
        Array.from({ length: workerCount }, async () => {
          const w = await createWorker(ocrLang);
          const whitelist =
            ocrMode === "digits" ? "0123456789"
            : ocrMode === "alnum" ? "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
            : ocrMode === "custom" ? ocrCustom
            : "";
          // PSM 3 = fully automatic page segmentation. Works far better than PSM 6
          // for label/form pages with scattered fields (as opposed to a single text block).
          const params: Record<string, any> = { tessedit_pageseg_mode: "3" as any };
          if (whitelist) params.tessedit_char_whitelist = whitelist;
          await w.setParameters(params as any);
          return w;
        }),
      );
      workers.forEach((w) => scheduler.addWorker(w));
      const texts: string[] = new Array(pageImgs.length).fill("");
      let done = 0;
      await Promise.all(
        pageImgs.map((p, i) =>
          scheduler.addJob("recognize", p.src).then((r: any) => {
            texts[i] = (r.data.text || "").replace(/\s+/g, " ").trim();
            done++;
            setOcrProgress(Math.round((done / pageImgs.length) * 100));
            setOcrStatus(`Indexed page ${done} of ${pageImgs.length}…`);
          }),
        ),
      );
      await scheduler.terminate();
      // Second pass (digits sweep) is disabled by default — it roughly doubles indexing time.
      // Users who need barcode/number search can pick the "digits" OCR mode instead.
      const runDigitPass = false as boolean;
      if (runDigitPass && ocrMode !== "digits") {
        try {
          const digitScheduler = createScheduler();
          const digitWorkers = await Promise.all(
            Array.from({ length: workerCount }, async () => {
              const w = await createWorker(ocrLang);
              await w.setParameters({
                // PSM 11 = sparse text: find as much text as possible in no particular order.
                // Ideal for isolated barcode / carton numbers scattered on a label.
                tessedit_pageseg_mode: "11" as any,
                tessedit_char_whitelist: "0123456789",
              } as any);
              return w;
            }),
          );
          digitWorkers.forEach((w) => digitScheduler.addWorker(w));
          let dDone = 0;
          setOcrStatus(`Second pass (numbers) 0/${pageImgs.length}…`);
          await Promise.all(
            pageImgs.map(async (p, i) => {
              try {
                const sources = await buildDigitOcrSources(p.src);
                const numberParts = await Promise.all(
                  sources.map((src) =>
                    digitScheduler.addJob("recognize", src).then((r: any) =>
                      (r.data.text || "").replace(/[^\d\s]+/g, " ").replace(/\s+/g, " ").trim(),
                    ),
                  ),
                );
                const nums = Array.from(new Set(numberParts.filter(Boolean))).join(" ");
                if (nums) texts[i] = (texts[i] ? texts[i] + " " : "") + nums;
              } finally {
                dDone++;
                setOcrStatus(`Second pass (numbers) ${dDone}/${pageImgs.length}…`);
              }
            }),
          );
          await digitScheduler.terminate();
        } catch { /* digit pass is best-effort */ }
      }
      setPageTexts(texts);
      setOcrIndexedAt(Date.now());
      const indexedCount = texts.filter((t) => t.trim()).length;
      if (!indexedCount) {
        setOcrError("OCR finished but no readable text was found. Try Retry OCR with Full text or a different language.");
        setOcrStatus("OCR completed with 0 searchable pages");
        toast.warning("OCR completed, but no searchable text was found");
      } else {
        setOcrStatus(`Ready — ${indexedCount}/${texts.length} pages searchable`);
        toast.success(`Indexed ${indexedCount}/${texts.length} pages — search is ready.`);
      }
    } catch (e: any) {
      const message = e.message || "Unknown OCR error";
      setOcrError(message);
      setOcrStatus("OCR failed");
      toast.error("OCR failed: " + message);
    } finally {
      setOcrRunning(false);
    }
  };

  const buildPdfFor = (nums: number[], opts: { searchable?: boolean } = {}) => {
    if (!nums.length) { toast.error("No pages selected"); return null; }
    const firstPage = pageImgs[nums[0] - 1];
    return new Promise<jsPDF>((resolve, reject) => {
      const pdf = new jsPDF({
        unit: "px",
        format: [firstPage.width, firstPage.height],
        orientation: firstPage.width >= firstPage.height ? "landscape" : "portrait",
        hotfixes: ["px_scaling"],
        compress: false,
      });
      let done = 0;
      nums.forEach((n, idx) => {
        const page = pageImgs[n - 1];
        const im = new Image();
        im.onload = () => {
          if (idx > 0) pdf.addPage([page.width, page.height], page.width >= page.height ? "landscape" : "portrait");
          pdf.addImage(page.src, "JPEG", 0, 0, page.width, page.height, undefined, "FAST");
          if (opts.searchable) {
            const raw = (pageTexts[n - 1] || "").replace(/\s+/g, " ").trim();
            if (raw) {
              try {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                const lines = pdf.splitTextToSize(raw, page.width - 8) as string[];
                pdf.text(lines, 4, 10, { renderingMode: "invisible", baseline: "top" } as any);
              } catch { /* ignore text-layer failures */ }
            }
          }
          done++;
          if (done === nums.length) resolve(pdf);
        };
        im.onerror = () => reject(new Error("Image load failed"));
        im.src = page.src;
      });
    });
  };

  const downloadFiltered = async () => {
    try {
      const pdf = await buildPdfFor(filtered);
      if (!pdf) return;
      const blob = pdf.output("blob");
      saveAs(blob, `${(name || "cropped").replace(/[^\w.-]+/g, "_")}-filtered.pdf`);
    } catch (e: any) { toast.error("Export failed: " + e.message); }
  };

  const downloadSearchable = async () => {
    try {
      if (!pageTexts.length) {
        toast.info("Indexing text first…");
        await runOcr();
      }
      const nums = filtered.length ? filtered : pageImgs.map((_, i) => i + 1);
      const pdf = await buildPdfFor(nums, { searchable: true });
      if (!pdf) return;
      const blob = pdf.output("blob");
      saveAs(blob, `${(name || "cropped").replace(/[^\w.-]+/g, "_")}-searchable.pdf`);
      toast.success("Searchable PDF exported");
    } catch (e: any) { toast.error("Export failed: " + e.message); }
  };

  const openPrintDialog = () => {
    setPrintSel(new Set(filtered.length ? filtered : pageImgs.map((_, i) => i + 1)));
    setPrintOpen(true);
  };
  const confirmPrint = async () => {
    try {
      const nums = Array.from(printSel).sort((a, b) => a - b);
      if (!nums.length) return;
      setPrintOpen(false);
      // Print via a hidden iframe using the browser's own print dialog so no
      // external PDF viewer/software is launched. Each page's @page size is
      // set to the cropped image dimensions (mm) so paper matches the crop.
      const pxToMm = (px: number) => (px * 25.4) / 96;
      const first = pageImgs[nums[0] - 1];
      const pageWmm = pxToMm(first.width);
      const pageHmm = pxToMm(first.height);
      const imgs = nums
        .map((n) => `<img class="pg" src="${pageImgs[n - 1].src}" />`)
        .join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${(name || "cropped")}</title>
<style>
  @page { size: ${pageWmm}mm ${pageHmm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pg { display: block; width: ${pageWmm}mm; height: ${pageHmm}mm; object-fit: contain; page-break-after: always; }
  .pg:last-child { page-break-after: auto; }
</style></head><body>${imgs}</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open(); doc.write(html); doc.close();
      const trigger = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
        finally { setTimeout(() => iframe.remove(), 1000); }
      };
      const imgEls = Array.from(doc.images);
      let left = imgEls.length;
      if (!left) { trigger(); return; }
      imgEls.forEach((im) => {
        if (im.complete) { if (--left === 0) trigger(); }
        else {
          im.onload = im.onerror = () => { if (--left === 0) trigger(); };
        }
      });
    } catch (e: any) { toast.error("Print failed: " + e.message); }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border rounded-md p-1.5 sm:p-2 bg-muted/30">
        <Input
          placeholder='Search pages… or "1,3-5,8"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 flex-1 min-w-[140px] sm:max-w-sm text-xs sm:text-sm"
        />
        <Badge variant="outline" className="text-[10px] sm:text-xs">{filtered.length}/{pageImgs.length}</Badge>
        {!isRangeQuery && !pageTexts.length && !ocrRunning && (
          <Badge variant="secondary" className="text-amber-700">Click "Index text" to enable text search</Badge>
        )}
        <div className="sm:ml-auto flex flex-wrap gap-1.5 sm:gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" title="Quick OCR settings" className="h-8 px-2">
                <Settings2 className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">OCR</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 space-y-2">
              <DropdownMenuLabel>Quick OCR settings</DropdownMenuLabel>
              <div>
                <Label className="text-xs">Character set</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-sm"
                  value={ocrMode}
                  onChange={(e) => setOcrMode(e.target.value as any)}
                >
                  <option value="full">Full text (all characters)</option>
                  <option value="digits">Digits only (0-9)</option>
                  <option value="alnum">Alphanumeric (A-Z, 0-9)</option>
                  <option value="custom">Custom whitelist…</option>
                </select>
              </div>
              {ocrMode === "custom" && (
                <Input
                  className="h-8"
                  placeholder="e.g. 0123456789-/"
                  value={ocrCustom}
                  onChange={(e) => setOcrCustom(e.target.value)}
                />
              )}
              <div>
                <Label className="text-xs">Language</Label>
                <select
                  className="mt-1 w-full h-8 rounded border bg-background px-2 text-sm"
                  value={ocrLang}
                  onChange={(e) => setOcrLang(e.target.value)}
                >
                  <option value="eng">English</option>
                  <option value="ben">Bengali</option>
                  <option value="eng+ben">English + Bengali</option>
                  <option value="ara">Arabic</option>
                  <option value="hin">Hindi</option>
                  <option value="chi_sim">Chinese (Simplified)</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground">Re-index after changing settings.</p>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={runOcr} disabled={ocrRunning || !pageImgs.length} className="h-8 px-2 text-xs sm:text-sm">
            {ocrRunning ? `${ocrProgress}%` : pageTexts.length ? "Re-index" : "Index text"}
          </Button>
          {(ocrError || pageTexts.length > 0) && !ocrRunning && (
            <Button size="sm" variant={ocrError ? "default" : "outline"} onClick={runOcr} disabled={!pageImgs.length} className="h-8 px-2">
              <RotateCcw className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Retry OCR</span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadFiltered} disabled={!pageImgs.length} className="h-8 px-2">
            <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Extract PDF</span>
          </Button>
          <Button size="sm" variant="outline" onClick={downloadSearchable} disabled={!pageImgs.length || ocrRunning} title="Export PDF with an invisible OCR text layer" className="h-8 px-2">
            <Download className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Searchable PDF</span>
          </Button>
        </div>
      </div>
      {(ocrRunning || ocrStatus || ocrError) && (
        <div className={`rounded-md border p-2 space-y-2 ${ocrError ? "border-destructive/40 bg-destructive/5" : "bg-muted/30"}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className={`flex items-center gap-2 ${ocrError ? "text-destructive" : "text-muted-foreground"}`}>
              {ocrRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : ocrError ? <AlertCircle className="w-4 h-4" /> : null}
              <span>{ocrError || ocrStatus}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ocrIndexedAt && !ocrError && !ocrRunning && <Badge variant="outline">Indexed</Badge>}
              {!ocrRunning && (
                <Button size="sm" variant="outline" className="h-7" onClick={runOcr} disabled={!pageImgs.length}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry OCR
                </Button>
              )}
            </div>
          </div>
          {ocrRunning && <Progress value={ocrProgress} />}
          {ocrError && <div className="text-xs text-muted-foreground">Change OCR settings if needed, then press Retry OCR.</div>}
        </div>
      )}
      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Print — select pages ({printSel.size}/{pageImgs.length})</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Button size="sm" variant="outline" onClick={() => setPrintSel(new Set(pageImgs.map((_, i) => i + 1)))}>Select all</Button>
            <Button size="sm" variant="outline" onClick={() => setPrintSel(new Set())}>Clear</Button>
            <Button size="sm" variant="outline" onClick={() => setPrintSel(new Set(filtered))} disabled={!filtered.length}>Only filtered ({filtered.length})</Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPrintOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={confirmPrint} disabled={!printSel.size}>
                <Printer className="w-4 h-4 mr-1" /> Print {printSel.size} page{printSel.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-1">
            {pageImgs.map((p, i) => {
              const n = i + 1;
              const on = printSel.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPrintSel((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; })}
                  className={`relative border rounded overflow-hidden text-left ${on ? "ring-2 ring-primary border-primary" : "border-muted"}`}
                >
                  <img src={p.src} alt={`Page ${n}`} className="w-full h-32 object-contain bg-white" />
                  {on && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex-1 min-h-0 overflow-auto border rounded bg-muted/20 p-3 space-y-3">
        {loading && <div className="text-center text-sm text-muted-foreground py-10">Loading PDF…</div>}
        {!loading && filtered.map((n) => (
          <div key={n} className="bg-background border rounded shadow-sm mx-auto max-w-full">
            <div className="text-xs text-muted-foreground px-2 py-1 border-b">Page {n}</div>
            <img src={pageImgs[n - 1].src} alt={`Page ${n}`} className="max-w-full h-auto block mx-auto" />
          </div>
        ))}
        {!loading && !filtered.length && (
          <div className="text-center text-sm text-muted-foreground py-10">No pages match your filter</div>
        )}
      </div>
    </div>
  );
};

const highlightDigits = (text: string, q: string) => {
  if (!q || !/^\d+$/.test(q)) return text;
  const parts = text.split(new RegExp(`(${q})`, "g"));
  return parts.map((p, i) =>
    p === q ? <mark key={i} className="bg-yellow-300 text-black rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>,
  );
};

const BatchCard = ({ b, active, onOpen, onDelete, onPreview, folders, onMoveBatch, search = "" }: { b: Batch; active: boolean; onOpen: (b: Batch) => void; onDelete: (id: string) => void; onPreview: (b: Batch) => void; folders: Folder[]; onMoveBatch: (batchId: string, folderId: string | null) => void; search?: string }) => {
  const color = zoneColors[(b.seq ?? 0) % zoneColors.length];
  const q = search.trim();
  const textHit = textMatchesQuery(b.text, q);
  let snippet: string | null = null;
  if (textHit) {
    const normalizedText = b.text || "";
    const idx = Math.max(0, normalizedText.toLowerCase().indexOf(q.toLowerCase()));
    const start = Math.max(0, idx - 20);
    const end = Math.min(normalizedText.length, idx + q.length + 20);
    snippet = (start > 0 ? "…" : "") + normalizedText.slice(start, end) + (end < normalizedText.length ? "…" : "");
  }
  return (
  <div
    className={`border rounded-md p-2 flex flex-col gap-1.5 min-w-[200px] max-w-full w-fit ${active ? "ring-2 ring-primary" : ""}`}
    style={{ borderColor: `${color}66`, borderLeftWidth: 3, borderLeftColor: `${color}66`, background: `${color}0d` }}
  >
    <div className="w-full min-w-0">
      <div className="flex items-center gap-2 w-full">
        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0" style={{ borderColor: color, color }}>#{b.seq ?? "-"}</Badge>
        <div
          className="whitespace-nowrap text-xs font-medium capitalize cursor-pointer"
          title={b.name || "Untitled"}
          onClick={() => (hasBatchPdfPreview(b) ? onPreview(b) : onOpen(b))}
        >
          {highlightDigits(b.name || "Untitled", q)}
        </div>
      </div>
      {snippet && (
        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate" title={snippet}>
          {highlightDigits(snippet, q)}
        </div>
      )}
      <button
        className="text-left w-full text-xs text-muted-foreground mt-0.5"
        onClick={() => (hasBatchPdfPreview(b) ? onPreview(b) : onOpen(b))}
      >
        {b.pages.length} pages · {new Date(b.createdAt).toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        {hasBatchPdfPreview(b) && <span className="ml-1 text-emerald-600">· PDF ready</span>}
        {b.croppedAt && !hasBatchPdfPreview(b) && <span className="ml-1 text-amber-600">· needs re-crop</span>}
      </button>
    </div>
    <div className="flex items-center justify-end gap-1 flex-wrap">
    {hasBatchPdfPreview(b) && (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Open PDF (search & print)" onClick={(e) => { e.stopPropagation(); onPreview(b); }}>
        <Printer className="w-4 h-4" />
      </Button>
    )}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Move to folder"><FolderInput className="w-4 h-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onMoveBatch(b.id, null)}>Root (no folder)</DropdownMenuItem>
        {folders.length > 0 && <DropdownMenuSeparator />}
        {folders.map((f) => (
          <DropdownMenuItem key={f.id} onClick={() => onMoveBatch(b.id, f.id)}>
            <FolderIcon className="w-4 h-4 mr-2" /> <span className="capitalize">{f.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
    <PermGate action="edit" path="/sticker-printer/crop">
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Re-crop" onClick={() => onOpen(b)}>
        <Scissors className="w-4 h-4" />
      </Button>
    </PermGate>
    <PermGate action="delete" path="/sticker-printer/crop">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
            <AlertDialogDescription>"{b.name}" ({b.pages.length} pages) permanently remove hobe.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(b.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermGate>
    </div>
  </div>
);
};

const BatchLibrary = ({ batches, activeBatchId, search, setSearch, filter, setFilter, onOpen, onDelete, onPreview, folders, currentFolder, setCurrentFolder, onCreateFolder, onCreateDateFolder, onDeleteFolder, onRenameFolder, onMoveBatch, onUpload }: LibProps) => {
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [folderSearch, setFolderSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [folderPage, setFolderPage] = useState(1);
  const [uncroppedPage, setUncroppedPage] = useState(1);
  const [croppedPage, setCroppedPage] = useState(1);
  const FOLDERS_PER_PAGE = 12;
  const BATCHES_PER_PAGE = 12;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const q = search.trim().toLowerCase();
  // Scope by folder first
  const scoped = batches.filter((b) => (currentFolder ? b.folderId === currentFolder : !b.folderId));
  const matched = scoped.filter(
    (b) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      String(b.seq ?? "").includes(q) ||
      textMatchesQuery(b.text, q),
  );
  const filtered = matched.filter((b) =>
    filter === "all" ? true : filter === "cropped" ? hasBatchPdfPreview(b) : !hasBatchPdfPreview(b)
  );
  const cropped = filtered.filter((b) => hasBatchPdfPreview(b));
  const uncroppedAll = filtered.filter((b) => !hasBatchPdfPreview(b));
  const uncropped = dateFilter
    ? uncroppedAll.filter((b) => new Date(b.createdAt).toISOString().slice(0, 10) === dateFilter)
    : uncroppedAll;
  const croppedFiltered = dateFilter
    ? cropped.filter((b) => new Date(b.createdAt).toISOString().slice(0, 10) === dateFilter)
    : cropped;
  const activeFolder = folders.find((f) => f.id === currentFolder) || null;
  const isDateFolder = !!activeFolder && /\d{4}-\d{2}-\d{2}$/.test(activeFolder.name.trim());
  const countInFolder = (id: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return 0;
    const prefix = `${folder.name} / `;
    const nestedIds = new Set(
      folders.filter((f) => f.name.trim().startsWith(prefix)).map((f) => f.id)
    );
    nestedIds.add(id);
    return batches.filter((b) => b.folderId && nestedIds.has(b.folderId)).length;
  };
  const fq = folderSearch.trim().toLowerCase();
  // Root-level = folders that are NOT nested date subfolders ("Parent / YYYY-MM-DD")
  const isNestedDate = (n: string) => / \/ \d{4}-\d{2}-\d{2}$/.test(n.trim());
  const rootFolders = folders.filter((f) => !isNestedDate(f.name));
  const visibleFolders = fq ? rootFolders.filter((f) => f.name.toLowerCase().includes(fq)) : rootFolders;
  // Sub date-folders under the current (non-date) folder
  const subFoldersAll =
    activeFolder && !isDateFolder
      ? folders.filter((f) => f.name.trim().startsWith(`${activeFolder.name} / `) && /\d{4}-\d{2}-\d{2}$/.test(f.name.trim()))
      : [];
  const subFolders = fq ? subFoldersAll.filter((f) => f.name.toLowerCase().includes(fq)) : subFoldersAll;

  const folderTotalPages = Math.max(1, Math.ceil(visibleFolders.length / FOLDERS_PER_PAGE));
  const folderPageSafe = Math.min(folderPage, folderTotalPages);
  const pagedFolders = visibleFolders.slice((folderPageSafe - 1) * FOLDERS_PER_PAGE, folderPageSafe * FOLDERS_PER_PAGE);

  const uncroppedTotalPages = Math.max(1, Math.ceil(uncropped.length / BATCHES_PER_PAGE));
  const uncroppedPageSafe = Math.min(uncroppedPage, uncroppedTotalPages);
  const pagedUncropped = uncropped.slice((uncroppedPageSafe - 1) * BATCHES_PER_PAGE, uncroppedPageSafe * BATCHES_PER_PAGE);

  const croppedTotalPages = Math.max(1, Math.ceil(croppedFiltered.length / BATCHES_PER_PAGE));
  const croppedPageSafe = Math.min(croppedPage, croppedTotalPages);
  const pagedCropped = croppedFiltered.slice((croppedPageSafe - 1) * BATCHES_PER_PAGE, croppedPageSafe * BATCHES_PER_PAGE);

  const Pager = ({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (n: number) => void }) => (
    totalPages > 1 ? (
      <div className="flex items-center justify-center gap-2 mt-3">
        <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
        <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    ) : null
  );

  const cardProps = { folders, onMoveBatch };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            {activeFolder ? (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 border-primary/60 text-primary hover:bg-primary/10"
                  title="Back to all"
                  onClick={() => setCurrentFolder(null)}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <FolderOpen className="w-4 h-4 text-amber-500" /> <span className="capitalize">{activeFolder.name}</span>
              </>
            ) : (
              <Input
                placeholder="Search folders…"
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                className="h-8 w-56 text-sm"
              />
            )}
          </span>
          {activeFolder ? (
            (() => {
              const isDateFolder = /\d{4}-\d{2}-\d{2}$/.test(activeFolder.name.trim());
              return (
                <div className="flex items-center gap-2 flex-wrap">
              {!isDateFolder && (
                <PermGate action="add" path="/sticker-printer/crop">
                  <Button size="sm" variant="outline" onClick={onCreateDateFolder} title="Open/create today's date folder">
                    <CalendarIcon className="w-4 h-4 mr-1" /> Date Folder
                  </Button>
                </PermGate>
              )}
                  {!isDateFolder && (
                    <div className="flex items-center gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8" title="Filter by date">
                            <CalendarIcon className="w-4 h-4 mr-1" />
                            {folderSearch || "Filter date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={folderSearch ? new Date(folderSearch) : undefined}
                            onSelect={(d) => setFolderSearch(d ? format(d, "yyyy-MM-dd") : "")}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      {folderSearch && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setFolderSearch("")}
                          title="Clear"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                  {isDateFolder && (
                  <PermGate action="add" path="/sticker-printer/crop">
                <label className="inline-flex">
                  <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ""; }} />
                  <span className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer">
                    <Upload className="w-4 h-4" /> Upload to this folder
                  </span>
                </label>
                  </PermGate>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <PermGate action="add" path="/sticker-printer/crop">
                {showNewFolder ? (
                <div className="flex items-center gap-1">
                  <Input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="h-8 w-40 text-sm" onKeyDown={(e) => { if (e.key === "Enter") { onCreateFolder(newFolderName); setNewFolderName(""); setShowNewFolder(false); } if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }} />
                  <Button size="sm" className="h-8" onClick={() => { onCreateFolder(newFolderName); setNewFolderName(""); setShowNewFolder(false); }}>Create</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}>Cancel</Button>
                </div>
                ) : (
                <Button size="sm" onClick={() => setShowNewFolder(true)}>
                  <FolderPlus className="w-4 h-4 mr-1" /> New Folder
                </Button>
                )}
              </PermGate>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Folders grid */}
        {!activeFolder && (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {visibleFolders.length === 0 && folders.length > 0 && (
              <div className="col-span-full text-xs text-muted-foreground italic">No folders match "{folderSearch}"</div>
            )}
            {pagedFolders.map((f) => {
              const color = zoneColors[Math.abs(f.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % zoneColors.length];
              const isEditing = editingId === f.id;
              return (
                <div
                  key={f.id}
                  className="group relative border-2 rounded-lg p-3 bg-card hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
                  style={{ borderColor: color, background: `${color}0d` }}
                  onClick={() => !isEditing && setCurrentFolder(f.id)}
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon className="w-8 h-8 shrink-0" style={{ color }} fill={color} fillOpacity={0.2} />
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") { onRenameFolder(f.id, editName); setEditingId(null); }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate capitalize">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">{countInFolder(f.id)} file{countInFolder(f.id) !== 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <>
                        <Button size="sm" className="h-7 px-2" onClick={() => { onRenameFolder(f.id, editName); setEditingId(null); }}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <PermGate action="edit" path="/sticker-printer/crop">
                              <DropdownMenuItem onClick={() => { setEditingId(f.id); setEditName(f.name); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            </PermGate>
                            <PermGate action="delete" path="/sticker-printer/crop">
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
                            <AlertDialogTitle>Delete folder "{f.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>Batches inside will move back to root.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteFolder(f.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!activeFolder && <Pager page={folderPageSafe} totalPages={folderTotalPages} onPage={setFolderPage} />}
        {activeFolder && !isDateFolder && (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            {subFolders.length === 0 && (
              <div className="col-span-full text-xs text-muted-foreground italic">
                No date folders yet. Click "Date Folder" to create one for today.
              </div>
            )}
            {subFolders.map((f) => {
              const color = zoneColors[Math.abs(f.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % zoneColors.length];
              const dateLabel = f.name.trim().split(" / ").pop() || f.name;
              return (
                <div
                  key={f.id}
                  className="group relative border-2 rounded-lg p-3 bg-card hover:shadow-md transition-all cursor-pointer flex flex-col gap-2"
                  style={{ borderColor: color, background: `${color}0d` }}
                  onClick={() => setCurrentFolder(f.id)}
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-8 h-8 shrink-0" style={{ color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{dateLabel}</div>
                      <div className="text-[11px] text-muted-foreground">{countInFolder(f.id)} file{countInFolder(f.id) !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermGate action="edit" path="/sticker-printer/crop">
                            <DropdownMenuItem onClick={() => onRenameFolder(f.id, prompt("Rename folder", f.name) || f.name)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          </PermGate>
                          <PermGate action="delete" path="/sticker-printer/crop">
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
                          <AlertDialogTitle>Delete folder "{f.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>Batches inside will move back to root.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteFolder(f.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {activeFolder && isDateFolder && (
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative max-w-xs w-full">
              <Input
                placeholder="Search by name or sequence #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pr-8"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive z-10"
                  onClick={() => setSearch("")}
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {(filter === "all" || filter === "uncropped" || filter === "cropped") && (
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 justify-start text-left font-normal gap-2"
                      title="Filter by upload date"
                    >
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      <span className={dateFilter ? "" : "text-muted-foreground"}>
                        {dateFilter ? format(new Date(dateFilter), "PPP") : "Pick date"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFilter ? new Date(dateFilter) : undefined}
                      onSelect={(d) => setDateFilter(d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                {dateFilter && (
                  <button
                    type="button"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                    onClick={() => setDateFilter("")}
                    title="Clear date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList>
                  <TabsTrigger value="all">All ({matched.length})</TabsTrigger>
                  <TabsTrigger value="uncropped">Not Cropped ({matched.filter((b) => !hasBatchPdfPreview(b)).length})</TabsTrigger>
                  <TabsTrigger value="cropped">Cropped ({matched.filter((b) => hasBatchPdfPreview(b)).length})</TabsTrigger>
                </TabsList>
              </Tabs>
              {filter !== "all" && (
                <button
                  type="button"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                  onClick={() => setFilter("all")}
                  title="Clear filter"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {activeFolder && isDateFolder && (filter === "all" || filter === "uncropped") && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Not Cropped ({uncropped.length}{dateFilter ? ` on ${dateFilter}` : ""})
            </div>
            {uncropped.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">None</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-start">
                  {pagedUncropped.map((b) => <BatchCard key={b.id} b={b} active={activeBatchId === b.id} onOpen={onOpen} onDelete={onDelete} onPreview={onPreview} {...cardProps} />)}
                </div>
                <Pager page={uncroppedPageSafe} totalPages={uncroppedTotalPages} onPage={setUncroppedPage} />
              </>
            )}
          </div>
        )}

        {activeFolder && isDateFolder && (filter === "all" || filter === "cropped") && (
          <div>
            <div className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wide">Cropped PDFs ({croppedFiltered.length}{dateFilter ? ` on ${dateFilter}` : ""})</div>
            {croppedFiltered.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">None</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-start">
                  {pagedCropped.map((b) => <BatchCard key={b.id} b={b} active={activeBatchId === b.id} onOpen={onOpen} onDelete={onDelete} onPreview={onPreview} search={search} {...cardProps} />)}
                </div>
                <Pager page={croppedPageSafe} totalPages={croppedTotalPages} onPage={setCroppedPage} />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
