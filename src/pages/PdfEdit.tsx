import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, FileEdit, Upload, RotateCw, Trash2, Download, Scissors, Combine,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Copy, FileImage, Image as ImageIcon,
  FileDown, Type, Droplets, Hash, CheckSquare, Square, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, degrees, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PageItem = { id: string; srcIndex: number; rotation: number; thumb: string };

const uid = () => Math.random().toString(36).slice(2, 9);

const downloadBlob = (data: Blob | Uint8Array | ArrayBuffer, name: string, type = "application/pdf") => {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const PdfEdit = () => {
  const navigate = useNavigate();
  const [srcBytes, setSrcBytes] = useState<Uint8Array | null>(null);
  const [srcName, setSrcName] = useState("");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [splitRange, setSplitRange] = useState("");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [pnPrefix, setPnPrefix] = useState("Page ");
  const [compressQ, setCompressQ] = useState(60);

  const [preview, setPreview] = useState<{ id: string; scale: number } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const loadPdf = useCallback(async (file: File, password?: string) => {
    setBusy(true); setProgress(0);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let pdf;
      try {
        pdf = await pdfjsLib.getDocument({ data: buf.slice(), password }).promise;
      } catch (err: any) {
        if (err?.name === "PasswordException") {
          const pw = window.prompt("This PDF is password-protected. Enter password:") || "";
          if (!pw) { toast.error("Password required"); return; }
          pdf = await pdfjsLib.getDocument({ data: buf.slice(), password: pw }).promise;
        } else throw err;
      }
      setSrcBytes(buf); setSrcName(file.name);
      const items: PageItem[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 0.35 });
        canvas.width = vp.width; canvas.height = vp.height;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        items.push({ id: uid(), srcIndex: i - 1, rotation: 0, thumb: canvas.toDataURL("image/jpeg", 0.7) });
        setProgress(Math.round((i / pdf.numPages) * 100));
      }
      setPages(items); setSelected(new Set());
      toast.success(`Loaded ${items.length} pages`);
    } catch (e: any) { toast.error("Load failed: " + (e.message || e)); }
    finally { setBusy(false); setProgress(0); }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = Array.from(e.dataTransfer.files).find((x) => x.type === "application/pdf");
    if (f) loadPdf(f);
  };

  // ---- page ops
  const rotate = (id: string) => setPages((p) => p.map((x) => x.id === id ? { ...x, rotation: (x.rotation + 90) % 360 } : x));
  const remove = (id: string) => { setPages((p) => p.filter((x) => x.id !== id)); setSelected((s) => { const n = new Set(s); n.delete(id); return n; }); };
  const duplicate = (id: string) => setPages((p) => {
    const i = p.findIndex((x) => x.id === id); if (i < 0) return p;
    const n = [...p]; n.splice(i + 1, 0, { ...p[i], id: uid() }); return n;
  });
  const move = (id: string, dir: -1 | 1) => setPages((p) => {
    const i = p.findIndex((x) => x.id === id); if (i < 0) return p;
    const j = i + dir; if (j < 0 || j >= p.length) return p;
    const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(pages.map((p) => p.id)));
  const clearSel = () => setSelected(new Set());
  const rotateSel = () => setPages((p) => p.map((x) => selected.has(x.id) ? { ...x, rotation: (x.rotation + 90) % 360 } : x));
  const deleteSel = () => { setPages((p) => p.filter((x) => !selected.has(x.id))); setSelected(new Set()); };

  // ---- drag reorder
  const onDragStart = (id: string) => { dragIdRef.current = id; };
  const onDragOverItem = (e: React.DragEvent) => e.preventDefault();
  const onDropItem = (targetId: string) => {
    const from = dragIdRef.current; if (!from || from === targetId) return;
    setPages((p) => {
      const src = p.findIndex((x) => x.id === from);
      const dst = p.findIndex((x) => x.id === targetId);
      if (src < 0 || dst < 0) return p;
      const n = [...p]; const [it] = n.splice(src, 1); n.splice(dst, 0, it); return n;
    });
    dragIdRef.current = null;
  };

  // ---- build helpers
  const buildOutput = async (indices?: string[]) => {
    if (!srcBytes) throw new Error("No PDF loaded");
    const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const list = indices ? pages.filter((p) => indices.includes(p.id)) : pages;
    const copied = await out.copyPages(src, list.map((p) => p.srcIndex));
    copied.forEach((pg, i) => {
      const rot = list[i].rotation;
      if (rot) pg.setRotation(degrees((pg.getRotation().angle + rot) % 360));
      out.addPage(pg);
    });
    return out;
  };

  const save = async () => {
    if (!pages.length) return; setBusy(true);
    try {
      const out = await buildOutput();
      downloadBlob(await out.save(), srcName.replace(/\.pdf$/i, "") + "-edited.pdf");
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const extractSelected = async () => {
    if (!selected.size) return toast.error("Select pages first");
    setBusy(true);
    try {
      const out = await buildOutput(Array.from(selected));
      downloadBlob(await out.save(), srcName.replace(/\.pdf$/i, "") + "-extracted.pdf");
      toast.success(`Extracted ${selected.size} page(s)`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const parseRanges = (input: string, max: number): number[][] =>
    input.split(/[,;]/).map((s) => s.trim()).filter(Boolean).map((part) => {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) { const a = Math.max(1, Math.min(max, +m[1])), b = Math.max(1, Math.min(max, +m[2])); const r: number[] = []; for (let i = Math.min(a, b); i <= Math.max(a, b); i++) r.push(i - 1); return r; }
      const n = +part; return n >= 1 && n <= max ? [n - 1] : [];
    }).filter((r) => r.length);

  const split = async () => {
    if (!srcBytes) return;
    const ranges = parseRanges(splitRange, pages.length);
    if (!ranges.length) return toast.error("Enter ranges like: 1-5, 6-10");
    setBusy(true);
    try {
      const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const zip = new JSZip();
      for (let i = 0; i < ranges.length; i++) {
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, ranges[i]);
        copied.forEach((p) => out.addPage(p));
        zip.file(`${srcName.replace(/\.pdf$/i, "")}-part${i + 1}.pdf`, await out.save());
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${srcName.replace(/\.pdf$/i, "")}-split.zip`, "application/zip");
      toast.success(`Split into ${ranges.length} file(s)`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const merge = async (files: FileList) => {
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const f of Array.from(files)) {
        const src = await PDFDocument.load(new Uint8Array(await f.arrayBuffer()), { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      }
      downloadBlob(await out.save(), "merged.pdf");
      toast.success(`Merged ${files.length} PDFs`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const addWatermark = async () => {
    if (!pages.length || !wmText.trim()) return;
    setBusy(true);
    try {
      const out = await buildOutput();
      const font = await out.embedFont(StandardFonts.HelveticaBold);
      out.getPages().forEach((pg) => {
        const { width, height } = pg.getSize();
        const size = Math.min(width, height) / 8;
        pg.drawText(wmText, {
          x: width / 2 - (wmText.length * size) / 4,
          y: height / 2, size, font, color: rgb(0.7, 0.7, 0.7), opacity: 0.35, rotate: degrees(-30),
        });
      });
      downloadBlob(await out.save(), srcName.replace(/\.pdf$/i, "") + "-watermarked.pdf");
      toast.success("Watermark added");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const addPageNumbers = async () => {
    if (!pages.length) return;
    setBusy(true);
    try {
      const out = await buildOutput();
      const font = await out.embedFont(StandardFonts.Helvetica);
      const total = out.getPageCount();
      out.getPages().forEach((pg, i) => {
        const { width } = pg.getSize();
        const txt = `${pnPrefix}${i + 1} / ${total}`;
        const w = font.widthOfTextAtSize(txt, 10);
        pg.drawText(txt, { x: (width - w) / 2, y: 16, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      });
      downloadBlob(await out.save(), srcName.replace(/\.pdf$/i, "") + "-numbered.pdf");
      toast.success("Page numbers added");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const compress = async () => {
    if (!srcBytes) return;
    setBusy(true); setProgress(0);
    try {
      const pdf = await pdfjsLib.getDocument({ data: srcBytes.slice() }).promise;
      const out = await PDFDocument.create();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (let i = 0; i < pages.length; i++) {
        const src = pages[i];
        const page = await pdf.getPage(src.srcIndex + 1);
        const vp = page.getViewport({ scale: 1.5 });
        canvas.width = vp.width; canvas.height = vp.height;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", compressQ / 100);
        const jpg = await out.embedJpg(dataUrl);
        const w = jpg.width, h = jpg.height;
        const pg = out.addPage([w, h]);
        pg.drawImage(jpg, { x: 0, y: 0, width: w, height: h });
        if (src.rotation) pg.setRotation(degrees(src.rotation));
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }
      const bytes = await out.save();
      downloadBlob(bytes, srcName.replace(/\.pdf$/i, "") + `-compressed-q${compressQ}.pdf`);
      toast.success(`Compressed → ${(bytes.length / 1024).toFixed(0)} KB (from ${(srcBytes.length / 1024).toFixed(0)} KB)`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); setProgress(0); }
  };

  const pdfToImages = async () => {
    if (!srcBytes) return;
    setBusy(true); setProgress(0);
    try {
      const pdf = await pdfjsLib.getDocument({ data: srcBytes.slice() }).promise;
      const zip = new JSZip();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const list = pages.length ? pages : Array.from({ length: pdf.numPages }, (_, i) => ({ srcIndex: i, rotation: 0 })) as PageItem[];
      for (let i = 0; i < list.length; i++) {
        const page = await pdf.getPage(list[i].srcIndex + 1);
        const vp = page.getViewport({ scale: 2 });
        canvas.width = vp.width; canvas.height = vp.height;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
        zip.file(`page-${String(i + 1).padStart(4, "0")}.png`, blob);
        setProgress(Math.round(((i + 1) / list.length) * 100));
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), srcName.replace(/\.pdf$/i, "") + "-images.zip", "application/zip");
      toast.success("PDF → Images exported");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); setProgress(0); }
  };

  const imagesToPdf = async (files: FileList) => {
    setBusy(true);
    try {
      const out = await PDFDocument.create();
      for (const f of Array.from(files)) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const isPng = f.type === "image/png";
        const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const pg = out.addPage([img.width, img.height]);
        pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      downloadBlob(await out.save(), "images.pdf");
      toast.success(`${files.length} image(s) → PDF`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const previewPage = pages.find((p) => p.id === preview?.id);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileEdit className="w-6 h-6 text-rose-500" /> PDF Management</h1>
        <Button
          size="sm"
          className="ml-auto bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white"
          onClick={() => navigate("/sticker-printer/pdf-tools?tab=edittext")}
        >
          <Type className="w-4 h-4 mr-1" /> Edit Text / Numbers
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Load PDF</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-md p-6 text-center text-sm transition ${dragOver ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30" : "border-muted-foreground/30"}`}
          >
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            Drag & drop a PDF here, or
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPdf(f); e.currentTarget.value = ""; }}
              className="mt-2 block mx-auto text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-rose-500 file:text-white hover:file:bg-rose-600 disabled:opacity-50" />
            <p className="text-xs text-muted-foreground mt-2">Password-protected PDFs will prompt for the password.</p>
          </div>
          {busy && progress > 0 && <Progress value={progress} />}
          {!!pages.length && <div className="flex flex-wrap gap-2 items-center"><Badge variant="secondary">{srcName}</Badge><Badge>{pages.length} pages</Badge><Badge variant="outline">{selected.size} selected</Badge></div>}
        </CardContent>
      </Card>

      {!!pages.length && (
        <>
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Pages · drag to reorder</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={selected.size === pages.length ? clearSel : selectAll}>
                  {selected.size === pages.length ? <CheckSquare className="w-4 h-4 mr-1" /> : <Square className="w-4 h-4 mr-1" />} Select all
                </Button>
                <Button size="sm" variant="outline" onClick={rotateSel} disabled={!selected.size}><RotateCw className="w-4 h-4 mr-1" /> Rotate</Button>
                <Button size="sm" variant="outline" onClick={deleteSel} disabled={!selected.size} className="text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
                <Button size="sm" variant="outline" onClick={extractSelected} disabled={!selected.size}><FileDown className="w-4 h-4 mr-1" /> Extract</Button>
                <Button size="sm" onClick={save} disabled={busy}><Download className="w-4 h-4 mr-1" /> Save PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {pages.map((p, i) => {
                  const isSel = selected.has(p.id);
                  return (
                    <div key={p.id}
                      draggable
                      onDragStart={() => onDragStart(p.id)}
                      onDragOver={onDragOverItem}
                      onDrop={() => onDropItem(p.id)}
                      className={`border rounded-md p-2 bg-card space-y-1 cursor-move transition ${isSel ? "ring-2 ring-rose-500" : ""}`}
                    >
                      <div
                        className="relative aspect-[3/4] bg-muted rounded overflow-hidden flex items-center justify-center cursor-zoom-in"
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey || e.shiftKey) { toggle(p.id); return; }
                          setPreview({ id: p.id, scale: 1 });
                        }}
                        title="Click to open · Ctrl/Cmd-click to select"
                      >
                        <img src={p.thumb} alt={`page ${p.srcIndex + 1}`} className="max-w-full max-h-full pointer-events-none" style={{ transform: `rotate(${p.rotation}deg)` }} />
                        <span className="absolute top-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">#{i + 1} · src {p.srcIndex + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                          className={`absolute top-1 right-1 rounded-full p-0.5 transition ${isSel ? "bg-rose-500 text-white" : "bg-white/80 text-rose-500 hover:bg-white"}`}
                          title={isSel ? "Deselect" : "Select"}
                        >
                          <CheckSquare className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.id, -1)} title="Move left"><ChevronLeft className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreview({ id: p.id, scale: 1 })} title="Preview"><Eye className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => rotate(p.id)} title="Rotate"><RotateCw className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicate(p.id)} title="Duplicate"><Copy className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)} title="Delete"><Trash2 className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(p.id, 1)} title="Move right"><ChevronRight className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Scissors className="w-4 h-4" /> Split by Ranges</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="rng" className="text-xs">Ranges (e.g. 1-5, 6-10)</Label>
                  <Input id="rng" value={splitRange} onChange={(e) => setSplitRange(e.target.value)} placeholder="1-5, 6-10" className="h-9" />
                </div>
                <Button size="sm" onClick={split} disabled={busy}><Scissors className="w-4 h-4 mr-1" /> Split (ZIP)</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Droplets className="w-4 h-4" /> Watermark</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="wm" className="text-xs">Text</Label>
                  <Input id="wm" value={wmText} onChange={(e) => setWmText(e.target.value)} className="h-9" />
                </div>
                <Button size="sm" onClick={addWatermark} disabled={busy}><Droplets className="w-4 h-4 mr-1" /> Apply</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Hash className="w-4 h-4" /> Page Numbers</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="pn" className="text-xs">Prefix</Label>
                  <Input id="pn" value={pnPrefix} onChange={(e) => setPnPrefix(e.target.value)} className="h-9" />
                </div>
                <Button size="sm" onClick={addPageNumbers} disabled={busy}><Hash className="w-4 h-4 mr-1" /> Apply</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Type className="w-4 h-4" /> Compress</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="cq" className="text-xs">JPEG quality: {compressQ}%</Label>
                  <input id="cq" type="range" min={20} max={95} step={5} value={compressQ} onChange={(e) => setCompressQ(+e.target.value)} className="w-full" />
                </div>
                <Button size="sm" onClick={compress} disabled={busy}><Type className="w-4 h-4 mr-1" /> Compress</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileImage className="w-4 h-4" /> PDF → Images</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" onClick={pdfToImages} disabled={busy}><FileImage className="w-4 h-4 mr-1" /> Export as ZIP</Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Combine className="w-4 h-4" /> Merge PDFs</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="application/pdf" multiple disabled={busy}
              onChange={(e) => { const fs = e.target.files; if (fs && fs.length) merge(fs); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-rose-500 file:text-white hover:file:bg-rose-600 disabled:opacity-50" />
            <p className="text-xs text-muted-foreground mt-2">Select 2+ PDFs — combined in the order picked.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Images → PDF</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="image/png,image/jpeg" multiple disabled={busy}
              onChange={(e) => { const fs = e.target.files; if (fs && fs.length) imagesToPdf(fs); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-rose-500 file:text-white hover:file:bg-rose-600 disabled:opacity-50" />
            <p className="text-xs text-muted-foreground mt-2">PNG or JPG. Page = image size.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Page Preview
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPreview((p) => p ? { ...p, scale: Math.max(0.4, p.scale - 0.2) } : p)}><ZoomOut className="w-4 h-4" /></Button>
              <Badge variant="secondary">{preview ? Math.round(preview.scale * 100) : 100}%</Badge>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPreview((p) => p ? { ...p, scale: Math.min(3, p.scale + 0.2) } : p)}><ZoomIn className="w-4 h-4" /></Button>
            </DialogTitle>
          </DialogHeader>
          {previewPage && (
            <div className="overflow-auto max-h-[70vh] bg-muted rounded flex items-center justify-center p-4">
              <img src={previewPage.thumb} alt="preview" style={{ transform: `rotate(${previewPage.rotation}deg) scale(${preview!.scale})`, transformOrigin: "center" }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PdfEdit;