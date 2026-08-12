import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { logActivity } from "@/lib/activityLog";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Splash from "./components/Splash";
import { AssetDetailsHost } from "./components/UserAssetCard";
// Login is the first screen for unauthenticated users — keep it in the main
// bundle so it paints without an extra chunk round-trip.
import Login from "./pages/Login";

// Factory helpers so we can also warm the chunk after auth.
const l = <T,>(f: () => Promise<T>) => ({ Comp: lazy(f as any), load: f });
const _Dashboard = l(() => import("./pages/Dashboard"));
const _Departments = l(() => import("./pages/Departments"));
const _Accessories = l(() => import("./pages/Accessories"));
const _Products = l(() => import("./pages/Products"));
const _UserProfiles = l(() => import("./pages/UserProfiles"));
const _Printers = l(() => import("./pages/Printers"));
const _IPPhoneList = l(() => import("./pages/IPPhoneList"));
const _WifiList = l(() => import("./pages/WifiList"));
const _IPAddresses = l(() => import("./pages/IPAddresses"));
const _CCTVList = l(() => import("./pages/CCTVList"));
const _CCTVCheckList = l(() => import("./pages/CCTVCheckList"));
const _StickerPrinter = l(() => import("./pages/StickerPrinter"));
const _CropTool = l(() => import("./pages/CropTool"));
const _BarcodeReader = l(() => import("./pages/BarcodeReader"));
const _PdfEdit = l(() => import("./pages/PdfEdit"));
const _ImageEditor = l(() => import("./pages/ImageEditor"));
const _OcrTool = l(() => import("./pages/OcrTool"));
const _PdfAnnotate = l(() => import("./pages/PdfAnnotate"));
const _PdfViewer = l(() => import("./pages/PdfViewer"));
const _BarcodeQrTools = l(() => import("./pages/BarcodeQrTools"));
const _PdfTools = l(() => import("./pages/PdfTools"));
const _Settings = l(() => import("./pages/Settings"));
const _NotFound = l(() => import("./pages/NotFound"));
const _SuperAdmin = l(() => import("./pages/SuperAdmin"));
const _MyProfile = l(() => import("./pages/MyProfile"));
// Light, frequently used routes — warmed first for instant navigation.
const CORE_LAZY = [
  _Dashboard,_Departments,_Accessories,_Products,_UserProfiles,_Printers,_IPPhoneList,
  _WifiList,_IPAddresses,_CCTVList,_CCTVCheckList,_StickerPrinter,
  _Settings,_SuperAdmin,_MyProfile,
];
// Heavy tool routes (pdf / ocr / barcode) — warmed last, well after first paint.
const HEAVY_LAZY = [
  _CropTool,_BarcodeReader,_PdfEdit,_ImageEditor,_OcrTool,_PdfAnnotate,
  _PdfViewer,_BarcodeQrTools,_PdfTools,_NotFound,
];
const Dashboard = _Dashboard.Comp;
const Departments = _Departments.Comp;
const Accessories = _Accessories.Comp;
const Products = _Products.Comp;
const UserProfiles = _UserProfiles.Comp;
const Printers = _Printers.Comp;
const IPPhoneList = _IPPhoneList.Comp;
const WifiList = _WifiList.Comp;
const IPAddresses = _IPAddresses.Comp;
const CCTVList = _CCTVList.Comp;
const CCTVCheckList = _CCTVCheckList.Comp;
const StickerPrinter = _StickerPrinter.Comp;
const CropTool = _CropTool.Comp;
const BarcodeReader = _BarcodeReader.Comp;
const PdfEdit = _PdfEdit.Comp;
const ImageEditor = _ImageEditor.Comp;
const OcrTool = _OcrTool.Comp;
const PdfAnnotate = _PdfAnnotate.Comp;
const PdfViewer = _PdfViewer.Comp;
const BarcodeQrTools = _BarcodeQrTools.Comp;
const PdfTools = _PdfTools.Comp;
const Settings = _Settings.Comp;
const NotFound = _NotFound.Comp;
const SuperAdmin = _SuperAdmin.Comp;
const MyProfile = _MyProfile.Comp;

