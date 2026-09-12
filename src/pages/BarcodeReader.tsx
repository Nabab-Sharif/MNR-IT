import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ScanBarcode, Camera, Upload, Copy, Trash2, FileText, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { detectFromCanvas, detectFromImageFile, detectFromVideoFrame, isNativeBarcodeSupported } from "@/lib/barcodeDetect";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Hit = { text: string; format: string; at: string };
type MasterEntry = { page: number; code: string | null };

const BarcodeReader = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const nativeSupported = isNativeBarcodeSupported();

  // ---- Master list from PDF ----
  const [master, setMaster] = useState<MasterEntry[]>([]);
  const [pdfName, setPdfName] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // ---- Sequence validation ----
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState<number>(0); // index in master (0-based page)
  const [validating, setValidating] = useState(false);
  const [missing, setMissing] = useState<number[]>([]);
  const [scannedCount, setScannedCount] = useState(0);
  const validatingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const endIndexRef = useRef(0);
  const masterRef = useRef<MasterEntry[]>([]);
  const missingRef = useRef<number[]>([]);
  useEffect(() => { validatingRef.current = validating; }, [validating]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { masterRef.current = master; }, [master]);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
    setValidating(false);
    validatingRef.current = false;
  };

  useEffect(() => () => stop(), []);

  const addHit = (text: string, format: string) => {
    setHits((prev) => (prev[0]?.text === text ? prev : [{ text, format, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 50)));
  };

  const startCamera = async (validate = false) => {
    if (validate) {
      if (!master.length) { toast.error("Upload a PDF first to build the master list."); return; }
      if (startPage < 1 || endPage > master.length || startPage > endPage) {
        toast.error(`Range must be within 1..${master.length}`); return;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      if (validate) {
        currentIndexRef.current = startPage - 1;
        endIndexRef.current = endPage - 1;
        missingRef.current = [];
        setCurrentIndex(startPage - 1);
        setMissing([]);
        setScannedCount(0);
        setValidating(true);
        validatingRef.current = true;
      }
      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const results = await detectFromVideoFrame(videoRef.current);
          for (const r of results) {
            addHit(r.rawValue, r.format);
            if (validatingRef.current) handleValidatedScan(r.rawValue);
          }
        } catch { /* frame skip */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      toast.error("Camera failed: " + (e.message || e));
      stop();
    }
  };

  // Sequence validation: scanned code must match master[currentIndex].
  // If not, look ahead — if code exists at a later page in range, mark pages between as missing and jump.
  const lastAcceptedRef = useRef<string>("");
  const handleValidatedScan = (code: string) => {
    if (code === lastAcceptedRef.current) return; // debounce same frame
    const list = masterRef.current;
    const idx = currentIndexRef.current;
    const end = endIndexRef.current;
    if (idx > end) return;
    const expected = list[idx]?.code;
    if (expected && code === expected) {
      lastAcceptedRef.current = code;
      setScannedCount((n) => n + 1);
      advance(idx + 1);
    } else {
      // look ahead in range
      let foundAt = -1;
      for (let j = idx + 1; j <= end; j++) {
        if (list[j]?.code === code) { foundAt = j; break; }
      }
      if (foundAt >= 0) {
        const skipped: number[] = [];
        for (let j = idx; j < foundAt; j++) skipped.push(list[j].page);
        missingRef.current = [...missingRef.current, ...skipped];
        setMissing((m) => [...m, ...skipped]);
        lastAcceptedRef.current = code;
        setScannedCount((n) => n + 1);
        toast.warning(`Skipped ${skipped.length} page(s): ${skipped.slice(0, 8).join(", ")}${skipped.length > 8 ? "…" : ""}`);
        advance(foundAt + 1);
      }
      // else: unknown code, ignore silently
    }
  };

  const advance = (next: number) => {
    currentIndexRef.current = next;
    setCurrentIndex(next);
    if (next > endIndexRef.current) {
      const miss = missingRef.current;
      setValidating(false);
      validatingRef.current = false;
      stop();
      if (miss.length) toast.error(`Batch ${startPage}-${endPage} complete. Missing pages: ${miss.join(", ")}`, { duration: 8000 });
      else toast.success(`Batch ${startPage}-${endPage} Processing Complete! No missing pages found.`, { duration: 6000 });
    }
  };

  const onFile = async (file: File) => {
    try {
      const results = await detectFromImageFile(file);
      if (!results.length) { toast.info("No barcode found in image"); return; }
      for (const r of results) addHit(r.rawValue, r.format);
      toast.success(`Found ${results.length} code(s)`);
    } catch (e: any) { toast.error("Decode failed: " + (e.message || e)); }
  };

  const onPdfFile = async (file: File) => {
    setPdfBusy(true);
    setPdfProgress(0);
    setMaster([]);
    setPdfName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const n = pdf.numPages;
      const list: MasterEntry[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (let i = 1; i <= n; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        let code: string | null = null;
        try {
          const results = await detectFromCanvas(canvas);
          if (results.length) code = results[0].rawValue;
        } catch { /* skip */ }
        list.push({ page: i, code });
        if (i % 5 === 0 || i === n) {
          setPdfProgress(Math.round((i / n) * 100));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      setMaster(list);
      masterRef.current = list;
      setStartPage(1);
      setEndPage(Math.min(n, 400));
      const noCode = list.filter((e) => !e.code).length;
      toast.success(`Master list built: ${n} pages, ${n - noCode} with barcodes${noCode ? `, ${noCode} without` : ""}`);
    } catch (e: any) {
      toast.error("PDF processing failed: " + (e.message || e));
    } finally {
      setPdfBusy(false);
    }
  };

  const expectedCode = master[currentIndex]?.code || "—";

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanBarcode className="w-6 h-6 text-indigo-500" /> Barcode Reader</h1>
      </div>

      {!nativeSupported && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          Using ZXing fallback — native BarcodeDetector isn't available in this browser. Scanning still works; performance may be slightly lower than Chrome/Edge.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> 1. Build Master List from PDF</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="application/pdf"
            disabled={pdfBusy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdfFile(f); e.currentTarget.value = ""; }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-indigo-500 file:text-white hover:file:bg-indigo-600 disabled:opacity-50"
          />
          {pdfBusy && (
            <div className="space-y-1">
              <Progress value={pdfProgress} />
              <p className="text-xs text-muted-foreground">Reading {pdfName}… {pdfProgress}%</p>
            </div>
          )}
          {!!master.length && !pdfBusy && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{pdfName}</Badge>
              <Badge>{master.length} pages</Badge>
              <Badge variant="outline">{master.filter((e) => e.code).length} with barcode</Badge>
              {master.some((e) => !e.code) && <Badge variant="destructive">{master.filter((e) => !e.code).length} without</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {!!master.length && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Play className="w-4 h-4" /> 2. Select Range & Start Live Scanning</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="sp" className="text-xs">Start Page</Label>
                <Input id="sp" type="number" min={1} max={master.length} value={startPage}
                  onChange={(e) => setStartPage(Math.max(1, Math.min(master.length, Number(e.target.value) || 1)))}
                  className="h-9 w-28" disabled={validating} />
              </div>
              <div>
                <Label htmlFor="ep" className="text-xs">End Page</Label>
                <Input id="ep" type="number" min={1} max={master.length} value={endPage}
                  onChange={(e) => setEndPage(Math.max(1, Math.min(master.length, Number(e.target.value) || 1)))}
                  className="h-9 w-28" disabled={validating} />
              </div>
              {!validating
                ? <Button size="sm" onClick={() => startCamera(true)}><Play className="w-4 h-4 mr-1" /> Start Scanning</Button>
                : <Button size="sm" variant="destructive" onClick={stop}>Stop</Button>}
            </div>
            {validating && (
              <div className="rounded-md border p-3 bg-muted/30 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-indigo-500">Expecting Page {currentIndex + 1}</Badge>
                  <span className="font-mono text-xs break-all">Code: {expectedCode}</span>
                  <Badge variant="outline">Scanned {scannedCount}/{endPage - startPage + 1}</Badge>
                  {!!missing.length && <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{missing.length} missing</Badge>}
                </div>
                <Progress value={((currentIndex - (startPage - 1)) / Math.max(1, endPage - startPage + 1)) * 100} />
                {!!missing.length && <p className="text-xs text-destructive">Missing so far: {missing.join(", ")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Camera className="w-4 h-4" /> Camera</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
              {!scanning && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">Camera off</div>}
              {validating && (
                <div className="absolute top-2 left-2 bg-indigo-500/90 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Sequence mode
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!scanning
                ? <Button size="sm" variant="outline" onClick={() => startCamera(false)}><Camera className="w-4 h-4 mr-1" /> Free Scan</Button>
                : <Button size="sm" variant="destructive" onClick={stop}>Stop</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Image</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
            />
            <p className="text-xs text-muted-foreground">Pick any photo containing a barcode (EAN, Code128, QR, etc.).</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">Results ({hits.length})</CardTitle>
          {!!hits.length && <Button size="sm" variant="outline" onClick={() => setHits([])}><Trash2 className="w-4 h-4 mr-1" /> Clear</Button>}
        </CardHeader>
        <CardContent className="space-y-2">
          {!hits.length && <p className="text-sm text-muted-foreground">No scans yet.</p>}
          {hits.map((h, i) => (
            <div key={i} className="flex items-center gap-2 border rounded-md p-2">
              <Badge variant="secondary" className="text-[10px]">{h.format}</Badge>
              <span className="font-mono text-sm break-all flex-1">{h.text}</span>
              <span className="text-[10px] text-muted-foreground">{h.at}</span>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(h.text); toast.success("Copied"); }}><Copy className="w-4 h-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default BarcodeReader;