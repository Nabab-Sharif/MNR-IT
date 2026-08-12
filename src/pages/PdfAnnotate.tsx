import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Upload, Download, ChevronLeft, ChevronRight, Undo2, Trash2,
  Pen, Square as SquareIcon, Circle as CircleIcon, Minus, ArrowRight, Type,
  StickyNote, PenTool, MousePointer2, Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type Tool = "select" | "pen" | "rect" | "circle" | "line" | "arrow" | "text" | "note" | "sign";
type BaseAnn = { id: string; color: string; width: number };
type PenAnn = BaseAnn & { type: "pen"; points: [number, number][] };
type RectAnn = BaseAnn & { type: "rect"; x: number; y: number; w: number; h: number };
type CircleAnn = BaseAnn & { type: "circle"; x: number; y: number; w: number; h: number };
type LineAnn = BaseAnn & { type: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number };
type TextAnn = BaseAnn & { type: "text"; x: number; y: number; text: string; size: number };
type NoteAnn = BaseAnn & { type: "note"; x: number; y: number; text: string };
type SignAnn = BaseAnn & { type: "sign"; x: number; y: number; w: number; h: number; strokes: [number, number][][] };
type Annotation = PenAnn | RectAnn | CircleAnn | LineAnn | TextAnn | NoteAnn | SignAnn;

const uid = () => Math.random().toString(36).slice(2, 9);

