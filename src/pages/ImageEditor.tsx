import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ImageIcon, Upload, RotateCw, FlipHorizontal, FlipVertical, Download, Crop as CropIcon, Type, Eraser, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ReactCrop, { type Crop, type PixelCrop, convertToPixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Filter = "none" | "grayscale" | "sepia" | "invert" | "vintage";
const FILTERS: Filter[] = ["none", "grayscale", "sepia", "invert", "vintage"];

const ImageEditor = () => {
  const navigate = useNavigate();
  const [src, setSrc] = useState("");
  const [name, setName] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [sharp, setSharp] = useState(0);
  const [filter, setFilter] = useState<Filter>("none");
  const [crop, setCrop] = useState<Crop>();
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(90);
  const [wmText, setWmText] = useState("");
  const [bgBusy, setBgBusy] = useState(false);

  const filterCss = () => {
    const parts = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
      blur ? `blur(${blur}px)` : "",
      filter === "grayscale" ? "grayscale(1)" : "",
      filter === "sepia" ? "sepia(1)" : "",
      filter === "invert" ? "invert(1)" : "",
      filter === "vintage" ? "sepia(0.5) contrast(1.1) brightness(1.05)" : "",
    ].filter(Boolean);
    return parts.join(" ");
  };

  const onFile = (f: File) => {
    const r = new FileReader();
    r.onload = () => { setSrc(r.result as string); setName(f.name); };
    r.readAsDataURL(f);
  };

  useEffect(() => {
    if (!src) return;
    setRotation(0); setFlipH(false); setFlipV(false);
    setBrightness(100); setContrast(100); setSaturation(100); setBlur(0); setSharp(0);
    setFilter("none"); setCrop(undefined); setWmText("");
  }, [src]);

  const onImgLoad = () => {
    const im = imgRef.current; if (!im) return;
    setNatural({ w: im.naturalWidth, h: im.naturalHeight });
    setResizeW(im.naturalWidth); setResizeH(im.naturalHeight);
  };

  const exportImage = async () => {
    if (!src || !imgRef.current) return;
    try {
      const im = imgRef.current;
      // 1. crop source
      let srcW = im.naturalWidth, srcH = im.naturalHeight;
      const bmp = await createImageBitmap(await (await fetch(src)).blob());
      let base = document.createElement("canvas");
      base.width = srcW; base.height = srcH;
      base.getContext("2d")!.drawImage(bmp, 0, 0);
      if (crop && crop.width && crop.height) {
        const px = crop.unit === "%" ? convertToPixelCrop(crop as PixelCrop, im.width, im.height) : (crop as PixelCrop);
        const sx = (px.x / im.width) * srcW, sy = (px.y / im.height) * srcH;
        const sw = (px.width / im.width) * srcW, sh = (px.height / im.height) * srcH;
        const c = document.createElement("canvas"); c.width = sw; c.height = sh;
        c.getContext("2d")!.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
        base = c; srcW = sw; srcH = sh;
      }
      // 2. resize
      const targetW = Math.max(1, Math.round(resizeW || srcW));
      const targetH = Math.max(1, Math.round(resizeH || srcH));
      // 3. rotation/flip canvas
      const rot = rotation % 360;
      const swap = rot === 90 || rot === 270;
      const outW = swap ? targetH : targetW;
      const outH = swap ? targetW : targetH;
      const out = document.createElement("canvas");
      out.width = outW; out.height = outH;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = format === "image/jpeg" ? "#fff" : "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, outW, outH);
      ctx.filter = filterCss() || "none";
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(base, -targetW / 2, -targetH / 2, targetW, targetH);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = "none";
      // 4. sharpen (light unsharp mask via contrast bump)
      if (sharp > 0) {
        ctx.globalAlpha = Math.min(1, sharp / 100);
        ctx.globalCompositeOperation = "overlay";
        ctx.drawImage(out, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
      // 5. watermark
      if (wmText.trim()) {
        const fs = Math.max(16, Math.floor(Math.min(outW, outH) / 20));
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 2;
        const pad = 12;
        ctx.strokeText(wmText, pad, outH - pad);
        ctx.fillText(wmText, pad, outH - pad);
      }
      const blob = await new Promise<Blob>((r) => out.toBlob((b) => r(b!), format, quality / 100));
      const ext = format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${name.replace(/\.[^.]+$/, "") || "image"}-edited.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Exported ${(blob.size / 1024).toFixed(0)} KB`);
    } catch (e: any) { toast.error("Export failed: " + e.message); }
  };

  const removeBg = async () => {
    if (!src) return;
    setBgBusy(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(src);
      const url = URL.createObjectURL(blob);
      const reader = new FileReader();
      reader.onload = () => { setSrc(reader.result as string); URL.revokeObjectURL(url); toast.success("Background removed"); };
      reader.readAsDataURL(blob);
    } catch (e: any) { toast.error("BG removal failed: " + (e.message || e)); }
    finally { setBgBusy(false); }
  };

  const Slider = ({ label, val, set, min, max, step = 1 }: { label: string; val: number; set: (n: number) => void; min: number; max: number; step?: number }) => (
    <div>
      <Label className="text-xs flex justify-between"><span>{label}</span><span className="text-muted-foreground">{val}</span></Label>
      <input type="range" min={min} max={max} step={step} value={val} onChange={(e) => set(+e.target.value)} className="w-full" />
    </div>
  );

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate("/sticker-printer")}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ImageIcon className="w-6 h-6 text-amber-500" /> Image Editor</h1>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4" /> Load Image</CardTitle></CardHeader>
        <CardContent>
          <input type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-amber-500 file:text-white hover:file:bg-amber-600" />
          {natural.w > 0 && <div className="mt-2 flex gap-2"><Badge variant="secondary">{name}</Badge><Badge>{natural.w}×{natural.h}</Badge></div>}
        </CardContent>
      </Card>

      {src && (
        <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CropIcon className="w-4 h-4" /> Preview · drag to crop</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-muted rounded overflow-auto flex items-center justify-center p-4" style={{ maxHeight: "70vh" }}>
                <ReactCrop crop={crop} onChange={(c) => setCrop(c)}>
                  <img
                    ref={imgRef}
                    src={src}
                    onLoad={onImgLoad}
                    alt="edit"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "60vh",
                      transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                      filter: filterCss(),
                    }}
                  />
                </ReactCrop>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Transform</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="w-4 h-4 mr-1" /> Rotate</Button>
                  <Button size="sm" variant={flipH ? "default" : "outline"} onClick={() => setFlipH((v) => !v)}><FlipHorizontal className="w-4 h-4 mr-1" /> Flip H</Button>
                  <Button size="sm" variant={flipV ? "default" : "outline"} onClick={() => setFlipV((v) => !v)}><FlipVertical className="w-4 h-4 mr-1" /> Flip V</Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Width</Label><Input type="number" value={resizeW} onChange={(e) => setResizeW(+e.target.value || 0)} className="h-8" /></div>
                  <div><Label className="text-xs">Height</Label><Input type="number" value={resizeH} onChange={(e) => setResizeH(+e.target.value || 0)} className="h-8" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Adjust</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Slider label="Brightness" val={brightness} set={setBrightness} min={0} max={200} />
                <Slider label="Contrast" val={contrast} set={setContrast} min={0} max={200} />
                <Slider label="Saturation" val={saturation} set={setSaturation} min={0} max={200} />
                <Slider label="Blur (px)" val={blur} set={setBlur} min={0} max={20} />
                <Slider label="Sharpen" val={sharp} set={setSharp} min={0} max={100} />
                <div>
                  <Label className="text-xs">Filter</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {FILTERS.map((f) => (
                      <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="h-7 text-xs capitalize">{f}</Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Type className="w-4 h-4" /> Watermark</CardTitle></CardHeader>
              <CardContent>
                <Input value={wmText} onChange={(e) => setWmText(e.target.value)} placeholder="Optional text watermark" className="h-8" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Eraser className="w-4 h-4" /> Background Removal</CardTitle></CardHeader>
              <CardContent>
                <Button size="sm" className="w-full" onClick={removeBg} disabled={bgBusy}>
                  {bgBusy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing… (first run downloads model)</> : <><Eraser className="w-4 h-4 mr-1" /> Remove Background</>}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">Runs in-browser via AI. First use downloads ~40 MB.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4" /> Export</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-1">
                  {(["image/png", "image/jpeg", "image/webp"] as const).map((f) => (
                    <Button key={f} size="sm" variant={format === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFormat(f)}>{f.split("/")[1].toUpperCase()}</Button>
                  ))}
                </div>
                {format !== "image/png" && <Slider label="Quality" val={quality} set={setQuality} min={20} max={100} />}
                <Button size="sm" className="w-full" onClick={exportImage}><Download className="w-4 h-4 mr-1" /> Download</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;