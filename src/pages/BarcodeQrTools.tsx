import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, QrCode, ScanBarcode, Download, FileText, Search, Camera, StopCircle } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException, DecodeHintType, BarcodeFormat as ZXBarcodeFormat } from "@zxing/library";

// pdfjs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
  return pdfjsLib;
};

type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC" | "ITF14" | "MSI" | "pharmacode" | "codabar";

const BarcodeQrTools = () => {
  const navigate = useNavigate();

  // Generate barcode
  const [bcText, setBcText] = useState("1234567890");
  const [bcFormat, setBcFormat] = useState<BarcodeFormat>("CODE128");
  const [bcBatch, setBcBatch] = useState("");
  const bcRef = useRef<SVGSVGElement>(null);

  const renderBarcode = () => {
    try {
      if (bcRef.current) JsBarcode(bcRef.current, bcText, { format: bcFormat, displayValue: true, margin: 10 });
    } catch (e) { toast.error("Invalid value for " + bcFormat); }
  };

  const downloadBarcode = () => {
    if (!bcRef.current) return;
    const svg = new XMLSerializer().serializeToString(bcRef.current);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    saveAs(blob, `${bcText || "barcode"}.svg`);
  };

  const downloadBarcodeBatch = async () => {
    const values = bcBatch.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!values.length) { toast.error("Enter one value per line"); return; }
    const zip = new JSZip();
    for (const v of values) {
      try {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svg, v, { format: bcFormat, displayValue: true, margin: 10 });
        zip.file(`${v}.svg`, new XMLSerializer().serializeToString(svg));
      } catch { /* skip */ }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "barcodes.zip");
    toast.success(`Exported ${values.length} barcodes`);
  };

  // Generate QR
  const [qrText, setQrText] = useState("https://example.com");
  const [qrSize, setQrSize] = useState(300);
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBg, setQrBg] = useState("#ffffff");
  const [qrBatch, setQrBatch] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const renderQr = async () => {
    try {
      const url = await QRCode.toDataURL(qrText, { width: qrSize, color: { dark: qrColor, light: qrBg }, margin: 2 });
      setQrDataUrl(url);
    } catch { toast.error("Invalid QR value"); }
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl; a.download = "qrcode.png"; a.click();
  };

  const downloadQrBatch = async () => {
    const values = qrBatch.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!values.length) { toast.error("Enter one value per line"); return; }
    const zip = new JSZip();
    for (const v of values) {
      try {
        const url = await QRCode.toDataURL(v, { width: qrSize, color: { dark: qrColor, light: qrBg }, margin: 2 });
        const base64 = url.split(",")[1];
        zip.file(`${v.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.png`, base64, { base64: true });
      } catch { /* skip */ }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "qrcodes.zip");
    toast.success(`Exported ${values.length} QR codes`);
  };

  // Extract from PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<{ page: number; format: string; value: string }[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [busy, setBusy] = useState(false);

  const extractFromPdf = async () => {
    if (!pdfFile) { toast.error("Select a PDF"); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Det: any = (window as any).BarcodeDetector;
    const detector = Det ? new Det() : null;
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      ZXBarcodeFormat.QR_CODE, ZXBarcodeFormat.CODE_128, ZXBarcodeFormat.CODE_39,
      ZXBarcodeFormat.EAN_13, ZXBarcodeFormat.EAN_8, ZXBarcodeFormat.UPC_A,
      ZXBarcodeFormat.UPC_E, ZXBarcodeFormat.ITF, ZXBarcodeFormat.DATA_MATRIX,
      ZXBarcodeFormat.PDF_417, ZXBarcodeFormat.AZTEC, ZXBarcodeFormat.CODABAR,
    ]);
    const zxing = new BrowserMultiFormatReader(hints);
    setBusy(true); setExtracted([]);
    try {
      const pdfjs = await loadPdfJs();
      const buf = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const results: { page: number; format: string; value: string }[] = [];
      const seenOnPage = new Set<string>();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Multi-scale rendering: small barcodes need higher DPI, large QRs decode faster at lower scales.
        for (const scale of [2, 3, 1.5]) {
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width; canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          // White background helps decoders on transparent PDFs
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const pushUnique = (format: string, value: string) => {
            const k = `${i}::${value}`;
            if (seenOnPage.has(k)) return;
            seenOnPage.add(k);
            results.push({ page: i, format, value });
          };
          try {
            if (detector) {
              const codes = await detector.detect(canvas);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              codes.forEach((c: any) => pushUnique(c.format, c.rawValue));
            }
            // Always also try ZXing — catches formats BarcodeDetector misses (DataMatrix, PDF417, Aztec)
            try {
              const res = await zxing.decodeFromCanvas(canvas);
              pushUnique(ZXBarcodeFormat[res.getBarcodeFormat()], res.getText());
            } catch (err) {
              if (!(err instanceof NotFoundException)) console.warn(err);
            }
          } catch { /* ignore per scale */ }
        }
      }
      setExtracted(results);
      toast.success(`Found ${results.length} code(s) across ${pdf.numPages} page(s)`);
    } catch (e) {
      console.error(e); toast.error("Failed to extract");
    } finally { setBusy(false); }
  };

  // ============ Live Camera Scan (ZXing) ============
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camActive, setCamActive] = useState(false);
  const [camLog, setCamLog] = useState<{ value: string; format: string; ts: string }[]>([]);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  const startCamera = async () => {
    if (camActive) return;
    try {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300 });
      readerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;
      const controls = await reader.decodeFromVideoDevice(deviceId ?? undefined, videoRef.current!, (result, err) => {
        if (result) {
          const value = result.getText();
          const format = ZXBarcodeFormat[result.getBarcodeFormat()];
          setCamLog((prev) => {
            if (prev.length && prev[0].value === value) return prev; // dedupe consecutive
            return [{ value, format, ts: new Date().toISOString() }, ...prev].slice(0, 200);
          });
        }
        if (err && !(err instanceof NotFoundException)) console.warn(err);
      });
      controlsRef.current = controls;
      setCamActive(true);
      toast.success("Camera scanning started");
    } catch (e) {
      console.error(e);
      toast.error("Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    readerRef.current = null;
    setCamActive(false);
  };

  useEffect(() => () => { controlsRef.current?.stop?.(); }, []);

  const exportCamLog = () => {
    if (!camLog.length) return;
    const csv = "Timestamp,Format,Value\n" + camLog.map((r) => `${r.ts},${r.format},"${r.value.replace(/"/g, '""')}"`).join("\n");
    saveAs(new Blob([csv], { type: "text/csv" }), "camera-scans.csv");
  };

  const exportExtracted = () => {
    if (!extracted.length) return;
    const csv = "Page,Format,Value\n" + extracted.map(r => `${r.page},${r.format},"${r.value.replace(/"/g, '""')}"`).join("\n");
    saveAs(new Blob([csv], { type: "text/csv" }), "barcodes.csv");
  };

  const filtered = extracted.filter(r => !searchQ || r.value.toLowerCase().includes(searchQ.toLowerCase()));

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4" /> Back</Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">Barcode & QR Tools</h1>
      </div>

      <Tabs defaultValue="barcode">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="barcode"><ScanBarcode className="w-4 h-4 mr-1" /> Barcode</TabsTrigger>
          <TabsTrigger value="qr"><QrCode className="w-4 h-4 mr-1" /> QR Code</TabsTrigger>
          <TabsTrigger value="extract"><FileText className="w-4 h-4 mr-1" /> Extract</TabsTrigger>
          <TabsTrigger value="camera"><Camera className="w-4 h-4 mr-1" /> Camera</TabsTrigger>
          <TabsTrigger value="search"><Search className="w-4 h-4 mr-1" /> Search</TabsTrigger>
        </TabsList>

        <TabsContent value="barcode" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Generate Barcode</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Value</Label>
                  <Input value={bcText} onChange={(e) => setBcText(e.target.value)} />
                </div>
                <div>
                  <Label>Format</Label>
                  <Select value={bcFormat} onValueChange={(v) => setBcFormat(v as BarcodeFormat)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["CODE128", "CODE39", "EAN13", "EAN8", "UPC", "ITF14", "MSI", "pharmacode", "codabar"].map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={renderBarcode}>Preview</Button>
                <Button variant="outline" onClick={downloadBarcode}><Download className="w-4 h-4 mr-1" /> SVG</Button>
              </div>
              <div className="p-4 bg-white rounded border overflow-auto flex justify-center">
                <svg ref={bcRef} />
              </div>
              <div>
                <Label>Batch (one value per line)</Label>
                <Textarea rows={4} value={bcBatch} onChange={(e) => setBcBatch(e.target.value)} placeholder="123&#10;456&#10;789" />
                <Button className="mt-2" variant="outline" onClick={downloadBarcodeBatch}><Download className="w-4 h-4 mr-1" /> Download Batch ZIP</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Generate QR Code</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Value / URL / Text</Label>
                <Textarea rows={3} value={qrText} onChange={(e) => setQrText(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Size</Label>
                  <Input type="number" value={qrSize} onChange={(e) => setQrSize(parseInt(e.target.value) || 300)} />
                </div>
                <div>
                  <Label>Foreground</Label>
                  <Input type="color" value={qrColor} onChange={(e) => setQrColor(e.target.value)} />
                </div>
                <div>
                  <Label>Background</Label>
                  <Input type="color" value={qrBg} onChange={(e) => setQrBg(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={renderQr}>Preview</Button>
                <Button variant="outline" onClick={downloadQr} disabled={!qrDataUrl}><Download className="w-4 h-4 mr-1" /> PNG</Button>
              </div>
              {qrDataUrl && (
                <div className="p-4 bg-white rounded border flex justify-center">
                  <img src={qrDataUrl} alt="QR" />
                </div>
              )}
              <div>
                <Label>Batch (one value per line)</Label>
                <Textarea rows={4} value={qrBatch} onChange={(e) => setQrBatch(e.target.value)} />
                <Button className="mt-2" variant="outline" onClick={downloadQrBatch}><Download className="w-4 h-4 mr-1" /> Download Batch ZIP</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extract" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Extract Barcodes / QR from PDF</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
              <div className="flex gap-2">
                <Button onClick={extractFromPdf} disabled={!pdfFile || busy}>{busy ? "Scanning..." : "Extract All"}</Button>
                <Button variant="outline" onClick={exportExtracted} disabled={!extracted.length}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
              </div>
              {extracted.length > 0 && (
                <div className="max-h-96 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Page</th><th className="p-2 text-left">Format</th><th className="p-2 text-left">Value</th></tr></thead>
                    <tbody>
                      {extracted.map((r, i) => (
                        <tr key={i} className="border-t"><td className="p-2">{r.page}</td><td className="p-2"><Badge variant="secondary">{r.format}</Badge></td><td className="p-2 font-mono">{r.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camera" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Live Camera Scan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Works in every browser via ZXing. Uses the rear camera when available. Detected codes are logged with timestamps below.</p>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-w-2xl mx-auto">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                {!camActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
                    Camera off
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {!camActive ? (
                  <Button onClick={startCamera}><Camera className="w-4 h-4 mr-1" /> Start Camera</Button>
                ) : (
                  <Button variant="destructive" onClick={stopCamera}><StopCircle className="w-4 h-4 mr-1" /> Stop</Button>
                )}
                <Button variant="outline" onClick={exportCamLog} disabled={!camLog.length}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
                <Button variant="ghost" onClick={() => setCamLog([])} disabled={!camLog.length}>Clear log</Button>
                <Badge variant="secondary" className="ml-auto">{camLog.length} scan(s)</Badge>
              </div>
              {camLog.length > 0 && (
                <div className="max-h-72 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Timestamp</th><th className="p-2 text-left">Format</th><th className="p-2 text-left">Value</th></tr></thead>
                    <tbody>
                      {camLog.map((r, i) => (
                        <tr key={i} className="border-t"><td className="p-2 font-mono text-xs">{new Date(r.ts).toLocaleTimeString()}</td><td className="p-2"><Badge variant="secondary">{r.format}</Badge></td><td className="p-2 font-mono break-all">{r.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Search Extracted Barcodes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search value..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              {!extracted.length && <p className="text-sm text-muted-foreground">Run "Extract" first, then search here.</p>}
              {filtered.length > 0 && (
                <div className="max-h-96 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Page</th><th className="p-2 text-left">Format</th><th className="p-2 text-left">Value</th></tr></thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={i} className="border-t"><td className="p-2">{r.page}</td><td className="p-2"><Badge variant="secondary">{r.format}</Badge></td><td className="p-2 font-mono">{r.value}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BarcodeQrTools;