const queryClient = new QueryClient();

const PrintLogger = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (session) {
      // Data prefetch and chunk warming must never compete with first paint.
      const idle = (cb: () => void, timeout = 2000) =>
        (window as any).requestIdleCallback
          ? (window as any).requestIdleCallback(cb, { timeout })
          : setTimeout(cb, 300);
      idle(() => {
        import("@/lib/prefetch").then((m) => m.prefetchAll()).catch(() => {});
        // Let data requests finish before warming route code. Loading every
        // page chunk at once previously competed with the dashboard's data.
        setTimeout(() => {
          CORE_LAZY.forEach((m) => { try { m.load(); } catch {} });
        }, 5000);
        setTimeout(() => {
          HEAVY_LAZY.forEach((m) => { try { m.load(); } catch {} });
        }, 15000);
      });
    }
    const onBeforePrint = () => {
      const route = window.location.pathname;
      logActivity({ action: "print", entity: "Page", description: `Printed ${route}`, route });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, [session]);

  // Global swipe-right (from left edge) = back navigation
  useEffect(() => {
    let startX = 0, startY = 0, startT = 0, tracking = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > 40) { tracking = false; return; }
      startX = t.clientX; startY = t.clientY; startT = Date.now(); tracking = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      const dt = Date.now() - startT;
      if (dx > 80 && dy < 60 && dt < 600 && location.pathname !== "/" && location.pathname !== "/login") {
        navigate(-1);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [navigate, location.pathname]);
  return null;
};

const App = () => (
  <ReduxProvider store={store}>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PrintLogger />
          <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex flex-col">
            <Navbar />
            <main className="flex-1">
              <Suspense fallback={<Splash label="Loading…" />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/departments" element={<RequireAuth><Departments /></RequireAuth>} />
                <Route path="/accessories" element={<RequireAuth><Accessories /></RequireAuth>} />
                <Route path="/ip-addresses" element={<RequireAuth><IPAddresses /></RequireAuth>} />
                <Route path="/printers" element={<RequireAuth><Printers /></RequireAuth>} />
                <Route path="/ip-phones" element={<RequireAuth><IPPhoneList /></RequireAuth>} />
                <Route path="/wifi-list" element={<RequireAuth><WifiList /></RequireAuth>} />
                <Route path="/cctv-list" element={<RequireAuth><CCTVList /></RequireAuth>} />
                <Route path="/cctv-checklist" element={<RequireAuth><CCTVCheckList /></RequireAuth>} />
                <Route path="/sticker-printer" element={<RequireAuth><StickerPrinter /></RequireAuth>} />
                <Route path="/sticker-printer/crop" element={<RequireAuth><CropTool /></RequireAuth>} />
                <Route path="/sticker-printer/barcode-reader" element={<RequireAuth><BarcodeReader /></RequireAuth>} />
                <Route path="/sticker-printer/pdf-edit" element={<RequireAuth><PdfEdit /></RequireAuth>} />
                <Route path="/sticker-printer/image-editor" element={<RequireAuth><ImageEditor /></RequireAuth>} />
                <Route path="/sticker-printer/ocr" element={<RequireAuth><OcrTool /></RequireAuth>} />
                <Route path="/sticker-printer/pdf-annotate" element={<RequireAuth><PdfAnnotate /></RequireAuth>} />
                <Route path="/sticker-printer/pdf-viewer" element={<RequireAuth><PdfViewer /></RequireAuth>} />
                <Route path="/sticker-printer/barcode-qr" element={<RequireAuth><BarcodeQrTools /></RequireAuth>} />
                <Route path="/sticker-printer/pdf-tools" element={<RequireAuth><PdfTools /></RequireAuth>} />
                <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/user-profiles" element={<RequireAuth><UserProfiles /></RequireAuth>} />
                <Route path="/my-profile" element={<RequireAuth><MyProfile /></RequireAuth>} />
                <Route path="/super-admin" element={<RequireAuth superOnly><SuperAdmin /></RequireAuth>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </main>
            <Footer />
            <AssetDetailsHost />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ReduxProvider>
);

export default App;
