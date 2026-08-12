import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ScanText, Upload, Download, FileText, Copy, ScanBarcode, QrCode } from "lucide-react";
import { toast } from "sonner";
import Tesseract from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { jsPDF } from "jspdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const LANGS = [
  { code: "eng", label: "English" },
  { code: "ben", label: "Bengali" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
];

type PageResult = { page: number; text: string; confidence: number; canvas?: HTMLCanvasElement };

const OcrTool = () => {
  const navigate = useNavigate();
  const [lang, setLang] = useState<string[]>(["eng"]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [results, setResults] = useState<PageResult[]>([]);
  const [sourceName, setSourceName] = useState("");
  const cancelRef = useRef(false);
  const [codes, setCodes] = useState<{ format: string; value: string; page?: number }[]>([]);
  // Barcode detection uses a helper with ZXing fallback so it works in all browsers.

  const toggleLang = (c: string) => setLang((l) => l.includes(c) ? l.filter((x) => x !== c) : [...l, c]);

  const runOcrOn = async (input: HTMLCanvasElement | HTMLImageElement | File) => {
    const { data } = await Tesseract.recognize(input, lang.join("+"), {
      logger: (m) => { if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100)); },
    });
    return { text: data.text, confidence: data.confidence };
  };

  const processImage = async (f: File) => {
    setBusy(true); setResults([]); setSourceName(f.name); setPhase("Recognizing…"); setProgress(0);
    try {
      const r = await runOcrOn(f);
      setResults([{ page: 1, text: r.text, confidence: r.confidence }]);
      toast.success(`Done · confidence ${r.confidence.toFixed(0)}%`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setPhase(""); }
  };

  const processPdf = async (f: File) => {
    setBusy(true); setResults([]); setSourceName(f.name); cancelRef.current = false;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const out: PageResult[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelRef.current) break;
        setPhase(`Rendering page ${i}/${pdf.numPages}`); setProgress(0);
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width; canvas.height = vp.height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        setPhase(`OCR page ${i}/${pdf.numPages}`);
        const r = await runOcrOn(canvas);
        out.push({ page: i, text: r.text, confidence: r.confidence, canvas });
        setResults([...out]);
      }
      toast.success(`Processed ${out.length} page(s)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setPhase(""); }
  };

  const detectCodes = async (file: File) => {
    setBusy(true); setCodes([]); setPhase("Detecting codes…");
    try {
      const { detectFromCanvas, detectFromImageFile } = await import("@/lib/barcodeDetect");
      const found: { format: string; value: string; page?: number }[] = [];
      if (file.type === "application/pdf") {
        const buf = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          setPhase(`Scanning page ${i}/${pdf.numPages}`);
          setProgress(Math.round((i / pdf.numPages) * 100));
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
          const r = await detectFromCanvas(canvas);
          r.forEach((x) => found.push({ format: x.format, value: x.rawValue, page: i }));
        }
      } else {
        const r = await detectFromImageFile(file);
        r.forEach((x) => found.push({ format: x.format, value: x.rawValue }));
      }
      setCodes(found);
      toast.success(`Found ${found.length} code(s)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); setPhase(""); setProgress(0); }
  };

  const combinedText = results.map((r) => `--- Page ${r.page} (${r.confidence.toFixed(0)}%) ---\n${r.text}`).join("\n\n");

  const downloadTxt = () => {
    const blob = new Blob([combinedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = sourceName.replace(/\.[^.]+$/, "") + ".txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSearchablePdf = () => {
    if (!results.length) return;
    const first = results[0].canvas;
    if (!first) { toast.error("Searchable PDF only available from PDF source"); return; }
    const pdf = new jsPDF({ unit: "px", format: [first.width, first.height], orientation: first.width >= first.height ? "landscape" : "portrait", hotfixes: ["px_scaling"] });
    results.forEach((r, i) => {
      const c = r.canvas!;
      if (i > 0) pdf.addPage([c.width, c.height], c.width >= c.height ? "landscape" : "portrait");
      pdf.addImage(c.toDataURL("image/jpeg", 0.85), "JPEG", 0, 0, c.width, c.height, undefined, "FAST");
      const txt = r.text.replace(/\s+/g, " ").trim();
      if (txt) {
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
        const lines = pdf.splitTextToSize(txt, c.width - 8) as string[];
        pdf.text(lines, 4, 10, { renderingMode: "invisible", baseline: "top" } as any);
      }
    });
    pdf.save(sourceName.replace(/\.[^.]+$/, "") + "-searchable.pdf");
    toast.success("Searchable PDF saved");
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ScanText className="w-6 h-6 text-cyan-500" /> OCR — Text Recognition</h1>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Languages</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {LANGS.map((l) => (
            <Button key={l.code} size="sm" variant={lang.includes(l.code) ? "default" : "outline"} onClick={() => toggleLang(l.code)} className="h-7 text-xs">{l.label}</Button>
          ))}
          <span className="text-xs text-muted-foreground ml-2 self-center">Multiple languages can be combined.</span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Image → Text</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="image/*" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processImage(f); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 disabled:opacity-50" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Scanned PDF → Text (batch)</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processPdf(f); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 disabled:opacity-50" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ScanBarcode className="w-4 h-4" /> <QrCode className="w-4 h-4" /> Barcode / QR Detection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input type="file" accept="image/*,application/pdf" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) detectCodes(f); e.currentTarget.value = ""; }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-cyan-500 file:text-white hover:file:bg-cyan-600 disabled:opacity-50" />
          {!!codes.length && (
            <div className="space-y-1 max-h-64 overflow-auto">
              {codes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 border rounded-md p-2 text-sm">
                  <Badge variant="secondary" className="text-[10px]">{c.format}</Badge>
                  {c.page && <Badge variant="outline" className="text-[10px]">Page {c.page}</Badge>}
                  <span className="font-mono break-all flex-1">{c.value}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(c.value); toast.success("Copied"); }}><Copy className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {busy && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between text-sm"><span>{phase}</span><span>{progress}%</span></div>
            <Progress value={progress} />
            <Button size="sm" variant="destructive" onClick={() => { cancelRef.current = true; }}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {!!results.length && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Results — {results.length} page(s)</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(combinedText); toast.success("Copied"); }}><Copy className="w-4 h-4 mr-1" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={downloadTxt}><Download className="w-4 h-4 mr-1" /> .txt</Button>
              <Button size="sm" onClick={downloadSearchablePdf}><FileText className="w-4 h-4 mr-1" /> Searchable PDF</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((r) => (
              <div key={r.page} className="border rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge>Page {r.page}</Badge>
                  <Badge variant={r.confidence > 70 ? "secondary" : "destructive"} className="text-[10px]">Confidence {r.confidence.toFixed(0)}%</Badge>
                </div>
                <pre className="whitespace-pre-wrap text-sm font-sans max-h-64 overflow-auto">{r.text}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OcrTool;