const PdfAnnotate = () => {
  const navigate = useNavigate();
  const [srcBytes, setSrcBytes] = useState<Uint8Array | null>(null);
  const [srcName, setSrcName] = useState("");
  const [pageIdx, setPageIdx] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [annotations, setAnnotations] = useState<Record<number, Annotation[]>>({});
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(3);
  const [busy, setBusy] = useState(false);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [renderSize, setRenderSize] = useState({ w: 0, h: 0 });
  const drawingRef = useRef<Annotation | null>(null);
  const [, force] = useState(0);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  const [textDialog, setTextDialog] = useState<{ x: number; y: number; type: "text" | "note" } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [signPos, setSignPos] = useState<{ x: number; y: number } | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const signStrokesRef = useRef<[number, number][][]>([]);
  const signDrawingRef = useRef<[number, number][] | null>(null);

  const currAnn = annotations[pageIdx] || [];

  const loadPdf = async (file: File) => {
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      setSrcBytes(buf); setSrcName(file.name);
      const pdf = await pdfjsLib.getDocument({ data: buf.slice() }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages); setPageIdx(0); setAnnotations({});
      toast.success(`Loaded ${pdf.numPages} pages`);
    } catch (e: any) { toast.error("Load failed: " + e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const render = async () => {
      const pdf = pdfDocRef.current; if (!pdf) return;
      const page = await pdf.getPage(pageIdx + 1);
      const vp = page.getViewport({ scale: 1.5 });
      const canvas = pageCanvasRef.current!;
      canvas.width = vp.width; canvas.height = vp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      const ov = overlayRef.current!;
      ov.width = vp.width; ov.height = vp.height;
      setRenderSize({ w: vp.width, h: vp.height });
      redraw();
    };
    if (srcBytes) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdx, srcBytes]);

  useEffect(() => { redraw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [annotations, pageIdx]);

  const drawAnn = (ctx: CanvasRenderingContext2D, a: Annotation) => {
    ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = a.width;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (a.type === "pen") {
      ctx.beginPath();
      a.points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
    } else if (a.type === "rect") {
      ctx.strokeRect(a.x, a.y, a.w, a.h);
    } else if (a.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.type === "line" || a.type === "arrow") {
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
      if (a.type === "arrow") {
        const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
        const h = 10 + a.width * 2;
        ctx.beginPath();
        ctx.moveTo(a.x2, a.y2);
        ctx.lineTo(a.x2 - h * Math.cos(ang - Math.PI / 6), a.y2 - h * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(a.x2 - h * Math.cos(ang + Math.PI / 6), a.y2 - h * Math.sin(ang + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      }
    } else if (a.type === "text") {
      ctx.font = `${a.size}px sans-serif`; ctx.textBaseline = "top"; ctx.fillText(a.text, a.x, a.y);
    } else if (a.type === "note") {
      const pad = 6; ctx.font = "12px sans-serif"; ctx.textBaseline = "top";
      const lines = a.text.split("\n"); const w = Math.max(80, ...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
      const h = lines.length * 16 + pad * 2 + 12;
      ctx.fillStyle = "#fde68a"; ctx.strokeStyle = "#b45309";
      ctx.fillRect(a.x, a.y, w, h); ctx.strokeRect(a.x, a.y, w, h);
      ctx.fillStyle = "#111"; lines.forEach((l, i) => ctx.fillText(l, a.x + pad, a.y + pad + 12 + i * 16));
      ctx.fillStyle = "#b45309"; ctx.fillText("📌", a.x + pad, a.y + pad - 4);
    } else if (a.type === "sign") {
      const scale = Math.min(a.w / 200, a.h / 100);
      ctx.save(); ctx.translate(a.x, a.y); ctx.scale(scale, scale);
      ctx.lineWidth = 2; ctx.strokeStyle = a.color;
      a.strokes.forEach((s) => {
        ctx.beginPath();
        s.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
        ctx.stroke();
      });
      ctx.restore();
    }
  };

  const redraw = () => {
    const ov = overlayRef.current; if (!ov) return;
    const ctx = ov.getContext("2d")!;
    ctx.clearRect(0, 0, ov.width, ov.height);
    currAnn.forEach((a) => drawAnn(ctx, a));
    if (drawingRef.current) drawAnn(ctx, drawingRef.current);
  };

  const relCoord = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    const sx = overlayRef.current!.width / r.width, sy = overlayRef.current!.height / r.height;
    return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy] as [number, number];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!srcBytes) return;
    const [x, y] = relCoord(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === "text" || tool === "note") { setTextDialog({ x, y, type: tool }); setTextInput(""); return; }
    if (tool === "sign") { setSignPos({ x, y }); setSignOpen(true); return; }
    const base = { id: uid(), color, width };
    if (tool === "pen") drawingRef.current = { ...base, type: "pen", points: [[x, y]] };
    else if (tool === "rect") drawingRef.current = { ...base, type: "rect", x, y, w: 0, h: 0 };
    else if (tool === "circle") drawingRef.current = { ...base, type: "circle", x, y, w: 0, h: 0 };
    else if (tool === "line" || tool === "arrow") drawingRef.current = { ...base, type: tool, x1: x, y1: y, x2: x, y2: y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const [x, y] = relCoord(e);
    const d = drawingRef.current;
    if (d.type === "pen") d.points.push([x, y]);
    else if (d.type === "rect" || d.type === "circle") { d.w = x - d.x; d.h = y - d.y; }
    else if (d.type === "line" || d.type === "arrow") { d.x2 = x; d.y2 = y; }
    redraw();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    const d = drawingRef.current;
    setAnnotations((prev) => ({ ...prev, [pageIdx]: [...(prev[pageIdx] || []), d] }));
    drawingRef.current = null;
    force((n) => n + 1);
  };

  const undo = () => setAnnotations((prev) => {
    const list = prev[pageIdx] || []; return { ...prev, [pageIdx]: list.slice(0, -1) };
  });
  const clearPage = () => setAnnotations((prev) => ({ ...prev, [pageIdx]: [] }));

  const confirmText = () => {
    if (!textDialog || !textInput.trim()) { setTextDialog(null); return; }
    const base = { id: uid(), color, width };
    const ann: Annotation = textDialog.type === "text"
      ? { ...base, type: "text", x: textDialog.x, y: textDialog.y, text: textInput, size: Math.max(12, width * 6) }
      : { ...base, type: "note", x: textDialog.x, y: textDialog.y, text: textInput };
    setAnnotations((prev) => ({ ...prev, [pageIdx]: [...(prev[pageIdx] || []), ann] }));
    setTextDialog(null);
  };

  // signature pad
  useEffect(() => {
    if (!signOpen) return;
    const c = signCanvasRef.current; if (!c) return;
    c.width = 400; c.height = 200;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    signStrokesRef.current = [];
  }, [signOpen]);

  const signCoord = (e: React.PointerEvent) => {
    const r = signCanvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) * (signCanvasRef.current!.width / r.width), (e.clientY - r.top) * (signCanvasRef.current!.height / r.height)] as [number, number];
  };
  const signDown = (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); signDrawingRef.current = [signCoord(e)]; };
  const signMove = (e: React.PointerEvent) => {
    if (!signDrawingRef.current) return;
    signDrawingRef.current.push(signCoord(e));
    const ctx = signCanvasRef.current!.getContext("2d")!;
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineCap = "round";
    const s = signDrawingRef.current;
    ctx.beginPath(); ctx.moveTo(s[s.length - 2][0], s[s.length - 2][1]); ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]); ctx.stroke();
  };
  const signUp = () => { if (signDrawingRef.current) signStrokesRef.current.push(signDrawingRef.current); signDrawingRef.current = null; };
  const clearSign = () => { const c = signCanvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); signStrokesRef.current = []; };
  const applySign = () => {
    if (!signPos || !signStrokesRef.current.length) { setSignOpen(false); return; }
    const ann: SignAnn = { id: uid(), color: "#0f172a", width: 2, type: "sign", x: signPos.x, y: signPos.y, w: 200, h: 100, strokes: signStrokesRef.current.map((s) => s.map(([x, y]) => [x / 2, y / 2] as [number, number])) };
    setAnnotations((prev) => ({ ...prev, [pageIdx]: [...(prev[pageIdx] || []), ann] }));
    setSignOpen(false);
  };

  const hexToRgb = (hex: string) => {
    const m = hex.replace("#", ""); const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  };

  const savePdf = async () => {
    if (!srcBytes || !pdfDocRef.current) return;
    setBusy(true);
    try {
      const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
      const font = await src.embedFont(StandardFonts.Helvetica);
      const pdfjs = pdfDocRef.current;
      const outPages = src.getPages();
      for (let i = 0; i < outPages.length; i++) {
        const list = annotations[i]; if (!list?.length) continue;
        const pg = outPages[i];
        const jsPage = await pdfjs.getPage(i + 1);
        const vp = jsPage.getViewport({ scale: 1.5 });
        const sx = pg.getWidth() / vp.width;
        const sy = pg.getHeight() / vp.height;
        const toX = (x: number) => x * sx;
        const toY = (y: number) => pg.getHeight() - y * sy;
        for (const a of list) {
          const col = hexToRgb(a.color);
          if (a.type === "pen") {
            for (let k = 1; k < a.points.length; k++) {
              const [x1, y1] = a.points[k - 1], [x2, y2] = a.points[k];
              pg.drawLine({ start: { x: toX(x1), y: toY(y1) }, end: { x: toX(x2), y: toY(y2) }, thickness: a.width * sx, color: col });
            }
          } else if (a.type === "rect") {
            pg.drawRectangle({ x: toX(a.x), y: toY(a.y + a.h), width: a.w * sx, height: a.h * sy, borderColor: col, borderWidth: a.width * sx });
          } else if (a.type === "circle") {
            pg.drawEllipse({ x: toX(a.x + a.w / 2), y: toY(a.y + a.h / 2), xScale: Math.abs(a.w / 2) * sx, yScale: Math.abs(a.h / 2) * sy, borderColor: col, borderWidth: a.width * sx });
          } else if (a.type === "line" || a.type === "arrow") {
            pg.drawLine({ start: { x: toX(a.x1), y: toY(a.y1) }, end: { x: toX(a.x2), y: toY(a.y2) }, thickness: a.width * sx, color: col });
            if (a.type === "arrow") {
              const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
              const h = (10 + a.width * 2);
              const p2x = a.x2 - h * Math.cos(ang - Math.PI / 6), p2y = a.y2 - h * Math.sin(ang - Math.PI / 6);
              const p3x = a.x2 - h * Math.cos(ang + Math.PI / 6), p3y = a.y2 - h * Math.sin(ang + Math.PI / 6);
              pg.drawLine({ start: { x: toX(a.x2), y: toY(a.y2) }, end: { x: toX(p2x), y: toY(p2y) }, thickness: a.width * sx, color: col });
              pg.drawLine({ start: { x: toX(a.x2), y: toY(a.y2) }, end: { x: toX(p3x), y: toY(p3y) }, thickness: a.width * sx, color: col });
            }
          } else if (a.type === "text") {
            pg.drawText(a.text, { x: toX(a.x), y: toY(a.y + a.size), size: a.size * sx, font, color: col });
          } else if (a.type === "note") {
            const lines = a.text.split("\n"); const pad = 6;
            const w = Math.max(80, ...lines.map((l) => font.widthOfTextAtSize(l, 12))) + pad * 2;
            const h = lines.length * 16 + pad * 2 + 12;
            pg.drawRectangle({ x: toX(a.x), y: toY(a.y + h), width: w * sx, height: h * sy, color: rgb(0.99, 0.9, 0.52), borderColor: rgb(0.7, 0.4, 0), borderWidth: 1 });
            lines.forEach((l, k) => pg.drawText(l, { x: toX(a.x + pad), y: toY(a.y + pad + 12 + k * 16 + 12), size: 12 * sx, font, color: rgb(0, 0, 0) }));
          } else if (a.type === "sign") {
            const scale = Math.min(a.w / 200, a.h / 100);
            for (const s of a.strokes) {
              for (let k = 1; k < s.length; k++) {
                const [x1, y1] = s[k - 1], [x2, y2] = s[k];
                pg.drawLine({ start: { x: toX(a.x + x1 * scale), y: toY(a.y + y1 * scale) }, end: { x: toX(a.x + x2 * scale), y: toY(a.y + y2 * scale) }, thickness: 2 * sx, color: col });
              }
            }
          }
        }
      }
      const bytes = await src.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = srcName.replace(/\.pdf$/i, "") + "-annotated.pdf"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Annotated PDF saved");
    } catch (e: any) { toast.error("Save failed: " + e.message); }
    finally { setBusy(false); }
  };

  const totalAnn = Object.values(annotations).reduce((n, a) => n + a.length, 0);

  const ToolBtn = ({ t, icon: Icon, label }: { t: Tool; icon: any; label: string }) => (
    <Button size="sm" variant={tool === t ? "default" : "outline"} onClick={() => setTool(t)} title={label} className="h-8 w-8 p-0"><Icon className="w-4 h-4" /></Button>
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Edit3 className="w-6 h-6 text-violet-500" /> PDF Annotate</h1>
        {totalPages > 0 && <><Badge variant="secondary">{srcName}</Badge><Badge>{totalPages} pages</Badge><Badge variant="outline">{totalAnn} annotations</Badge></>}
      </div>

      {!srcBytes ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Load PDF</CardTitle></CardHeader>
          <CardContent>
            <input type="file" accept="application/pdf" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadPdf(f); e.currentTarget.value = ""; }}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-violet-500 file:text-white hover:file:bg-violet-600" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                <ToolBtn t="select" icon={MousePointer2} label="Select" />
                <ToolBtn t="pen" icon={Pen} label="Freehand" />
                <ToolBtn t="rect" icon={SquareIcon} label="Rectangle" />
                <ToolBtn t="circle" icon={CircleIcon} label="Circle" />
                <ToolBtn t="line" icon={Minus} label="Line" />
                <ToolBtn t="arrow" icon={ArrowRight} label="Arrow" />
                <ToolBtn t="text" icon={Type} label="Text" />
                <ToolBtn t="note" icon={StickyNote} label="Sticky Note" />
                <ToolBtn t="sign" icon={PenTool} label="Signature" />
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Label className="text-xs">Color</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-10 rounded border" />
                <Label className="text-xs">Width</Label>
                <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-24" />
                <Badge variant="outline" className="text-xs">{width}px</Badge>
              </div>
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant="outline" onClick={undo} disabled={!currAnn.length}><Undo2 className="w-4 h-4 mr-1" /> Undo</Button>
                <Button size="sm" variant="outline" onClick={clearPage} disabled={!currAnn.length} className="text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Clear</Button>
                <Button size="sm" onClick={savePdf} disabled={busy}><Download className="w-4 h-4 mr-1" /> Save PDF</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Page {pageIdx + 1} / {totalPages}</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPageIdx((i) => Math.max(0, i - 1))} disabled={pageIdx === 0}><ChevronLeft className="w-4 h-4" /></Button>
                <Input type="number" min={1} max={totalPages} value={pageIdx + 1}
                  onChange={(e) => setPageIdx(Math.max(0, Math.min(totalPages - 1, (+e.target.value || 1) - 1)))}
                  className="h-8 w-20 text-center" />
                <Button size="sm" variant="outline" onClick={() => setPageIdx((i) => Math.min(totalPages - 1, i + 1))} disabled={pageIdx === totalPages - 1}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded overflow-auto flex justify-center p-2" style={{ maxHeight: "75vh" }}>
                <div className="relative" style={{ width: renderSize.w, height: renderSize.h }}>
                  <canvas ref={pageCanvasRef} className="block max-w-full" />
                  <canvas
                    ref={overlayRef}
                    className="absolute inset-0 max-w-full"
                    style={{ cursor: tool === "select" ? "default" : "crosshair", touchAction: "none" }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!textDialog} onOpenChange={(o) => !o && setTextDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{textDialog?.type === "note" ? "Sticky Note" : "Text"}</DialogTitle></DialogHeader>
          <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Enter text…" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextDialog(null)}>Cancel</Button>
            <Button onClick={confirmText}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Draw Signature</DialogTitle></DialogHeader>
          <div className="bg-white border rounded">
            <canvas ref={signCanvasRef}
              className="w-full h-auto touch-none cursor-crosshair"
              onPointerDown={signDown} onPointerMove={signMove} onPointerUp={signUp} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearSign}>Clear</Button>
            <Button variant="outline" onClick={() => setSignOpen(false)}>Cancel</Button>
            <Button onClick={applySign}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PdfAnnotate;