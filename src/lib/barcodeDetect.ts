import { BrowserMultiFormatReader } from "@zxing/browser";
import { NotFoundException, DecodeHintType, BarcodeFormat as ZXBarcodeFormat } from "@zxing/library";

export type DetectedCode = { rawValue: string; format: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nativeDetector: any = null;
let nativeTried = false;

const getNative = async () => {
  if (nativeTried) return nativeDetector;
  nativeTried = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BD: any = (globalThis as any).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats = await BD.getSupportedFormats?.().catch(() => []);
    nativeDetector = new BD(formats?.length ? { formats } : undefined);
  } catch {
    nativeDetector = null;
  }
  return nativeDetector;
};

let zxingReader: BrowserMultiFormatReader | null = null;
const getZxing = () => {
  if (zxingReader) return zxingReader;
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    ZXBarcodeFormat.QR_CODE, ZXBarcodeFormat.CODE_128, ZXBarcodeFormat.CODE_39,
    ZXBarcodeFormat.EAN_13, ZXBarcodeFormat.EAN_8, ZXBarcodeFormat.UPC_A,
    ZXBarcodeFormat.UPC_E, ZXBarcodeFormat.ITF, ZXBarcodeFormat.DATA_MATRIX,
    ZXBarcodeFormat.PDF_417, ZXBarcodeFormat.AZTEC, ZXBarcodeFormat.CODABAR,
  ]);
  zxingReader = new BrowserMultiFormatReader(hints);
  return zxingReader;
};

export const isNativeBarcodeSupported = () =>
  typeof globalThis !== "undefined" && "BarcodeDetector" in (globalThis as unknown as Record<string, unknown>);

export async function detectFromCanvas(canvas: HTMLCanvasElement): Promise<DetectedCode[]> {
  const det = await getNative();
  if (det) {
    try {
      const codes = await det.detect(canvas);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return codes.map((c: any) => ({ rawValue: c.rawValue, format: c.format }));
    } catch { /* fall through */ }
  }
  try {
    const res = await getZxing().decodeFromCanvas(canvas);
    return [{ rawValue: res.getText(), format: ZXBarcodeFormat[res.getBarcodeFormat()] }];
  } catch (err) {
    if (!(err instanceof NotFoundException)) console.warn(err);
    return [];
  }
}

export async function detectFromImageFile(file: File): Promise<DetectedCode[]> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width; canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return detectFromCanvas(canvas);
}

export async function detectFromVideoFrame(video: HTMLVideoElement): Promise<DetectedCode[]> {
  const det = await getNative();
  if (det) {
    try {
      const codes = await det.detect(video);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return codes.map((c: any) => ({ rawValue: c.rawValue, format: c.format }));
    } catch { /* fall through */ }
  }
  if (!video.videoWidth || !video.videoHeight) return [];
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return detectFromCanvas(canvas);
}