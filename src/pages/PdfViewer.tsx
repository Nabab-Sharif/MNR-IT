import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, ZoomIn, ZoomOut, ChevronUp, ChevronDown, BookOpen } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PdfViewer = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPdf = async (f: File) => {
    setBusy(true); setPages([]); setName(f.name);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let pdf;
      try { pdf = await pdfjsLib.getDocument({ data: buf }).promise; }
      catch (err: any) {
        if (err?.name === "PasswordException") {
          const pw = window.prompt("Password:") || "";
          if (!pw) return;
          pdf = await pdfjsLib.getDocument({ data: buf, password: pw }).promise;
        } else throw err;
      }
      const imgs: string[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale: 1.5 });
        canvas.width = vp.width; canvas.height = vp.height;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        imgs.push(canvas.toDataURL("image/jpeg", 0.85));
      }
      setPages(imgs); setCurrent(1);
      toast.success(`Loaded ${imgs.length} pages`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!pages.length) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) { const idx = pageRefs.current.findIndex((r) => r === visible.target); if (idx >= 0) setCurrent(idx + 1); }
    }, { root: containerRef.current, threshold: [0.25, 0.5, 0.75] });
    pageRefs.current.forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, [pages]);

  const gotoPage = (n: number) => {
    const idx = Math.max(1, Math.min(pages.length, n));
    pageRefs.current[idx - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrent(idx);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-teal-500" /> PDF Viewer</h1>
        {name && <Badge variant="secondary">{name}</Badge>}
      </div>

      {!pages.length ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Open PDF</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPdf(f); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600 disabled:opacity-50" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => gotoPage(current - 1)} disabled={current <= 1}><ChevronUp className="w-4 h-4" /></Button>
              <Input type="number" value={current} onChange={(e) => gotoPage(+e.target.value || 1)} className="h-8 w-16 text-center" />
              <span className="text-sm text-muted-foreground">/ {pages.length}</span>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => gotoPage(current + 1)} disabled={current >= pages.length}><ChevronDown className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}><ZoomOut className="w-4 h-4" /></Button>
              <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.2))}><ZoomIn className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div ref={containerRef} className="bg-muted rounded overflow-auto p-4 flex flex-col items-center gap-4" style={{ maxHeight: "80vh" }}>
              {pages.map((src, i) => (
                <div key={i} ref={(el) => (pageRefs.current[i] = el)} className="relative bg-white shadow rounded">
                  <img src={src} alt={`page ${i + 1}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="block" />
                  <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">{i + 1}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PdfViewer;