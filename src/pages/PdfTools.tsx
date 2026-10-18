import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Highlighter, Link2, Bookmark, Search, GitCompare, PenTool, FileSignature, Type } from "lucide-react";
import { toast } from "sonner";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { saveAs } from "file-saver";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
  return pdfjsLib;
};

const PdfTools = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "form";

  // ============ Edit All Text ============
  type TextItem = { page: number; x: number; y: number; width: number; size: number; original: string; value: string };
  const [etFile, setEtFile] = useState<File | null>(null);
  const [etItems, setEtItems] = useState<TextItem[]>([]);
  const [etBuf, setEtBuf] = useState<ArrayBuffer | null>(null);
  const [etBusy, setEtBusy] = useState(false);
  const [etFilter, setEtFilter] = useState("");

  const loadEditText = async (f: File) => {
    setEtBusy(true);
    try {
      setEtFile(f);
      const buf = await f.arrayBuffer();
      setEtBuf(buf.slice(0));
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const items: TextItem[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const c = await p.getTextContent();
        const viewport = p.getViewport({ scale: 1 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.items.forEach((it: any) => {
          const str: string = it.str || "";
          if (!str.trim()) return;
          const [a, , , d, e, f2] = it.transform as number[];
          const size = Math.abs(d) || Math.abs(a);
          items.push({ page: i, x: e, y: viewport.height - f2, width: it.width || str.length * size * 0.5, size, original: str, value: str });
        });
      }
      setEtItems(items);
      toast.success(`Loaded ${items.length} text items from ${doc.numPages} page(s)`);
    } catch (e) { console.error(e); toast.error("Failed to load"); }
    finally { setEtBusy(false); }
  };

  const saveEditedText = async () => {
    if (!etBuf || !etItems.length) return;
    setEtBusy(true);
    try {
      const doc = await PDFDocument.load(etBuf, { ignoreEncryption: true });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const changed = etItems.filter((it) => it.value !== it.original);
      changed.forEach((it) => {
        const page = doc.getPage(it.page - 1);
        const pageH = page.getHeight();
        // convert viewport(top-left origin) to pdf-lib(bottom-left origin)
        const yBottom = pageH - it.y;
        page.drawRectangle({ x: it.x - 1, y: yBottom - 1, width: Math.max(it.width, it.size * it.value.length * 0.55) + 2, height: it.size * 1.25 + 2, color: rgb(1, 1, 1) });
        page.drawText(it.value, { x: it.x, y: yBottom, size: it.size, font, color: rgb(0, 0, 0) });
      });
      const bytes = await doc.save();
      saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), (etFile?.name.replace(/\.pdf$/i, "") || "edited") + "-edited.pdf");
      toast.success(`Saved with ${changed.length} edit(s)`);
    } catch (e) { console.error(e); toast.error("Save failed"); }
    finally { setEtBusy(false); }
  };

  const etFiltered = etItems
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !etFilter || it.original.toLowerCase().includes(etFilter.toLowerCase()));

  // ============ Form Fill ============
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formFields, setFormFields] = useState<{ name: string; type: string; value: string }[]>([]);
  const [formDoc, setFormDoc] = useState<PDFDocument | null>(null);

  const loadForm = async (f: File) => {
    setFormFile(f);
    const buf = await f.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const form = doc.getForm();
    const fields = form.getFields().map((fld) => {
      const name = fld.getName();
      const type = fld.constructor.name;
      let value = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try {
        const anyFld = fld as any;
        if (anyFld.getText) value = anyFld.getText() ?? "";
        else if (anyFld.isChecked) value = anyFld.isChecked() ? "true" : "";
      } catch { /* */ }
      return { name, type, value };
    });
    setFormFields(fields);
    setFormDoc(doc);
    toast.success(`Found ${fields.length} form fields`);
  };

  const saveFilledForm = async () => {
    if (!formDoc) return;
    const form = formDoc.getForm();
    formFields.forEach((f) => {
      try {
        const fld = form.getField(f.name);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyFld: any = fld;
        if (anyFld.setText) anyFld.setText(f.value);
        else if (anyFld.check && anyFld.uncheck) { f.value === "true" ? anyFld.check() : anyFld.uncheck(); }
        else if (anyFld.select) anyFld.select(f.value);
      } catch { /* */ }
    });
    const bytes = await formDoc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "filled.pdf");
    toast.success("Filled PDF saved");
  };

  const flattenForm = async () => {
    if (!formDoc) return;
    const form = formDoc.getForm();
    formFields.forEach((f) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyFld: any = form.getField(f.name);
        if (anyFld.setText) anyFld.setText(f.value);
      } catch { /* */ }
    });
    form.flatten();
    const bytes = await formDoc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "flattened.pdf");
    toast.success("Form flattened");
  };

  // ============ Create Fillable Form ============
  const [ffFile, setFfFile] = useState<File | null>(null);
  const [ffPage, setFfPage] = useState(1);
  const [ffFields, setFfFields] = useState<{ name: string; x: number; y: number; w: number; h: number }[]>([]);

  const addFfField = () => setFfFields([...ffFields, { name: `field_${ffFields.length + 1}`, x: 50, y: 700, w: 200, h: 24 }]);

  const generateFillable = async () => {
    if (!ffFile) { toast.error("Select a PDF"); return; }
    const buf = await ffFile.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const form = doc.getForm();
    const page = doc.getPage(Math.max(0, ffPage - 1));
    ffFields.forEach((f) => {
      const tf = form.createTextField(f.name);
      tf.addToPage(page, { x: f.x, y: f.y, width: f.w, height: f.h, borderColor: rgb(0.3, 0.3, 0.9), borderWidth: 1 });
    });
    const bytes = await doc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "fillable.pdf");
    toast.success("Fillable PDF created");
  };

  // ============ Digital Signature (visual) ============
  const [sigFile, setSigFile] = useState<File | null>(null);
  const sigCanvas = useRef<HTMLCanvasElement>(null);
  const [signing, setSigning] = useState(false);
  const [sigName, setSigName] = useState("");
  const [sigReason, setSigReason] = useState("Approved");

  useEffect(() => {
    const canvas = sigCanvas.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.lineCap = "round";
    let drawing = false, last: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const down = (e: PointerEvent) => { drawing = true; last = pos(e); };
    const move = (e: PointerEvent) => { if (!drawing || !last) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
    const up = () => { drawing = false; last = null; };
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const clearSig = () => { const c = sigCanvas.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); };

  const applySignature = async () => {
    if (!sigFile) { toast.error("Select a PDF"); return; }
    const canvas = sigCanvas.current!;
    setSigning(true);
    try {
      const buf = await sigFile.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const png = await doc.embedPng(canvas.toDataURL("image/png"));
      const pages = doc.getPages();
      const last = pages[pages.length - 1];
      const w = 180, h = 60;
      last.drawImage(png, { x: 40, y: 40, width: w, height: h });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      last.drawText(`Signed by: ${sigName}`, { x: 40, y: 32, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      last.drawText(`Reason: ${sigReason}  ·  ${new Date().toLocaleString()}`, { x: 40, y: 22, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
      // Metadata as certificate-like info
      doc.setSubject(`Signed by ${sigName} — ${sigReason}`);
      doc.setKeywords(["signed", sigName || "", sigReason || ""]);
      const bytes = await doc.save();
      saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "signed.pdf");
      toast.success("Signature applied");
    } finally { setSigning(false); }
  };

  // ============ Redaction ============
  const [redFile, setRedFile] = useState<File | null>(null);
  const [redTerms, setRedTerms] = useState("");

  const runRedaction = async () => {
    if (!redFile) { toast.error("Select a PDF"); return; }
    const terms = redTerms.split(",").map(s => s.trim()).filter(Boolean);
    if (!terms.length) { toast.error("Enter comma-separated terms"); return; }
    const pdfjs = await loadPdfJs();
    const buf = await redFile.arrayBuffer();
    const doc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
    const rendered = await pdfjs.getDocument({ data: buf }).promise;
    let total = 0;
    for (let i = 0; i < doc.getPageCount(); i++) {
      const p = doc.getPage(i);
      const rp = await rendered.getPage(i + 1);
      const content = await rp.getTextContent();
      const viewport = rp.getViewport({ scale: 1 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content.items.forEach((it: any) => {
        const str: string = it.str || "";
        if (!terms.some(t => str.toLowerCase().includes(t.toLowerCase()))) return;
        const [a, , , d, e, f] = it.transform as number[];
        const x = e;
        const y = viewport.height - f - Math.abs(d);
        const width = it.width || (str.length * Math.abs(a) * 0.5);
        const height = Math.abs(d) * 1.2;
        // pdf-lib uses bottom-left; convert
        p.drawRectangle({ x, y: p.getHeight() - y - height, width, height, color: rgb(0, 0, 0) });
        total++;
      });
    }
    const bytes = await doc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "redacted.pdf");
    toast.success(`Redacted ${total} match(es)`);
  };

  // ============ Bookmarks / Hyperlinks ============
  const [bmFile, setBmFile] = useState<File | null>(null);
  const [bookmarks, setBookmarks] = useState<{ title: string; page: number }[]>([{ title: "Chapter 1", page: 1 }]);
  const [links, setLinks] = useState<{ page: number; x: number; y: number; w: number; h: number; url: string }[]>([]);

  const applyBmAndLinks = async () => {
    if (!bmFile) { toast.error("Select a PDF"); return; }
    const buf = await bmFile.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    // Add link annotations
    for (const l of links) {
      const page = doc.getPage(Math.max(0, l.page - 1));
      const context = doc.context;
      const annot = context.obj({
        Type: "Annot", Subtype: "Link",
        Rect: [l.x, l.y, l.x + l.w, l.y + l.h],
        Border: [0, 0, 1],
        A: { Type: "Action", S: "URI", URI: l.url },
      });
      const ref = context.register(annot);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = (page.node.Annots?.() as any) || context.obj([]);
      existing.push(ref);
      page.node.set(context.obj("Annots") as never, existing as never);
    }
    // Bookmarks (outline)
    if (bookmarks.length) {
      const context = doc.context;
      const outlineDict = context.obj({ Type: "Outlines", Count: bookmarks.length });
      const outlineRef = context.register(outlineDict);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refs = bookmarks.map((b) => {
        const page = doc.getPage(Math.max(0, b.page - 1));
        const dict = context.obj({
          Title: b.title,
          Parent: outlineRef,
          Dest: [page.ref, "Fit"],
        });
        return context.register(dict);
      });
      // link them
      refs.forEach((r, i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dict = context.lookup(r) as any;
        if (i > 0) dict.set(context.obj("Prev") as never, refs[i - 1] as never);
        if (i < refs.length - 1) dict.set(context.obj("Next") as never, refs[i + 1] as never);
      });
      outlineDict.set(context.obj("First") as never, refs[0] as never);
      outlineDict.set(context.obj("Last") as never, refs[refs.length - 1] as never);
      doc.catalog.set(context.obj("Outlines") as never, outlineRef as never);
      doc.catalog.set(context.obj("PageMode") as never, context.obj("UseOutlines") as never);
    }
    const bytes = await doc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "bookmarked.pdf");
    toast.success("Bookmarks & links applied");
  };

  // ============ Search & Replace (overlay) ============
  const [srFile, setSrFile] = useState<File | null>(null);
  const [srFind, setSrFind] = useState("");
  const [srReplace, setSrReplace] = useState("");

  const runSearchReplace = async () => {
    if (!srFile || !srFind) { toast.error("Select PDF and enter search term"); return; }
    const pdfjs = await loadPdfJs();
    const buf = await srFile.arrayBuffer();
    const doc = await PDFDocument.load(buf.slice(0), { ignoreEncryption: true });
    const rendered = await pdfjs.getDocument({ data: buf }).promise;
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let count = 0;
    for (let i = 0; i < doc.getPageCount(); i++) {
      const p = doc.getPage(i);
      const rp = await rendered.getPage(i + 1);
      const content = await rp.getTextContent();
      const viewport = rp.getViewport({ scale: 1 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content.items.forEach((it: any) => {
        const str: string = it.str || "";
        if (!str.toLowerCase().includes(srFind.toLowerCase())) return;
        const [a, , , d, e, f] = it.transform as number[];
        const size = Math.abs(d);
        const x = e;
        const y = viewport.height - f - size;
        const width = it.width || (str.length * size * 0.5);
        p.drawRectangle({ x, y: p.getHeight() - y - size * 1.2, width, height: size * 1.4, color: rgb(1, 1, 1) });
        p.drawText(str.replace(new RegExp(srFind, "gi"), srReplace), { x, y: p.getHeight() - y - size, size, font, color: rgb(0, 0, 0) });
        count++;
      });
    }
    const bytes = await doc.save();
    saveAs(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), "replaced.pdf");
    toast.success(`Replaced text on ${count} location(s)`);
  };

  // ============ PDF Compare ============
  const [cmpA, setCmpA] = useState<File | null>(null);
  const [cmpB, setCmpB] = useState<File | null>(null);
  const [diffs, setDiffs] = useState<{ page: number; a: string; b: string }[]>([]);

  const runCompare = async () => {
    if (!cmpA || !cmpB) { toast.error("Select two PDFs"); return; }
    const pdfjs = await loadPdfJs();
    const getText = async (f: File) => {
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const c = await p.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pages.push(c.items.map((it: any) => it.str).join(" "));
      }
      return pages;
    };
    const [ta, tb] = await Promise.all([getText(cmpA), getText(cmpB)]);
    const n = Math.max(ta.length, tb.length);
    const out: { page: number; a: string; b: string }[] = [];
    for (let i = 0; i < n; i++) {
      const a = ta[i] || "(missing)"; const b = tb[i] || "(missing)";
      if (a !== b) out.push({ page: i + 1, a: a.slice(0, 200), b: b.slice(0, 200) });
    }
    setDiffs(out);
    toast.success(`Found ${out.length} differing page(s)`);
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4" /> Back</Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-fuchsia-500 to-pink-500 bg-clip-text text-transparent">PDF Advanced Tools</h1>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
          <TabsTrigger value="form"><FileText className="w-4 h-4 mr-1" /> Form Fill</TabsTrigger>
          <TabsTrigger value="createform"><PenTool className="w-4 h-4 mr-1" /> Create Form</TabsTrigger>
          <TabsTrigger value="edittext"><Type className="w-4 h-4 mr-1" /> Edit Text</TabsTrigger>
          <TabsTrigger value="sign"><FileSignature className="w-4 h-4 mr-1" /> Sign</TabsTrigger>
          <TabsTrigger value="redact"><Highlighter className="w-4 h-4 mr-1" /> Redact</TabsTrigger>
          <TabsTrigger value="bookmarks"><Bookmark className="w-4 h-4 mr-1" /> Bookmarks</TabsTrigger>
          <TabsTrigger value="replace"><Search className="w-4 h-4 mr-1" /> Replace</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="w-4 h-4 mr-1" /> Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4">
          <Card><CardHeader><CardTitle>Fill Existing PDF Form</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && loadForm(e.target.files[0])} />
              {formFields.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-auto border rounded p-3">
                  {formFields.map((f, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="text-sm truncate" title={f.name}>{f.name}</Label>
                      <Badge variant="secondary" className="w-fit text-xs">{f.type}</Badge>
                      <Input value={f.value} onChange={(e) => { const c = [...formFields]; c[i].value = e.target.value; setFormFields(c); }} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveFilledForm} disabled={!formFields.length}><Download className="w-4 h-4 mr-1" /> Save Filled</Button>
                <Button variant="outline" onClick={flattenForm} disabled={!formFields.length}>Flatten & Save</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="createform" className="space-y-4">
          <Card><CardHeader><CardTitle>Create Fillable Form</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setFfFile(e.target.files?.[0] || null)} />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Page #</Label><Input type="number" min={1} value={ffPage} onChange={(e) => setFfPage(parseInt(e.target.value) || 1)} /></div>
                <div className="flex items-end"><Button variant="outline" onClick={addFfField}>+ Add Text Field</Button></div>
              </div>
              {ffFields.map((f, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <Input placeholder="name" value={f.name} onChange={(e) => { const c = [...ffFields]; c[i].name = e.target.value; setFfFields(c); }} />
                  <Input type="number" placeholder="x" value={f.x} onChange={(e) => { const c = [...ffFields]; c[i].x = +e.target.value; setFfFields(c); }} />
                  <Input type="number" placeholder="y" value={f.y} onChange={(e) => { const c = [...ffFields]; c[i].y = +e.target.value; setFfFields(c); }} />
                  <Input type="number" placeholder="w" value={f.w} onChange={(e) => { const c = [...ffFields]; c[i].w = +e.target.value; setFfFields(c); }} />
                  <Input type="number" placeholder="h" value={f.h} onChange={(e) => { const c = [...ffFields]; c[i].h = +e.target.value; setFfFields(c); }} />
                </div>
              ))}
              <Button onClick={generateFillable} disabled={!ffFile}><Download className="w-4 h-4 mr-1" /> Generate Fillable PDF</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edittext" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Edit All Text / Numbers on PDF Pages</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && loadEditText(e.target.files[0])} />
              {etBusy && <p className="text-sm text-muted-foreground">Working...</p>}
              {etItems.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <Input placeholder="Filter by original text..." value={etFilter} onChange={(e) => setEtFilter(e.target.value)} className="max-w-sm" />
                    <Badge variant="secondary">{etItems.length} items</Badge>
                    <Badge className="bg-emerald-600">{etItems.filter((i) => i.value !== i.original).length} edited</Badge>
                  </div>
                  <div className="max-h-[500px] overflow-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left w-12">Pg</th><th className="p-2 text-left">Original</th><th className="p-2 text-left">New value</th></tr></thead>
                      <tbody>
                        {etFiltered.map(({ it, i }) => (
                          <tr key={i} className={"border-t " + (it.value !== it.original ? "bg-emerald-50 dark:bg-emerald-950/20" : "")}>
                            <td className="p-2 font-mono">{it.page}</td>
                            <td className="p-2 text-muted-foreground font-mono text-xs">{it.original}</td>
                            <td className="p-2">
                              <Input value={it.value} onChange={(e) => { const c = [...etItems]; c[i].value = e.target.value; setEtItems(c); }} className="h-8" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button onClick={saveEditedText} disabled={etBusy}><Download className="w-4 h-4 mr-1" /> Save Edited PDF</Button>
                  <p className="text-xs text-muted-foreground">Edited text is overlaid at the original position using Helvetica. For pixel-perfect font matching, use annotation tool for critical documents.</p>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sign" className="space-y-4">
          <Card><CardHeader><CardTitle>Digital / Certificate Signature</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setSigFile(e.target.files?.[0] || null)} />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Signer name</Label><Input value={sigName} onChange={(e) => setSigName(e.target.value)} /></div>
                <div><Label>Reason</Label><Input value={sigReason} onChange={(e) => setSigReason(e.target.value)} /></div>
              </div>
              <div>
                <Label>Draw signature</Label>
                <canvas ref={sigCanvas} width={500} height={140} className="border rounded bg-white touch-none w-full max-w-[500px]" />
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSig}>Clear</Button>
                  <Button onClick={applySignature} disabled={!sigFile || signing}><FileSignature className="w-4 h-4 mr-1" /> Apply & Save</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Note: signature is embedded as an image + metadata (visible signature). For cryptographic PKCS#7 certificate signing, upload the signed PDF to a signing service.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redact" className="space-y-4">
          <Card><CardHeader><CardTitle>Redaction (Hide Sensitive Text)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setRedFile(e.target.files?.[0] || null)} />
              <div>
                <Label>Terms to redact (comma-separated)</Label>
                <Input value={redTerms} onChange={(e) => setRedTerms(e.target.value)} placeholder="e.g. Confidential, SSN, John Doe" />
              </div>
              <Button onClick={runRedaction} disabled={!redFile}><Highlighter className="w-4 h-4 mr-1" /> Redact & Download</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookmarks" className="space-y-4">
          <Card><CardHeader><CardTitle>Bookmarks & Hyperlinks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setBmFile(e.target.files?.[0] || null)} />
              <div>
                <Label>Bookmarks</Label>
                {bookmarks.map((b, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mt-1">
                    <Input className="col-span-3" placeholder="Title" value={b.title} onChange={(e) => { const c = [...bookmarks]; c[i].title = e.target.value; setBookmarks(c); }} />
                    <Input type="number" min={1} placeholder="Page" value={b.page} onChange={(e) => { const c = [...bookmarks]; c[i].page = +e.target.value; setBookmarks(c); }} />
                  </div>
                ))}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setBookmarks([...bookmarks, { title: `Section ${bookmarks.length + 1}`, page: 1 }])}>+ Add Bookmark</Button>
              </div>
              <div>
                <Label>Hyperlinks (page, x, y, w, h, url)</Label>
                {links.map((l, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 mt-1">
                    <Input type="number" placeholder="page" value={l.page} onChange={(e) => { const c = [...links]; c[i].page = +e.target.value; setLinks(c); }} />
                    <Input type="number" placeholder="x" value={l.x} onChange={(e) => { const c = [...links]; c[i].x = +e.target.value; setLinks(c); }} />
                    <Input type="number" placeholder="y" value={l.y} onChange={(e) => { const c = [...links]; c[i].y = +e.target.value; setLinks(c); }} />
                    <Input type="number" placeholder="w" value={l.w} onChange={(e) => { const c = [...links]; c[i].w = +e.target.value; setLinks(c); }} />
                    <Input type="number" placeholder="h" value={l.h} onChange={(e) => { const c = [...links]; c[i].h = +e.target.value; setLinks(c); }} />
                    <Input placeholder="https://..." value={l.url} onChange={(e) => { const c = [...links]; c[i].url = e.target.value; setLinks(c); }} />
                  </div>
                ))}
                <Button size="sm" variant="outline" className="mt-2" onClick={() => setLinks([...links, { page: 1, x: 40, y: 40, w: 120, h: 20, url: "https://" }])}><Link2 className="w-4 h-4 mr-1" /> Add Link</Button>
              </div>
              <Button onClick={applyBmAndLinks} disabled={!bmFile}><Download className="w-4 h-4 mr-1" /> Apply & Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="replace" className="space-y-4">
          <Card><CardHeader><CardTitle>Search & Replace Text</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input type="file" accept="application/pdf" onChange={(e) => setSrFile(e.target.files?.[0] || null)} />
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Find</Label><Input value={srFind} onChange={(e) => setSrFind(e.target.value)} /></div>
                <div><Label>Replace with</Label><Input value={srReplace} onChange={(e) => setSrReplace(e.target.value)} /></div>
              </div>
              <Button onClick={runSearchReplace} disabled={!srFile || !srFind}><Search className="w-4 h-4 mr-1" /> Replace & Save</Button>
              <p className="text-xs text-muted-foreground">Uses overlay method — original text is covered and new text is drawn on top.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-4">
          <Card><CardHeader><CardTitle>Compare Two PDFs (text)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Original</Label><Input type="file" accept="application/pdf" onChange={(e) => setCmpA(e.target.files?.[0] || null)} /></div>
                <div><Label>Modified</Label><Input type="file" accept="application/pdf" onChange={(e) => setCmpB(e.target.files?.[0] || null)} /></div>
              </div>
              <Button onClick={runCompare} disabled={!cmpA || !cmpB}><GitCompare className="w-4 h-4 mr-1" /> Compare</Button>
              {diffs.length > 0 && (
                <div className="max-h-96 overflow-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Page</th><th className="p-2 text-left">Original</th><th className="p-2 text-left">Modified</th></tr></thead>
                    <tbody>
                      {diffs.map((d, i) => (
                        <tr key={i} className="border-t align-top"><td className="p-2 font-mono">{d.page}</td><td className="p-2 text-red-600">{d.a}</td><td className="p-2 text-green-700">{d.b}</td></tr>
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

export default PdfTools;