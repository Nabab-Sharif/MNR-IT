import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, Edit, Trash2, ArrowLeft, Printer, Calendar, Eye, Server, ClipboardCheck, Settings2, Type, Columns, WrapText, Merge, FileSpreadsheet, Search, Filter, X, SplitSquareHorizontal, AlertTriangle, CheckCircle, Download, Upload, MoreVertical, History } from "lucide-react";
import dbService from "@/services/dbService";
import CCTVChecklistPrintCard from "@/components/CCTVChecklistPrintCard";

interface NVRCamera {
  id: number;
  camera_id: string;
  location_name: string;
  camera_position: string;
  camera_recordings: string;
  clear_vision: string;
  remarks: string;
}

interface DailyChecklist {
  id: number;
  nvr_id: number;
  date: string;
  cameras: NVRCamera[];
  checked_by: string;
  verified_by: string;
  approved_by: string;
  created_at: string;
  merged_cells?: MergedCell[];
}

interface NVR {
  id: number;
  nvr_number: string;
  name: string;
  total_cameras: number;
  cameras: NVRCamera[];
  created_at: string;
}

interface ColumnSettings {
  sl: number;
  cameraId: number;
  locationName: number;
  cameraPosition: number;
  cameraRecordings: number;
  clearVision: number;
  remarks: number;
}

interface MergedCell {
  startRow: number;
  endRow: number;
  column: keyof ColumnSettings | 'sl';
}

interface CameraIssue {
  nvr_number: string;
  nvr_id: number;
  camera_id: string;
  date: string;
  issue_type: string;
  location: string;
}

const CCTVCheckList = () => {
  const { toast } = useToast();
  const [nvrs, setNvrs] = useState<NVR[]>([]);
  const [checklists, setChecklists] = useState<DailyChecklist[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedNvr, setSelectedNvr] = useState<NVR | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<DailyChecklist | null>(null);
  const [isNvrDialogOpen, setIsNvrDialogOpen] = useState(false);
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
  const [isViewChecklistOpen, setIsViewChecklistOpen] = useState(false);
  const [isIssuesViewOpen, setIsIssuesViewOpen] = useState(false);
  const [editingNvr, setEditingNvr] = useState<NVR | null>(null);
  const [editingCameraIndex, setEditingCameraIndex] = useState<number | null>(null);
  const [statsDialog, setStatsDialog] = useState<null | "total-cameras" | "active" | "issues" | "nvrs" | "prints">(null);

  // Filter & Search states
  const [searchNvr, setSearchNvr] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterNvrNumber, setFilterNvrNumber] = useState("all");

  // Print history (filtered checklist prints)
  interface PrintHistoryEntry {
    id: string;
    printedAt: string;
    fromDate: string;
    toDate: string;
    nvrFilter: string;
    count: number;
  }
  const [printHistory, setPrintHistory] = useState<PrintHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem("cctv_print_history");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Dismissed camera issues (only removed from Issues card, not from checklists data)
  const [dismissedIssues, setDismissedIssues] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("cctv_dismissed_issues");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const dismissedIssuesSet = new Set(dismissedIssues);
  const issueKey = (i: { nvr_id: number; camera_id: string; date: string }) =>
    `${i.nvr_id}-${i.camera_id}-${i.date}`;
  const persistDismissed = (next: string[]) => {
    setDismissedIssues(next);
    try { localStorage.setItem("cctv_dismissed_issues", JSON.stringify(next)); } catch { }
  };

  // Shared styled confirm dialog
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    description: string;
    confirmText?: string;
    tone?: "danger" | "warning";
    onConfirm: () => void;
  }>(null);
  const askConfirm = (opts: { title: string; description: string; confirmText?: string; tone?: "danger" | "warning"; onConfirm: () => void }) => setConfirmState(opts);

  // Row merge states
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);
  const [selectedCellsForMerge, setSelectedCellsForMerge] = useState<{ row: number; column: string }[]>([]);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [dragMerge, setDragMerge] = useState<{ column: string; startRow: number; endRow: number } | null>(null);

  // Excel-like settings
  const [fontSize, setFontSize] = useState(12);
  const [wordWrap, setWordWrap] = useState(true);
  const [rowHeight, setRowHeight] = useState(32);
  const [showSettings, setShowSettings] = useState(false);
  const [columnWidths, setColumnWidths] = useState<ColumnSettings>({
    sl: 35,
    cameraId: 65,
    locationName: 220,
    cameraPosition: 70,
    cameraRecordings: 75,
    clearVision: 65,
    remarks: 200,
  });

  // Print header settings (editable in view)
  const [printHeader, setPrintHeader] = useState({
    companyName: "MNR Sweaters Ltd.",
    reportTitle: "Daily Camera Check & Maintenance Report",
    companyFontSize: 12,
    reportFontSize: 9,
    nvrFontSize: 10,
    signatureTopMargin: 6,
    signatureLineHeight: 18,
  });

  const [nvrFormData, setNvrFormData] = useState({
    nvr_number: "",
    name: "",
    total_cameras: 32,
  });

  const [cameraFormData, setCameraFormData] = useState({
    camera_id: "",
    location_name: "",
    camera_position: "OK",
    camera_recordings: "OK",
    clear_vision: "OK",
    remarks: "",
  });

  const [checklistFormData, setChecklistFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    checked_by: "Officer(IT)",
    verified_by: "Asst. Manager(IT)",
    approved_by: "Head Of HR,Admin",
  });

  const [checklistCameras, setChecklistCameras] = useState<NVRCamera[]>([]);

  // Pagination for Daily Checklists table (5 dates per page)
  const [checklistsPage, setChecklistsPage] = useState(1);
  const CHECKLISTS_PER_PAGE = 30;
  const [checklistDateFilter, setChecklistDateFilter] = useState("");
  const [checklistDateTo, setChecklistDateTo] = useState("");
  const [pendingDeleteChecklistId, setPendingDeleteChecklistId] = useState<number | null>(null);

  // Resizable columns
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    loadData();
    loadExcelSettings();
    loadPrintHeaderSettings();
  }, []);

  // Load saved excel settings from localStorage
  const loadExcelSettings = () => {
    const savedSettings = localStorage.getItem('cctv_excel_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (parsed.wordWrap !== undefined) setWordWrap(parsed.wordWrap);
        if (parsed.rowHeight) setRowHeight(parsed.rowHeight);
        if (parsed.columnWidths) setColumnWidths(parsed.columnWidths);
        // merged cells are per-checklist, no longer loaded from global excel settings
      } catch (e) {
        console.error('Failed to load excel settings:', e);
      }
    }
  };

  const loadPrintHeaderSettings = () => {
    const saved = localStorage.getItem('cctv_print_header');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setPrintHeader((prev) => ({ ...prev, ...parsed }));
    } catch (e) {
      console.error('Failed to load print header settings:', e);
    }
  };

  // Save excel settings when they change
  const saveExcelSettings = () => {
    const settings = {
      fontSize,
      wordWrap,
      rowHeight,
      columnWidths,
    };
    localStorage.setItem('cctv_excel_settings', JSON.stringify(settings));
  };

  const savePrintHeaderSettings = () => {
    localStorage.setItem('cctv_print_header', JSON.stringify(printHeader));
  };

  // Auto-save when settings change
  useEffect(() => {
    saveExcelSettings();
  }, [fontSize, wordWrap, rowHeight, columnWidths]);

  useEffect(() => {
    savePrintHeaderSettings();
  }, [printHeader]);

  const loadData = async () => {
    const nvrsData = await dbService.getNVRs();
    const checklistsData = await dbService.getCCTVChecklists();
    setNvrs(nvrsData || []);
    setChecklists(checklistsData || []);
    await autoFillMissingChecklists(nvrsData || [], checklistsData || []);
  };

  // Auto-fill missing daily checklists for EVERY NVR up to today
  const autoFillMissingChecklists = async (allNvrs: NVR[], allChecklists: DailyChecklist[]) => {
    const today = localDate();
    let addedCount = 0;

    // Only auto-fill missing checklists for the previous 1 month (last 30 days)
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const globalStart = localDate(oneMonthAgo);

    for (const nvr of allNvrs) {
      if (!nvr.cameras || nvr.cameras.length === 0) continue;

      const nvrLists = allChecklists.filter(c => c.nvr_id === nvr.id);
      const existingDates = new Set(nvrLists.map(c => c.date));

      // Use the most recent existing checklist as the template so auto-created
      // days keep the same statuses / remarks / merged cells.
      const template = [...nvrLists].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      const locationAwareCameras = nvr.cameras.map(cam => {
        const loc = (cam.location_name || "").trim();
        const hasLocation = !!loc && loc.toUpperCase() !== "NIL";
        return {
          ...cam,
          camera_position: hasLocation ? "OK" : "NIL",
          camera_recordings: hasLocation ? "OK" : "NIL",
          clear_vision: hasLocation ? "OK" : "NIL",
          remarks: "",
        };
      });

      const defaultCameras = template?.cameras?.length
        ? template.cameras.map(c => ({ ...c }))
        : locationAwareCameras;
      const defaultMerges = template?.merged_cells || [];

      for (let d = new Date(globalStart + "T00:00:00"); localDate(d) <= today; d.setDate(d.getDate() + 1)) {
        const iso = localDate(d);
        if (existingDates.has(iso)) continue;
        await dbService.addCCTVChecklist({
          nvr_id: nvr.id,
          date: iso,
          cameras: defaultCameras,
          checked_by: template?.checked_by || "Officer(IT)",
          verified_by: template?.verified_by || "Asst. Manager(IT)",
          approved_by: template?.approved_by || "Head Of HR,Admin",
          merged_cells: defaultMerges,
        });
        existingDates.add(iso);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      const refreshed = await dbService.getCCTVChecklists();
      setChecklists(refreshed || []);
      toast({
        title: "Auto-Saved Missing Checklists",
        description: `${addedCount} missed daily checklist(s) auto-saved across NVRs.`,
      });
    }
  };

  // Re-check every 5 minutes so a new day auto-creates even if the tab stays open
  useEffect(() => {
    const tick = () => { loadData(); };
    const id = setInterval(tick, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCCTV = async () => {
    try {
      const [nvrsData, camerasData, checklistsData] = await Promise.all([
        dbService.getNVRs(),
        dbService.getCCTVCameras?.() ?? [],
        dbService.getCCTVChecklists(),
      ]);
      const payload = {
        type: "cctv_checklist_backup",
        exportDate: new Date().toISOString(),
        nvrs: nvrsData || [],
        cctv_cameras: camerasData || [],
        cctv_checklists: checklistsData || [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cctv_checklist_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "CCTV checklist data exported." });
    } catch {
      toast({ title: "Export Failed", description: "Could not export CCTV data.", variant: "destructive" });
    }
  };

  const handleImportCCTV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      // Accept both the dedicated CCTV backup and a full-site export
      const root = data?.data && typeof data.data === "object" ? data.data : data;
      const nvrsIn: any[] = Array.isArray(root?.nvrs) ? root.nvrs : [];
      const camsIn: any[] = Array.isArray(root?.cctv_cameras) ? root.cctv_cameras : [];
      const clIn: any[] = Array.isArray(root?.cctv_checklists) ? root.cctv_checklists : [];

      if (!nvrsIn.length && !camsIn.length && !clIn.length) {
        toast({ title: "Nothing to Import", description: "File has no NVR, camera or checklist data.", variant: "destructive" });
        return;
      }

      // ---- Duplicate protection -------------------------------------
      const existingNvrs: any[] = (await dbService.getNVRs()) || [];
      const existingChecklists: any[] = (await dbService.getCCTVChecklists()) || [];
      const norm = (v: any) => String(v ?? "").trim().toLowerCase();

      // Map incoming NVR id -> resolved local NVR id (keeps checklists linked)
      const nvrIdMap = new Map<string, any>();
      const nvrKey = (n: any) => `${norm(n.nvr_number)}|${norm(n.name)}`;
      const existingNvrByKey = new Map<string, any>(existingNvrs.map((n: any) => [nvrKey(n), n]));
      const existingNvrByNumber = new Map<string, any>(existingNvrs.map((n: any) => [norm(n.nvr_number), n]));

      let addedNvrs = 0, skippedNvrs = 0;
      const seenNvrKeys = new Set<string>();
      for (const n of nvrsIn) {
        const key = nvrKey(n);
        const dup =
          existingNvrByKey.get(key) ||
          existingNvrByNumber.get(norm(n.nvr_number));
        if (dup || seenNvrKeys.has(key)) {
          if (dup) nvrIdMap.set(String(n.id), dup.id);
          skippedNvrs++;
          continue;
        }
        seenNvrKeys.add(key);
        await dbService.upsertNVR(n);
        nvrIdMap.set(String(n.id), n.id);
        addedNvrs++;
      }

      const resolveNvrId = (id: any) => (nvrIdMap.has(String(id)) ? nvrIdMap.get(String(id)) : id);

      // Cameras: unique per NVR + camera_id
      let addedCams = 0, skippedCams = 0;
      const seenCamKeys = new Set<string>();
      for (const c of camsIn) {
        const nvrId = resolveNvrId(c.nvr_id);
        const key = `${nvrId}|${norm(c.camera_id ?? c.name)}`;
        if (seenCamKeys.has(key)) { skippedCams++; continue; }
        seenCamKeys.add(key);
        await dbService.upsertCCTVCamera({ ...c, nvr_id: nvrId });
        addedCams++;
      }

      // Checklists: unique per NVR + date
      let addedLists = 0, skippedLists = 0;
      const seenListKeys = new Set(
        existingChecklists.map((c: any) => `${c.nvr_id}|${c.date}`)
      );
      for (const cl of clIn) {
        const nvrId = resolveNvrId(cl.nvr_id);
        const key = `${nvrId}|${cl.date}`;
        if (seenListKeys.has(key)) { skippedLists++; continue; }
        seenListKeys.add(key);
        await dbService.upsertCCTVChecklist({ ...cl, nvr_id: nvrId });
        addedLists++;
      }

      await loadData();
      const skippedTotal = skippedNvrs + skippedCams + skippedLists;
      toast({
        title: "Imported",
        description:
          `${addedNvrs} NVR(s), ${addedCams} camera(s), ${addedLists} checklist(s) imported.` +
          (skippedTotal ? ` ${skippedTotal} duplicate record(s) skipped.` : ""),
        className: "border-2 border-primary shadow-[0_0_20px_hsl(var(--primary)/0.35)]",
      });
    } catch (err: any) {
      toast({
        title: "Import Failed",
        description: err?.message ? String(err.message) : "Invalid backup file.",
        variant: "destructive",
        className: "border-2 border-destructive shadow-[0_0_20px_hsl(var(--destructive)/0.35)]",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Local (not UTC) YYYY-MM-DD so daily auto-create works in any timezone
  const localDate = (d: Date = new Date()) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  const normalizeDateString = (value: string) => String(value || "").trim();

  // Build print table rows honouring saved merged cells (rowspan)
  const buildPrintRows = (
    cameras: any[],
    merged: MergedCell[] | undefined,
    opts: { fontSize: number; rowHeight: number; widths?: Record<string, number> }
  ) => {
    const m = merged || [];
    const findMerge = (row: number, column: string) =>
      m.find((x) => x.column === column && row >= x.startRow && row <= x.endRow);
    const { fontSize, rowHeight } = opts;
    const w = (k: string) => (opts.widths?.[k] ? `width: ${opts.widths[k]}px;` : "");
    const base = `border: 1px solid #000; padding: 2px 3px; font-size: ${fontSize}px; vertical-align: middle;`;

    return cameras
      .map((cam, idx) => {
        const noLoc = !cam.location_name || !String(cam.location_name).trim();
        const locText = noLoc ? "NIL" : cam.location_name;
        const cp = noLoc ? "NIL" : cam.camera_position || "NIL";
        const cv = noLoc ? "NIL" : cam.clear_vision || "NIL";

        const mergeCell = (column: string, value: string, align: string, extraWidth: string) => {
          const mg = findMerge(idx, column);
          if (mg && idx !== mg.startRow) return "";
          const span = mg ? mg.endRow - mg.startRow + 1 : 1;
          return `<td ${span > 1 ? `rowspan="${span}"` : ""} style="${base} text-align: ${align}; ${extraWidth}">${value}</td>`;
        };

        const recValue = noLoc ? "NIL" : cam.camera_recordings || "NIL";

        return `
      <tr style="height: ${rowHeight}px;">
        <td style="${base} text-align: center; ${w("sl")}">${idx + 1}</td>
        <td style="${base} text-align: center; font-weight: bold; ${w("cameraId")}">${cam.camera_id}</td>
        <td style="${base} text-align: left; ${w("locationName")}">${locText}</td>
        <td style="${base} text-align: center; ${w("cameraPosition")}">${cp}</td>
        ${mergeCell("cameraRecordings", recValue, "center", w("cameraRecordings"))}
        <td style="${base} text-align: center; ${w("clearVision")}">${cv}</td>
        ${mergeCell("remarks", cam.remarks || "", "left", w("remarks"))}
      </tr>`;
      })
      .join("");
  };

  // Calculate NVR stats from checklists
  const getNVRStats = () => {
    let totalCameras = 0;
    const issues: CameraIssue[] = [];

    nvrs.forEach(nvr => {
      totalCameras += nvr.cameras?.length || 0;
    });

    // Get latest checklist for each NVR and count issues
    checklists.forEach(checklist => {
      const nvr = nvrs.find(n => n.id === checklist.nvr_id);
      if (!nvr) return;

      checklist.cameras.forEach(cam => {
        const hasIssue = cam.camera_position === "NOT OK" ||
          cam.camera_recordings === "NOT OK" ||
          cam.clear_vision === "NOT OK";

        if (hasIssue) {
          const issueTypes: string[] = [];
          if (cam.camera_position === "NOT OK") issueTypes.push("Position");
          if (cam.camera_recordings === "NOT OK") issueTypes.push("Recording");
          if (cam.clear_vision === "NOT OK") issueTypes.push("Vision");

          issues.push({
            nvr_number: nvr.nvr_number,
            nvr_id: nvr.id,
            camera_id: cam.camera_id,
            date: checklist.date,
            issue_type: issueTypes.join(", "),
            location: cam.location_name || "-",
          });
        }
      });
    });

    // Get unique issues (latest per camera)
    const uniqueIssues: CameraIssue[] = [];
    const seenCameras = new Set<string>();

    // Sort by date descending to get latest first
    const sortedIssues = [...issues].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedIssues.forEach(issue => {
      const key = `${issue.nvr_id}-${issue.camera_id}`;
      const dismissKey = `${issue.nvr_id}-${issue.camera_id}-${issue.date}`;
      if (!seenCameras.has(key) && !dismissedIssuesSet.has(dismissKey)) {
        seenCameras.add(key);
        uniqueIssues.push(issue);
      }
    });

    // Active cameras = cameras whose latest checklist shows all statuses OK
    let activeCameras = 0;
    nvrs.forEach(nvr => {
      const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
      if (nvrChecklists.length === 0) return;
      const latest = nvrChecklists.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      (latest.cameras || []).forEach(cam => {
        const loc = (cam.location_name || '').trim();
        const hasLocation = !!loc && loc.toUpperCase() !== 'NIL';
        if (hasLocation && cam.camera_position === 'OK' && cam.camera_recordings === 'OK' && cam.clear_vision === 'OK') {
          activeCameras++;
        }
      });
    });

    return {
      totalNVRCameras: totalCameras,
      withIssues: uniqueIssues.length,
      activeCameras,
      issues: uniqueIssues,
    };
  };

  const nvrStats = getNVRStats();

  const handleMouseDown = (e: React.MouseEvent, column: keyof ColumnSettings) => {
    resizingColumn.current = column;
    startX.current = e.clientX;
    startWidth.current = columnWidths[column];
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(30, startWidth.current + diff);
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }));
  };

  const handleMouseUp = () => {
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // Filter logic for checklists
  const getFilteredChecklists = (nvrId?: number) => {
    let filtered = nvrId ? checklists.filter(c => c.nvr_id === nvrId) : checklists;

    if (filterDateFrom) {
      filtered = filtered.filter(c => c.date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(c => c.date <= filterDateTo);
    }
    if (filterNvrNumber && filterNvrNumber !== "all") {
      filtered = filtered.filter(c => {
        const nvr = nvrs.find(n => n.id === c.nvr_id);
        return nvr?.nvr_number === filterNvrNumber;
      });
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Filter NVRs by search
  const getFilteredNvrs = () => {
    if (!searchNvr) return nvrs;
    return nvrs.filter(nvr =>
      nvr.nvr_number.toLowerCase().includes(searchNvr.toLowerCase()) ||
      nvr.name?.toLowerCase().includes(searchNvr.toLowerCase())
    );
  };

  // Merge cell functions
  const handleCellClickForMerge = (row: number, column: string) => {
    if (!isMergeMode) return;

    const existingIndex = selectedCellsForMerge.findIndex(c => c.row === row && c.column === column);
    if (existingIndex >= 0) {
      setSelectedCellsForMerge(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      setSelectedCellsForMerge(prev => [...prev, { row, column }]);
    }
  };

  const handleMergeCells = () => {
    if (selectedCellsForMerge.length < 2) {
      toast({ title: "Error", description: "Select at least 2 cells to merge", variant: "destructive" });
      return;
    }

    const columns = [...new Set(selectedCellsForMerge.map(c => c.column))];
    if (columns.length !== 1) {
      toast({ title: "Error", description: "All selected cells must be in the same column", variant: "destructive" });
      return;
    }

    const rows = selectedCellsForMerge.map(c => c.row).sort((a, b) => a - b);
    const startRow = rows[0];
    const endRow = rows[rows.length - 1];

    // Check if consecutive
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] !== rows[i - 1] + 1) {
        toast({ title: "Error", description: "Selected cells must be consecutive rows", variant: "destructive" });
        return;
      }
    }

    // Check for existing merges
    const column = columns[0] as keyof ColumnSettings;
    const hasOverlap = mergedCells.some(m =>
      m.column === column &&
      ((startRow >= m.startRow && startRow <= m.endRow) ||
        (endRow >= m.startRow && endRow <= m.endRow))
    );

    if (hasOverlap) {
      toast({ title: "Error", description: "Cannot merge: overlaps with existing merged cells", variant: "destructive" });
      return;
    }

    setMergedCells(prev => [...prev, { startRow, endRow, column }]);
    setSelectedCellsForMerge([]);
    setIsMergeMode(false);
    toast({ title: "Success", description: "Cells merged successfully" });
  };

  const handleUnmergeAll = () => {
    setMergedCells([]);
    toast({ title: "Success", description: "All cells unmerged" });
  };

  const isCellMerged = (row: number, column: string) => {
    return mergedCells.find(m => m.column === column && row >= m.startRow && row <= m.endRow);
  };

  const shouldRenderCell = (row: number, column: string) => {
    const merge = isCellMerged(row, column);
    if (!merge) return true;
    return row === merge.startRow;
  };

  const getMergeRowSpan = (row: number, column: string) => {
    const merge = isCellMerged(row, column);
    if (!merge || row !== merge.startRow) return 1;
    return merge.endRow - merge.startRow + 1;
  };

  const isCellSelectedForMerge = (row: number, column: string) => {
    return selectedCellsForMerge.some(c => c.row === row && c.column === column);
  };

  // Drag-to-select merge handlers (hold left mouse button and drag across rows)
  const handleMergeDragStart = (e: React.MouseEvent, row: number, column: string) => {
    if (!isMergeMode || e.button !== 0) return;
    e.preventDefault();
    setDragMerge({ column, startRow: row, endRow: row });
    setSelectedCellsForMerge([{ row, column }]);
  };
  const handleMergeDragOver = (e: React.MouseEvent, row: number, column: string) => {
    if (!isMergeMode) return;
    // Require left button still held (buttons bitmask: 1 = primary)
    if ((e.buttons & 1) === 0) return;
    e.preventDefault();
    setDragMerge(prev => {
      if (!prev || prev.column !== column) return prev;
      const lo = Math.min(prev.startRow, row);
      const hi = Math.max(prev.startRow, row);
      const cells = [];
      for (let r = lo; r <= hi; r++) cells.push({ row: r, column });
      setSelectedCellsForMerge(cells);
      return { ...prev, endRow: row };
    });
  };

  useEffect(() => {
    if (!dragMerge) return;
    const up = () => {
      const wasDrag = dragMerge.startRow !== dragMerge.endRow;
      setDragMerge(null);
      if (wasDrag) setTimeout(() => handleMergeCells(), 0);
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [dragMerge]);

  // Print filtered checklists
  const handlePrintFilteredChecklists = () => {
    const filtered = getFilteredChecklists();
    if (filtered.length === 0) {
      toast({ title: "No Checklists", description: "No checklists match the current filters.", variant: "destructive" });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const formatDateStr = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const pages = filtered.map(checklist => {
      const nvr = nvrs.find(n => n.id === checklist.nvr_id);
      const cameraRows = buildPrintRows(checklist.cameras, checklist.merged_cells, {
        fontSize,
        rowHeight,
        widths: columnWidths as any,
      });

      return `
        <div class="page">
          <div class="header">
            <img src="/pictures/a036b691-f157-44ee-9c7c-6c641ef0b004.png" alt="MNR Logo" />
            <h1>${printHeader.companyName}</h1>
            <h2>${printHeader.reportTitle}</h2>
            <div style="font-size: ${printHeader.nvrFontSize}px; font-weight: bold; margin-top: 2px;">NVR-${nvr?.nvr_number || checklist.nvr_id}</div>
          </div>
          <div class="info-row">
            <span></span>
            <span>Date: ${formatDateStr(checklist.date)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: ${columnWidths.sl}px;">SL</th>
                <th style="width: ${columnWidths.cameraId}px;">Camera ID</th>
                <th style="width: ${columnWidths.locationName}px;">Location Name</th>
                <th style="width: ${columnWidths.cameraPosition}px;">Camera Position</th>
                <th style="width: ${columnWidths.cameraRecordings}px;">Camera Recordings</th>
                <th style="width: ${columnWidths.clearVision}px;">Clear Vision</th>
                <th style="width: ${columnWidths.remarks}px;">Remarks</th>
              </tr>
            </thead>
            <tbody>${cameraRows}</tbody>
          </table>
          <div class="signature-section">
            <div class="sig-block"><div class="sig-space"></div><div class="sig-name">${checklist.checked_by}</div></div>
            <div class="sig-block"><div class="sig-space"></div><div class="sig-name">${checklist.verified_by}</div></div>
            <div class="sig-block"><div class="sig-space"></div><div class="sig-name">${checklist.approved_by}</div></div>
          </div>
        </div>
      `;
    }).join("");

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Filtered CCTV Checklists</title>
          <style>
            @page { size: A4; margin: 5mm; }
            @media print { html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 9px; }
            .page { padding: 2mm 3mm; page-break-after: always; width: 210mm; min-height: 290mm; max-height: 297mm; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
            .header { text-align: center; margin-bottom: 2px; }
            .header img { height: 30px; }
            .header h1 { font-size: ${printHeader.companyFontSize}px; color: #1a365d; margin: 1px 0; }
            .header h2 { font-size: ${printHeader.reportFontSize}px; margin: 1px 0; }
            .info-row { display: flex; justify-content: space-between; font-weight: bold; margin: 2px 0; font-size: 9px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #e8e8e8; border: 1px solid #000; padding: 1px; font-weight: bold; font-size: 7px; }
            .signature-section { display: flex; justify-content: space-between; position: absolute; bottom: 5mm; left: 3mm; right: 3mm; }
            .sig-block { text-align: center; flex: 1; padding: 0 6px; }
            .sig-space { height: ${printHeader.signatureLineHeight}px; margin-bottom: 2px; }
            .sig-label { font-size: 7px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
            .sig-name { font-size: 6px; color: #444; margin-top: 1px; }
            .page { position: relative; }
          </style>
        </head>
        <body>${pages}</body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    // Record print history entry
    const entry: PrintHistoryEntry = {
      id: `${Date.now()}`,
      printedAt: new Date().toISOString(),
      fromDate: filterDateFrom || "",
      toDate: filterDateTo || "",
      nvrFilter: filterNvrNumber,
      count: filtered.length,
    };
    const next = [entry, ...printHistory].slice(0, 100);
    setPrintHistory(next);
    try { localStorage.setItem("cctv_print_history", JSON.stringify(next)); } catch { }
  };

  const clearFilters = () => {
    setSearchNvr("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterNvrNumber("all");
  };

  const handleNvrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const trimmedNumber = nvrFormData.nvr_number.trim().toLowerCase();
      const trimmedName = nvrFormData.name.trim().toLowerCase();
      const duplicate = nvrs.find((n) => {
        if (editingNvr && n.id === editingNvr.id) return false;
        const sameNumber = (n.nvr_number || "").trim().toLowerCase() === trimmedNumber;
        const sameName = trimmedName && (n.name || "").trim().toLowerCase() === trimmedName;
        return sameNumber || sameName;
      });
      if (duplicate) {
        toast({
          title: "Duplicate NVR",
          description: "An NVR with the same number or name already exists.",
          variant: "destructive",
        });
        return;
      }
      if (editingNvr) {
        await dbService.updateNVR(editingNvr.id, nvrFormData);
        toast({ title: "NVR Updated", description: "NVR has been updated successfully." });
      } else {
        const defaultCameras: NVRCamera[] = [];
        for (let i = 1; i <= nvrFormData.total_cameras; i++) {
          defaultCameras.push({
            id: i,
            camera_id: `D${i}`,
            location_name: "",
            camera_position: "NIL",
            camera_recordings: "NIL",
            clear_vision: "NIL",
            remarks: "",
          });
        }
        await dbService.addNVR({ ...nvrFormData, cameras: defaultCameras });
        toast({ title: "NVR Created", description: "New NVR has been created successfully." });
      }
      await loadData();
      resetNvrForm();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save NVR.", variant: "destructive" });
    }
  };

  const handleCameraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNvr) return;

    const updatedCameras = [...(selectedNvr.cameras || [])];
    if (editingCameraIndex !== null) {
      updatedCameras[editingCameraIndex] = {
        ...updatedCameras[editingCameraIndex],
        ...cameraFormData,
      };
    }

    setSelectedNvr({ ...selectedNvr, cameras: updatedCameras });
    dbService.updateNVR(selectedNvr.id, { cameras: updatedCameras });
    toast({ title: "Camera Updated", description: "Camera details have been updated." });
    resetCameraForm();
  };

  const handleCreateChecklist = async () => {
    if (!selectedNvr) return;

    const defaultCameras = (selectedNvr.cameras || []).map(cam => {
      const loc = (cam.location_name || "").trim();
      const hasLocation = !!loc && loc.toUpperCase() !== "NIL";
      return {
        ...cam,
        camera_position: hasLocation ? "OK" : "NIL",
        camera_recordings: hasLocation ? "OK" : "NIL",
        clear_vision: hasLocation ? "OK" : "NIL",
        remarks: "",
      };
    });

    const today = localDate();
    const normalizedToday = normalizeDateString(today);

    // If today's checklist already exists (auto-created), open it for editing
    const existingToday = checklists.find(
      (c) => c.nvr_id === selectedNvr.id && normalizeDateString(c.date) === normalizedToday
    );
    if (existingToday) {
      handleViewChecklist(existingToday);
      return;
    }

    setChecklistCameras(defaultCameras);
    setChecklistFormData({
      date: today,
      checked_by: "Officer(IT)",
      verified_by: "Asst. Manager(IT)",
      approved_by: "Head Of HR,Admin",
    });
    setMergedCells([]);
    setSelectedCellsForMerge([]);
    setIsMergeMode(false);
    setIsChecklistDialogOpen(true);
  };

  const handleSaveChecklist = async () => {
    if (!selectedNvr) return;

    // Validate and normalize date before save
    const checklistDate = normalizeDateString(checklistFormData.date);
    if (!checklistDate) {
      toast({
        title: "Missing Date",
        description: "Please select a valid date before saving the checklist.",
        variant: "destructive",
      });
      return;
    }

    // Prevent duplicate: same NVR + same date
    const duplicate = checklists.find(
      (c) => c.nvr_id === selectedNvr.id && normalizeDateString(c.date) === checklistDate
    );
    if (duplicate) {
      toast({
        title: "Duplicate Checklist",
        description: `A checklist for NVR-${selectedNvr.nvr_number} on ${formatDate(checklistDate)} already exists.`,
        variant: "destructive",
      });
      return;
    }

    const newChecklist = {
      nvr_id: selectedNvr.id,
      date: checklistDate,
      cameras: checklistCameras,
      checked_by: checklistFormData.checked_by,
      verified_by: checklistFormData.verified_by,
      approved_by: checklistFormData.approved_by,
      merged_cells: mergedCells,
    };

    try {
      await dbService.addCCTVChecklist(newChecklist);
      toast({ title: "Checklist Saved", description: "Daily checklist has been saved successfully." });
      await loadData();
      setIsChecklistDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error?.message || "Unable to save checklist.",
        variant: "destructive",
      });
    }
  };

  const handleViewChecklist = (checklist: DailyChecklist) => {
    setSelectedChecklist(checklist);
    setChecklistCameras(checklist.cameras);
    setChecklistFormData({
      date: checklist.date,
      checked_by: checklist.checked_by,
      verified_by: checklist.verified_by,
      approved_by: checklist.approved_by,
    });
    setMergedCells(checklist.merged_cells || []);
    setSelectedCellsForMerge([]);
    setIsMergeMode(false);
    setIsViewChecklistOpen(true);
  };

  const handleUpdateChecklist = async () => {
    if (!selectedChecklist) return;

    await dbService.updateCCTVChecklist(selectedChecklist.id, {
      cameras: checklistCameras,
      checked_by: checklistFormData.checked_by,
      verified_by: checklistFormData.verified_by,
      approved_by: checklistFormData.approved_by,
      merged_cells: mergedCells,
    });
    toast({ title: "Checklist Updated", description: "Checklist has been updated successfully." });
    await loadData();
    setIsViewChecklistOpen(false);
    setSelectedChecklist(null);
  };

  const handleDeleteChecklist = (id: number) => {
    setPendingDeleteChecklistId(id);
  };

  const confirmDeleteChecklist = async () => {
    if (pendingDeleteChecklistId == null) return;
    await dbService.deleteCCTVChecklist(pendingDeleteChecklistId);
    await loadData();
    toast({ title: "Checklist Deleted", description: "Checklist has been deleted." });
    setPendingDeleteChecklistId(null);
  };

  const handleDeleteNvr = (id: number) => {
    const nvr = nvrs.find((n) => n.id === id);
    setConfirmState({
      title: "Delete NVR?",
      description: `Are you sure you want to delete ${nvr ? `"${nvr.name}"` : "this NVR"}? This action cannot be undone.`,
      confirmText: "Delete NVR",
      onConfirm: async () => {
        await dbService.deleteNVR(id);
        await loadData();
        toast({ title: "NVR Deleted", description: "NVR has been deleted." });
      },
    });
  };

  const handlePrintChecklist = (checklist: DailyChecklist, nvr: NVR) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Fixed sizing for 32 cameras on one A4 page
    const printFontSize = 9;
    const printRowHeight = 18;

    // Ensure we always show exactly 32 rows (pad with empty if needed)
    const camerasToShow = [...checklist.cameras];
    while (camerasToShow.length < 32) {
      camerasToShow.push({
        id: camerasToShow.length + 1,
        camera_id: `D${camerasToShow.length + 1}`,
        location_name: "",
        camera_position: "",
        camera_recordings: "",
        clear_vision: "",
        remarks: "",
      });
    }

    const cameraRows = buildPrintRows(camerasToShow.slice(0, 32), checklist.merged_cells, {
      fontSize: printFontSize,
      rowHeight: printRowHeight,
    });

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>CCTV Checklist</title>
          <style>
            @page { 
              size: A4; 
              margin: 5mm;
            }
            @media print {
              html, body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: ${printFontSize}px; 
              padding: 3mm;
              background: white;
              width: 210mm;
              height: 297mm;
            }
            .header { text-align: center; margin-bottom: 4px; }
            .header img { height: 35px; }
            .header h1 { font-size: 13px; color: #1a365d; margin: 2px 0; }
            .header h2 { font-size: 10px; margin: 2px 0; }
            .info-row { display: flex; justify-content: space-between; font-weight: bold; margin: 4px 0; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #e8e8e8; border: 1px solid #000; padding: 2px; font-weight: bold; font-size: 8px; }
            .signature-section { 
              display: flex; 
              justify-content: space-between; 
              position: absolute;
              bottom: 8mm;
              left: 5mm;
              right: 5mm;
            }
            .sig-block { 
              text-align: center; 
              flex: 1;
              padding: 0 8px;
            }
            .sig-space {
              height: 20px;
              margin-bottom: 3px;
            }
            .sig-label {
              font-size: 8px;
              font-weight: bold;
              border-top: 1px solid #000;
              padding-top: 3px;
            }
            .sig-name {
              font-size: 7px;
              color: #444;
              margin-top: 1px;
            }
            body {
              position: relative;
              min-height: 287mm;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/pictures/a036b691-f157-44ee-9c7c-6c641ef0b004.png" alt="MNR Logo" />
            <h1>${printHeader.companyName}</h1>
            <h2>${printHeader.reportTitle}</h2>
            <div style="font-size: ${printHeader.nvrFontSize}px; font-weight: bold; margin-top: 3px;">NVR-${nvr.nvr_number}</div>
          </div>
          <div class="info-row">
            <span></span>
            <span>Date: ${formatDate(checklist.date)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">SL</th>
                <th style="width: 50px;">Camera ID</th>
                <th>Location Name</th>
                <th style="width: 55px;">Position</th>
                <th style="width: 55px;">Recording</th>
                <th style="width: 50px;">Vision</th>
                <th style="width: 100px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${cameraRows}
            </tbody>
          </table>
          <div class="signature-section">
            <div class="sig-block">
              <div class="sig-space"></div>
              
              <div class="sig-name">${checklist.checked_by}</div>
            </div>
            <div class="sig-block">
              <div class="sig-space"></div>
              
              <div class="sig-name">${checklist.verified_by}</div>
            </div>
            <div class="sig-block">
              <div class="sig-space"></div>
            
              <div class="sig-name">${checklist.approved_by}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const handlePrintAllNVRs = () => {
    // Get the latest checklist for each NVR
    const latestChecklists: { nvr: NVR; checklist: DailyChecklist }[] = [];

    nvrs.forEach(nvr => {
      const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
      if (nvrChecklists.length > 0) {
        const latest = nvrChecklists.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
        latestChecklists.push({ nvr, checklist: latest });
      }
    });

    if (latestChecklists.length === 0) {
      toast({ title: "No Checklists", description: "No checklists found to print.", variant: "destructive" });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Fixed sizing for 32 cameras on one A4 page
    const printFontSize = 9;
    const printRowHeight = 18;

    const pages = latestChecklists.map(({ nvr, checklist }) => {
      // Ensure we always show exactly 32 rows (pad with empty if needed)
      const camerasToShow = [...checklist.cameras];
      while (camerasToShow.length < 32) {
        camerasToShow.push({
          id: camerasToShow.length + 1,
          camera_id: `D${camerasToShow.length + 1}`,
          location_name: "",
          camera_position: "",
          camera_recordings: "",
          clear_vision: "",
          remarks: "",
        });
      }

      const cameraRows = buildPrintRows(camerasToShow.slice(0, 32), checklist.merged_cells, {
        fontSize: printFontSize,
        rowHeight: printRowHeight,
      });

      return `
        <div class="page">
          <div class="header">
            <img src="/pictures/a036b691-f157-44ee-9c7c-6c641ef0b004.png" alt="MNR Logo" />
            <h1>${printHeader.companyName}</h1>
            <h2>${printHeader.reportTitle}</h2>
            <div style="font-size: ${printHeader.nvrFontSize}px; font-weight: bold; margin-top: 2px;">NVR-${nvr.nvr_number}</div>
          </div>
          <div class="info-row">
            <span></span>
            <span>Date: ${formatDate(checklist.date)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;">SL</th>
                <th style="width: 50px;">Camera ID</th>
                <th>Location Name</th>
                <th style="width: 55px;">Position</th>
                <th style="width: 55px;">Recording</th>
                <th style="width: 50px;">Vision</th>
                <th style="width: 100px;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${cameraRows}
            </tbody>
          </table>
          <div class="signature-section">
            <div class="sig-block">
              <div class="sig-space"></div>
             
              <div class="sig-name">${checklist.checked_by}</div>
            </div>
            <div class="sig-block">
              <div class="sig-space"></div>
             
              <div class="sig-name">${checklist.verified_by}</div>
            </div>
            <div class="sig-block">
              <div class="sig-space"></div>
             
              <div class="sig-name">${checklist.approved_by}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>All NVR Checklists</title>
          <style>
            @page { 
              size: A4; 
              margin: 5mm;
            }
            @media print {
              html, body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: ${printFontSize}px; }
            .page { padding: 2mm 3mm; page-break-after: always; width: 210mm; min-height: 290mm; max-height: 297mm; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
            .header { text-align: center; margin-bottom: 2px; }
            .header img { height: 30px; }
            .header h1 { font-size: ${printHeader.companyFontSize}px; color: #1a365d; margin: 1px 0; }
            .header h2 { font-size: ${printHeader.reportFontSize}px; margin: 1px 0; }
            .info-row { display: flex; justify-content: space-between; font-weight: bold; margin: 2px 0; font-size: 9px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th { background: #e8e8e8; border: 1px solid #000; padding: 1px; font-weight: bold; font-size: 7px; }
            .signature-section { display: flex; justify-content: space-between; position: absolute; bottom: 5mm; left: 3mm; right: 3mm; }
            .sig-block { text-align: center; flex: 1; padding: 0 6px; }
            .sig-space { height: ${printHeader.signatureLineHeight}px; margin-bottom: 2px; }
            .sig-label { font-size: 7px; font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
            .sig-name { font-size: 6px; color: #444; margin-top: 1px; }
            .page { position: relative; }
          </style>
        </head>
        <body>
          ${pages}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  const resetNvrForm = () => {
    setNvrFormData({ nvr_number: "", name: "", total_cameras: 32 });
    setEditingNvr(null);
    setIsNvrDialogOpen(false);
  };

  const resetCameraForm = () => {
    setCameraFormData({
      camera_id: "",
      location_name: "",
      camera_position: "OK",
      camera_recordings: "OK",
      clear_vision: "OK",
      remarks: "",
    });
    setEditingCameraIndex(null);
    setIsCameraDialogOpen(false);
  };

  const handleEditCamera = (camera: NVRCamera, index: number) => {
    setEditingCameraIndex(index);
    setCameraFormData({
      camera_id: camera.camera_id,
      location_name: camera.location_name,
      camera_position: camera.camera_position,
      camera_recordings: camera.camera_recordings,
      clear_vision: camera.clear_vision,
      remarks: camera.remarks,
    });
    setIsCameraDialogOpen(true);
  };

  const updateChecklistCamera = (index: number, field: keyof NVRCamera, value: string) => {
    const updated = [...checklistCameras];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "location_name") {
      const isEmpty = !value || !value.trim();
      if (isEmpty) {
        updated[index].camera_position = "NIL";
        updated[index].camera_recordings = "NIL";
        updated[index].clear_vision = "NIL";
      } else {
        if (updated[index].camera_position === "NIL") updated[index].camera_position = "OK";
        if (updated[index].camera_recordings === "NIL") updated[index].camera_recordings = "OK";
        if (updated[index].clear_vision === "NIL") updated[index].clear_vision = "OK";
      }
    }
    setChecklistCameras(updated);
  };

  const getNvrChecklists = (nvrId: number) => {
    return checklists.filter(c => c.nvr_id === nvrId).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const statsPageConfirmDialog = (
    <AlertDialog open={!!confirmState} onOpenChange={(o) => !o && setConfirmState(null)}>
      <AlertDialogContent
        className={
          confirmState?.tone === "warning"
            ? "z-[200] border-2 border-orange-500/60 shadow-lg shadow-orange-500/20"
            : "z-[200] border-2 border-destructive/60 shadow-lg shadow-destructive/20"
        }
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`flex items-center gap-2 ${confirmState?.tone === "warning" ? "text-orange-600" : "text-destructive"}`}
          >
            <AlertTriangle className="h-5 w-5" />
            {confirmState?.title}
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`mt-2 rounded-md border p-3 text-sm ${confirmState?.tone === "warning"
              ? "border-orange-500/30 bg-orange-500/5"
              : "border-destructive/30 bg-destructive/5"
              }`}
          >
            {confirmState?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              confirmState?.onConfirm();
              setConfirmState(null);
            }}
            className={
              confirmState?.tone === "warning"
                ? "bg-orange-500 text-white hover:bg-orange-500/90"
                : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            }
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {confirmState?.confirmText || "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // NVR List View
  if (!selectedNvr) {
    const filteredNvrs = getFilteredNvrs();
    const filteredChecklistsAll = getFilteredChecklists();

    if (statsDialog) {
      const statsMeta = {
        "total-cameras": {
          title: `All Cameras (${nvrStats.totalNVRCameras})`,
          description: "Complete list of all cameras across all NVRs",
          icon: <Camera className="h-6 w-6 text-primary" />,
        },
        active: {
          title: `Active Cameras (${nvrStats.activeCameras})`,
          description: "Cameras with all checks OK from latest checklists",
          icon: <CheckCircle className="h-6 w-6 text-green-500" />,
        },
        issues: {
          title: `Camera Issues (${nvrStats.withIssues})`,
          description: "Cameras with issues from recent checklists",
          icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
        },
        nvrs: {
          title: `All NVRs (${nvrs.length})`,
          description: "Complete list of all Network Video Recorders",
          icon: <Server className="h-6 w-6 text-blue-500" />,
        },
        prints: {
          title: `Print History (${printHistory.length})`,
          description: "Filtered checklist prints with date range and count",
          icon: <History className="h-6 w-6 text-purple-500" />,
        },
      }[statsDialog];

      return (
        <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setStatsDialog(null)}
              className="border-2 border-primary text-primary hover:bg-primary/10 shadow-sm"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              {statsMeta.icon}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {statsMeta.title}
                </h1>
                <p className="text-muted-foreground mt-1">{statsMeta.description}</p>
              </div>
            </div>
          </div>

          {statsDialog === "total-cameras" && (
            <Card className="border-2 border-primary/40 shadow-md">
              <CardContent className="p-4">
                <div className="rounded-md border-2 border-primary/40 max-h-[72vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-primary/40">
                        <TableHead className="border-r border-primary/30">NVR</TableHead>
                        <TableHead className="border-r border-primary/30">Camera ID</TableHead>
                        <TableHead className="border-r border-primary/30">Location</TableHead>
                        <TableHead className="border-r border-primary/30">Position</TableHead>
                        <TableHead className="border-r border-primary/30">Recording</TableHead>
                        <TableHead>Vision</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nvrs.flatMap(nvr =>
                        (nvr.cameras || []).map((cam, idx) => (
                          <TableRow key={`${nvr.id}-${idx}`} className="border-primary/30">
                            <TableCell className="font-medium border-r border-primary/20">NVR-{nvr.nvr_number}</TableCell>
                            <TableCell className="border-r border-primary/20">{cam.camera_id}</TableCell>
                            <TableCell className="border-r border-primary/20">{cam.location_name || '-'}</TableCell>
                            <TableCell className="border-r border-primary/20">
                              <Badge variant={cam.camera_position === 'OK' ? 'default' : 'destructive'}>{cam.camera_position || '-'}</Badge>
                            </TableCell>
                            <TableCell className="border-r border-primary/20">
                              <Badge variant={cam.camera_recordings === 'OK' ? 'default' : 'destructive'}>{cam.camera_recordings || '-'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={cam.clear_vision === 'OK' ? 'default' : 'destructive'}>{cam.clear_vision || '-'}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {statsDialog === "active" && (
            <Card className="border-2 border-primary/40 shadow-md">
              <CardContent className="p-4">
                <div className="rounded-md border-2 border-primary/40 max-h-[72vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-primary/40">
                        <TableHead className="border-r border-primary/30">NVR</TableHead>
                        <TableHead className="border-r border-primary/30">Camera ID</TableHead>
                        <TableHead className="border-r border-primary/30">Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nvrs.flatMap(nvr => {
                        const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
                        if (nvrChecklists.length === 0) return [];
                        const latestChecklist = nvrChecklists.sort((a, b) =>
                          new Date(b.date).getTime() - new Date(a.date).getTime()
                        )[0];
                        return latestChecklist.cameras.filter(cam =>
                          cam.camera_position === 'OK' && cam.camera_recordings === 'OK' && cam.clear_vision === 'OK'
                        ).map((cam, idx) => (
                          <TableRow key={`${nvr.id}-${idx}`} className="border-primary/30">
                            <TableCell className="font-medium border-r border-primary/20">NVR-{nvr.nvr_number}</TableCell>
                            <TableCell className="border-r border-primary/20">{cam.camera_id}</TableCell>
                            <TableCell className="border-r border-primary/20">{cam.location_name || '-'}</TableCell>
                            <TableCell><Badge className="bg-green-500 hover:bg-green-500">All OK</Badge></TableCell>
                          </TableRow>
                        ));
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {statsDialog === "issues" && (
            <Card className="border-2 border-primary/40 shadow-md">
              <CardContent className="p-4 space-y-4">
                <div className="rounded-md border-2 border-primary/40 max-h-[72vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-primary/40">
                        <TableHead className="border-r border-primary/30">NVR</TableHead>
                        <TableHead className="border-r border-primary/30">Camera</TableHead>
                        <TableHead className="border-r border-primary/30">Location</TableHead>
                        <TableHead className="border-r border-primary/30">Issue Type</TableHead>
                        <TableHead className="border-r border-primary/30">Remarks</TableHead>
                        <TableHead className="border-r border-primary/30">Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nvrStats.issues.map((issue, idx) => {
                        const nvrChecklists = checklists.filter(c => c.nvr_id === issue.nvr_id && c.date === issue.date);
                        const checklist = nvrChecklists[0];
                        const camera = checklist?.cameras.find(c => c.camera_id === issue.camera_id);
                        return (
                          <TableRow key={idx} className="border-primary/30">
                            <TableCell className="font-medium border-r border-primary/20">NVR-{issue.nvr_number}</TableCell>
                            <TableCell className="border-r border-primary/20">{issue.camera_id}</TableCell>
                            <TableCell className="border-r border-primary/20">{issue.location}</TableCell>
                            <TableCell className="border-r border-primary/20">
                              <Badge variant="destructive" className="text-xs">{issue.issue_type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate border-r border-primary/20" title={camera?.remarks || '-'}>
                              {camera?.remarks || '-'}
                            </TableCell>
                            <TableCell className="border-r border-primary/20">{formatDate(issue.date)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  askConfirm({
                                    title: `Remove issue for camera ${issue.camera_id}?`,
                                    description: "This only removes it from the Camera Issues card. The daily checklist stays unchanged.",
                                    confirmText: "Remove",
                                    tone: "warning",
                                    onConfirm: () => persistDismissed([...dismissedIssues, issueKey(issue)]),
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {nvrStats.issues.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        askConfirm({
                          title: `Delete all ${nvrStats.issues.length} issues?`,
                          description: "This clears every issue from this card. The daily checklists are NOT affected.",
                          confirmText: "Delete All",
                          tone: "danger",
                          onConfirm: () => {
                            const keys = nvrStats.issues.map(issueKey);
                            persistDismissed(Array.from(new Set([...dismissedIssues, ...keys])));
                          },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete All Issues
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {statsDialog === "nvrs" && (
            <Card className="border-2 border-primary/40 shadow-md">
              <CardContent className="p-4">
                <div className="rounded-md border-2 border-primary/40 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-primary/40">
                        <TableHead className="border-r border-primary/30">NVR Number</TableHead>
                        <TableHead className="border-r border-primary/30">Name</TableHead>
                        <TableHead className="border-r border-primary/30">Total Cameras</TableHead>
                        <TableHead className="border-r border-primary/30">Checklists</TableHead>
                        <TableHead>Last Check</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nvrs.map(nvr => {
                        const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
                        const latestDate = nvrChecklists.length > 0
                          ? formatDate(nvrChecklists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
                          : '-';
                        return (
                          <TableRow key={nvr.id} className="border-primary/30">
                            <TableCell className="font-bold text-primary border-r border-primary/20">NVR-{nvr.nvr_number}</TableCell>
                            <TableCell className="border-r border-primary/20">{nvr.name || '-'}</TableCell>
                            <TableCell className="border-r border-primary/20"><Badge variant="secondary">{nvr.cameras?.length || nvr.total_cameras}</Badge></TableCell>
                            <TableCell className="border-r border-primary/20"><Badge variant="outline">{nvrChecklists.length}</Badge></TableCell>
                            <TableCell>{latestDate}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {statsDialog === "prints" && (
            <Card className="border-2 border-primary/40 shadow-md">
              <CardContent className="p-4 space-y-4">
                {printHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No print history yet. Use "Print Filtered" to log a print.</div>
                ) : (
                  <div className="rounded-md border-2 border-primary/40 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-primary/40">
                          <TableHead className="border-r border-primary/30">Printed At</TableHead>
                          <TableHead className="border-r border-primary/30">From Date</TableHead>
                          <TableHead className="border-r border-primary/30">To Date</TableHead>
                          <TableHead className="border-r border-primary/30">NVR Filter</TableHead>
                          <TableHead className="text-right border-r border-primary/30">Checklists</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {printHistory.map(h => (
                          <TableRow key={h.id} className="border-primary/30">
                            <TableCell className="whitespace-nowrap border-r border-primary/20">
                              {new Date(h.printedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell className="border-r border-primary/20">{h.fromDate ? formatDate(h.fromDate) : <span className="text-muted-foreground">Any</span>}</TableCell>
                            <TableCell className="border-r border-primary/20">{h.toDate ? formatDate(h.toDate) : <span className="text-muted-foreground">Any</span>}</TableCell>
                            <TableCell className="border-r border-primary/20">{h.nvrFilter === "all" ? <span className="text-muted-foreground">All</span> : `NVR-${h.nvrFilter}`}</TableCell>
                            <TableCell className="text-right border-r border-primary/20"><Badge variant="secondary">{h.count}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  askConfirm({
                                    title: "Delete this print entry?",
                                    description: `Print from ${new Date(h.printedAt).toLocaleString("en-GB")} — ${h.count} checklist${h.count > 1 ? "s" : ""}. This cannot be undone.`,
                                    confirmText: "Delete",
                                    tone: "danger",
                                    onConfirm: () => {
                                      const next = printHistory.filter(x => x.id !== h.id);
                                      setPrintHistory(next);
                                      try { localStorage.setItem("cctv_print_history", JSON.stringify(next)); } catch { }
                                    },
                                  });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {printHistory.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        askConfirm({
                          title: `Delete all ${printHistory.length} print entries?`,
                          description: "This clears the entire print history. This action cannot be undone.",
                          confirmText: "Delete All",
                          tone: "danger",
                          onConfirm: () => {
                            setPrintHistory([]);
                            try { localStorage.removeItem("cctv_print_history"); } catch { }
                          },
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Clear All
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {statsPageConfirmDialog}
        </div>
      );
    }

    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              CCTV Daily Check List
            </h1>
            <p className="text-muted-foreground mt-2">Manage NVRs and daily camera checklists</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrintFilteredChecklists} className="border-primary/30">
              <Filter className="h-4 w-4 mr-2" />
              Print Filtered ({filteredChecklistsAll.length})
            </Button>
            <Button variant="outline" onClick={handleExportCCTV} className="border-primary/30">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" disabled={isImporting} onClick={() => document.getElementById("cctv-import-file")?.click()} className="border-primary/30">
              <Upload className={`h-4 w-4 mr-2 ${isImporting ? "animate-pulse" : ""}`} />
              {isImporting ? "Importing…" : "Import"}
            </Button>
            <input id="cctv-import-file" type="file" accept=".json" onChange={handleImportCCTV} className="hidden" />
            <Dialog open={isNvrDialogOpen} onOpenChange={(o) => { setIsNvrDialogOpen(o); if (!o) { setEditingNvr(null); setNvrFormData({ nvr_number: "", name: "", total_cameras: 32 }); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => { setEditingNvr(null); setNvrFormData({ nvr_number: "", name: "", total_cameras: 32 }); }} className="border-primary/30 text-primary hover:bg-primary/10">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New NVR
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingNvr ? "Edit NVR" : "Add New NVR"}</DialogTitle>
                  <DialogDescription>Enter NVR details</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleNvrSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nvr_number">NVR Number *</Label>
                    <Input
                      id="nvr_number"
                      value={nvrFormData.nvr_number}
                      onChange={(e) => setNvrFormData({ ...nvrFormData, nvr_number: e.target.value })}
                      placeholder="e.g., 1, 2, 3..."
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">NVR Name</Label>
                    <Input
                      id="name"
                      value={nvrFormData.name}
                      onChange={(e) => setNvrFormData({ ...nvrFormData, name: e.target.value })}
                      placeholder="e.g., Main Building NVR"
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_cameras">Total Cameras</Label>
                    <Input
                      id="total_cameras"
                      type="number"
                      value={nvrFormData.total_cameras}
                      onChange={(e) => setNvrFormData({ ...nvrFormData, total_cameras: parseInt(e.target.value) || 32 })}
                      min={1}
                      max={64}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetNvrForm}>Cancel</Button>
                    <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
                      {editingNvr ? "Update" : "Create"} NVR
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search & Filter Section */}
        <Card className="bg-gradient-to-r from-muted/50 to-muted/30 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Search className="h-3 w-3" /> Search NVR
                </Label>
                <Input
                  placeholder="Search by NVR number or name..."
                  value={searchNvr}
                  onChange={(e) => setSearchNvr(e.target.value)}
                  className="w-48 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Filter by NVR
                </Label>
                <Select value={filterNvrNumber} onValueChange={setFilterNvrNumber}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="All NVRs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All NVRs</SelectItem>
                    {nvrs.map(nvr => (
                      <SelectItem key={nvr.id} value={nvr.nvr_number}>NVR-{nvr.nvr_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date From
                </Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-40 h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date To
                </Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-40 h-9"
                />
              </div>
              {(searchNvr || filterNvrNumber !== "all" || filterDateFrom || filterDateTo) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            {(filterDateFrom || filterDateTo || filterNvrNumber !== "all") && (
              <div className="mt-3 text-sm text-muted-foreground">
                Showing {filteredChecklistsAll.length} checklists matching filters
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Dialog open={statsDialog === "total-cameras"} onOpenChange={(o) => !o && setStatsDialog(null)}>
            <Card
              onClick={() => setStatsDialog("total-cameras")}
              className="order-2 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary shadow-md hover:shadow-lg perspective-1000 hover-lift cursor-pointer"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Camera className="h-10 w-10 text-primary" />
                  <div>
                    <p className="text-muted-foreground text-sm">Total Cameras</p>
                    <p className="text-3xl font-bold text-primary">{nvrStats.totalNVRCameras}</p>
                    <p className="text-xs text-primary/70">Click to view all</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  All Cameras ({nvrStats.totalNVRCameras})
                </DialogTitle>
                <DialogDescription>Complete list of all cameras across all NVRs</DialogDescription>
              </DialogHeader>
              <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NVR</TableHead>
                      <TableHead>Camera ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Recording</TableHead>
                      <TableHead>Vision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nvrs.flatMap(nvr =>
                      (nvr.cameras || []).map((cam, idx) => (
                        <TableRow key={`${nvr.id}-${idx}`}>
                          <TableCell className="font-medium">NVR-{nvr.nvr_number}</TableCell>
                          <TableCell>{cam.camera_id}</TableCell>
                          <TableCell>{cam.location_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={cam.camera_position === 'OK' ? 'default' : 'destructive'}>{cam.camera_position || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cam.camera_recordings === 'OK' ? 'default' : 'destructive'}>{cam.camera_recordings || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cam.clear_vision === 'OK' ? 'default' : 'destructive'}>{cam.clear_vision || '-'}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={statsDialog === "active"} onOpenChange={(o) => !o && setStatsDialog(null)}>
            <Card
              onClick={() => setStatsDialog("active")}
              className="order-3 bg-gradient-to-br from-green-500/10 to-green-500/5 border-2 border-green-500 shadow-md hover:shadow-lg perspective-1000 hover-lift cursor-pointer"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="text-muted-foreground text-sm">Active Cameras</p>
                    <p className="text-3xl font-bold text-green-600">{nvrStats.activeCameras}</p>
                    <p className="text-xs text-green-500">Click to view</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Active Cameras ({nvrStats.activeCameras})
                </DialogTitle>
                <DialogDescription>Cameras with all checks OK from latest checklists</DialogDescription>
              </DialogHeader>
              <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NVR</TableHead>
                      <TableHead>Camera ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nvrs.flatMap(nvr => {
                      const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
                      if (nvrChecklists.length === 0) return [];
                      const latestChecklist = nvrChecklists.sort((a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                      )[0];
                      return latestChecklist.cameras.filter(cam => {
                        const loc = (cam.location_name || '').trim();
                        const hasLocation = !!loc && loc.toUpperCase() !== 'NIL';
                        return hasLocation && cam.camera_position === 'OK' && cam.camera_recordings === 'OK' && cam.clear_vision === 'OK';
                      }).map((cam, idx) => (
                        <TableRow key={`${nvr.id}-${idx}`}>
                          <TableCell className="font-medium">NVR-{nvr.nvr_number}</TableCell>
                          <TableCell>{cam.camera_id}</TableCell>
                          <TableCell>{cam.location_name || '-'}</TableCell>
                          <TableCell><Badge className="bg-green-500">All OK</Badge></TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>

          <Card
            className="order-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-2 border-orange-500 shadow-md hover:shadow-lg perspective-1000 hover-lift cursor-pointer"
            onClick={() => setStatsDialog("issues")}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-10 w-10 text-orange-500" />
                <div>
                  <p className="text-muted-foreground text-sm">With Issues</p>
                  <p className="text-3xl font-bold text-orange-600">{nvrStats.withIssues}</p>
                  <p className="text-xs text-orange-500">Click to view details</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={statsDialog === "nvrs"} onOpenChange={(o) => !o && setStatsDialog(null)}>
            <Card
              onClick={() => setStatsDialog("nvrs")}
              className="order-1 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-2 border-blue-500 shadow-md hover:shadow-lg perspective-1000 hover-lift cursor-pointer"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Server className="h-10 w-10 text-blue-500" />
                  <div>
                    <p className="text-muted-foreground text-sm">Total NVRs</p>
                    <p className="text-3xl font-bold text-blue-600">{nvrs.length}</p>
                    <p className="text-xs text-blue-500">Click to view</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  All NVRs ({nvrs.length})
                </DialogTitle>
                <DialogDescription>Complete list of all Network Video Recorders</DialogDescription>
              </DialogHeader>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NVR Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Total Cameras</TableHead>
                      <TableHead>Checklists</TableHead>
                      <TableHead>Last Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nvrs.map(nvr => {
                      const nvrChecklists = checklists.filter(c => c.nvr_id === nvr.id);
                      const latestDate = nvrChecklists.length > 0
                        ? formatDate(nvrChecklists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
                        : '-';
                      return (
                        <TableRow key={nvr.id}>
                          <TableCell className="font-bold text-primary">NVR-{nvr.nvr_number}</TableCell>
                          <TableCell>{nvr.name || '-'}</TableCell>
                          <TableCell><Badge variant="secondary">{nvr.cameras?.length || nvr.total_cameras}</Badge></TableCell>
                          <TableCell><Badge variant="outline">{nvrChecklists.length}</Badge></TableCell>
                          <TableCell>{latestDate}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={statsDialog === "prints"} onOpenChange={(o) => !o && setStatsDialog(null)}>
            <Card
              onClick={() => setStatsDialog("prints")}
              className="order-5 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-2 border-purple-500 shadow-md hover:shadow-lg perspective-1000 hover-lift cursor-pointer"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <History className="h-10 w-10 text-purple-500" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-sm">Last Print Date</p>
                    <p className="text-lg font-bold text-purple-600 truncate">
                      {printHistory[0]
                        ? new Date(printHistory[0].printedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "No prints yet"}
                    </p>
                    <p className="text-xs text-purple-500">
                      {printHistory.length > 0 ? `${printHistory.length} print${printHistory.length > 1 ? "s" : ""} · Click to view` : "Click to view history"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-500" />
                  Print History ({printHistory.length})
                </DialogTitle>
                <DialogDescription>Filtered checklist prints with date range and count</DialogDescription>
              </DialogHeader>
              {printHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No print history yet. Use "Print Filtered" to log a print.</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Printed At</TableHead>
                        <TableHead>From Date</TableHead>
                        <TableHead>To Date</TableHead>
                        <TableHead>NVR Filter</TableHead>
                        <TableHead className="text-right">Checklists</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {printHistory.map(h => (
                        <TableRow key={h.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(h.printedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell>{h.fromDate ? formatDate(h.fromDate) : <span className="text-muted-foreground">Any</span>}</TableCell>
                          <TableCell>{h.toDate ? formatDate(h.toDate) : <span className="text-muted-foreground">Any</span>}</TableCell>
                          <TableCell>{h.nvrFilter === "all" ? <span className="text-muted-foreground">All</span> : `NVR-${h.nvrFilter}`}</TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{h.count}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                askConfirm({
                                  title: "Delete this print entry?",
                                  description: `Print from ${new Date(h.printedAt).toLocaleString("en-GB")} — ${h.count} checklist${h.count > 1 ? "s" : ""}. This cannot be undone.`,
                                  confirmText: "Delete",
                                  tone: "danger",
                                  onConfirm: () => {
                                    const next = printHistory.filter(x => x.id !== h.id);
                                    setPrintHistory(next);
                                    try { localStorage.setItem("cctv_print_history", JSON.stringify(next)); } catch { }
                                  },
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {printHistory.length > 0 && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      askConfirm({
                        title: `Delete all ${printHistory.length} print entries?`,
                        description: "This clears the entire print history. This action cannot be undone.",
                        confirmText: "Delete All",
                        tone: "danger",
                        onConfirm: () => {
                          setPrintHistory([]);
                          try { localStorage.removeItem("cctv_print_history"); } catch { }
                        },
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Clear All
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Issues View Dialog */}
        <Dialog open={isIssuesViewOpen} onOpenChange={setIsIssuesViewOpen}>
          <DialogContent className="max-w-[100vw] w-screen h-screen sm:rounded-none p-6 overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Camera Issues ({nvrStats.withIssues})
              </DialogTitle>
              <DialogDescription>Cameras with issues from recent checklists</DialogDescription>
            </DialogHeader>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NVR</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nvrStats.issues.map((issue, idx) => {
                    // Find the camera remarks from checklist
                    const nvr = nvrs.find(n => n.id === issue.nvr_id);
                    const nvrChecklists = checklists.filter(c => c.nvr_id === issue.nvr_id && c.date === issue.date);
                    const checklist = nvrChecklists[0];
                    const camera = checklist?.cameras.find(c => c.camera_id === issue.camera_id);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">NVR-{issue.nvr_number}</TableCell>
                        <TableCell>{issue.camera_id}</TableCell>
                        <TableCell>{issue.location}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">{issue.issue_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={camera?.remarks || '-'}>
                          {camera?.remarks || '-'}
                        </TableCell>
                        <TableCell>{formatDate(issue.date)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              askConfirm({
                                title: `Remove issue for camera ${issue.camera_id}?`,
                                description: "This only removes it from the Camera Issues card. The daily checklist stays unchanged.",
                                confirmText: "Remove",
                                tone: "warning",
                                onConfirm: () => persistDismissed([...dismissedIssues, issueKey(issue)]),
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {nvrStats.issues.length > 0 && (
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => {
                    askConfirm({
                      title: `Delete all ${nvrStats.issues.length} issues?`,
                      description: "This clears every issue from this card. The daily checklists are NOT affected.",
                      confirmText: "Delete All",
                      tone: "danger",
                      onConfirm: () => {
                        const keys = nvrStats.issues.map(issueKey);
                        persistDismissed(Array.from(new Set([...dismissedIssues, ...keys])));
                      },
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete All Issues
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* NVR Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(() => {
            // Uniform Daily Reports total across all NVRs = max checklist count
            const uniformDailyReports = nvrs.reduce(
              (max, n) => Math.max(max, checklists.filter(c => c.nvr_id === n.id).length),
              0
            );
            return filteredNvrs.map((nvr) => {
              const nvrChecklists = getNvrChecklists(nvr.id);
              return (
                <Card
                  key={nvr.id}
                  className="cursor-pointer animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-primary shadow-md hover:shadow-lg hover:border-primary transition-all"
                  onClick={() => setSelectedNvr(nvr)}
                >
                  <CardHeader>
                    <CardTitle className="text-primary flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      NVR-{nvr.nvr_number}
                    </CardTitle>
                    <CardDescription>
                      {nvr.name || `Network Video Recorder ${nvr.nvr_number}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Cameras:</span>
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white">{nvr.cameras?.length || nvr.total_cameras}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Cameras:</span>
                      <Badge className="bg-green-600 hover:bg-green-600 text-white">
                        {(nvr.cameras || []).filter(c => c.location_name && c.location_name.trim() !== "").length}
                        {" / "}
                        {nvr.cameras?.length || nvr.total_cameras}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Daily Reports:</span>
                      <Badge variant="outline">{uniformDailyReports}</Badge>
                    </div>
                    <div className="flex justify-end mt-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNvr(nvr);
                              setNvrFormData({
                                nvr_number: nvr.nvr_number,
                                name: nvr.name,
                                total_cameras: nvr.total_cameras,
                              });
                              setIsNvrDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNvr(nvr.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>

        {nvrs.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Server className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No NVRs Found</h3>
              <p className="text-muted-foreground mb-4">Create your first NVR to start managing CCTV checklists</p>
            </CardContent>
          </Card>
        )}

        {statsPageConfirmDialog}
      </div>
    );
  }

  // NVR Detail View
  const allNvrChecklists = getNvrChecklists(selectedNvr.id);
  const nvrChecklists = (checklistDateFilter || checklistDateTo)
    ? allNvrChecklists.filter((c) => {
      if (checklistDateFilter && c.date < checklistDateFilter) return false;
      if (checklistDateTo && c.date > checklistDateTo) return false;
      return true;
    })
    : allNvrChecklists;
  const totalChecklistPages = Math.max(1, Math.ceil(nvrChecklists.length / CHECKLISTS_PER_PAGE));
  const currentChecklistPage = Math.min(checklistsPage, totalChecklistPages);
  const paginatedChecklists = nvrChecklists.slice(
    (currentChecklistPage - 1) * CHECKLISTS_PER_PAGE,
    currentChecklistPage * CHECKLISTS_PER_PAGE
  );

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedNvr(null)}
            className="border-2 border-primary text-primary hover:bg-primary/10 shadow-sm"
            aria-label="Back"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              NVR-{selectedNvr.nvr_number}
            </h1>
            <p className="text-muted-foreground">{selectedNvr.name || "Camera Management & Daily Checklists"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowSettings(!showSettings)} className="border-primary/30">
            <Settings2 className="h-4 w-4 mr-2" />
            Excel Settings
          </Button>
          <Button variant="outline" onClick={handleCreateChecklist} className="border-primary/30 text-primary">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            New Daily Checklist
          </Button>
        </div>
      </div>

      {/* Excel-like Settings Panel */}
      {showSettings && (
        <Card className="no-print bg-gradient-to-r from-muted/50 to-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel-Like Table Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Type className="h-3 w-3" /> Font Size
                </Label>
                <Select value={fontSize.toString()} onValueChange={(v) => setFontSize(Number(v))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[8, 9, 10, 11, 12, 14, 16, 18].map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}px</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Columns className="h-3 w-3" /> Row Height
                </Label>
                <Select value={rowHeight.toString()} onValueChange={(v) => setRowHeight(Number(v))}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[24, 28, 32, 36, 40, 48].map(h => (
                      <SelectItem key={h} value={h.toString()}>{h}px</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <WrapText className="h-3 w-3" /> Word Wrap
                </Label>
                <Select value={wordWrap ? "on" : "off"} onValueChange={(v) => setWordWrap(v === "on")}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">On</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex items-end justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <Merge className="h-3 w-3 inline mr-1" />
                  Drag column borders to resize. Settings apply to checklist view.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    saveExcelSettings();
                    toast({ title: "Saved", description: "Excel settings saved successfully." });
                  }}
                  className="shrink-0"
                >
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Checklists */}
      <Card className="no-print">
        <CardHeader className="p-3 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Daily Checklists
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">View all daily camera check reports</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground">From</span>
                <div className="relative">
                  <Input
                    type="date"
                    value={checklistDateFilter}
                    onChange={(e) => {
                      setChecklistDateFilter(e.target.value);
                      setChecklistsPage(1);
                    }}
                    className="w-[140px] sm:w-[170px] pr-8 h-8 text-xs sm:text-sm"
                  />
                  {checklistDateFilter && (
                    <button
                      type="button"
                      onClick={() => { setChecklistDateFilter(""); setChecklistsPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear from date"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground ml-1">To</span>
                <div className="relative">
                  <Input
                    type="date"
                    value={checklistDateTo}
                    onChange={(e) => {
                      setChecklistDateTo(e.target.value);
                      setChecklistsPage(1);
                    }}
                    className="w-[140px] sm:w-[170px] pr-8 h-8 text-xs sm:text-sm"
                  />
                  {checklistDateTo && (
                    <button
                      type="button"
                      onClick={() => { setChecklistDateTo(""); setChecklistsPage(1); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear to date"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (nvrChecklists.length === 0) {
                    toast({ title: "No Checklists", description: "No checklists match the current filter.", variant: "destructive" });
                    return;
                  }
                  const rangeDesc = checklistDateFilter && checklistDateTo
                    ? `from ${formatDate(checklistDateFilter)} to ${formatDate(checklistDateTo)}`
                    : checklistDateFilter
                      ? `on or after ${formatDate(checklistDateFilter)}`
                      : checklistDateTo
                        ? `on or before ${formatDate(checklistDateTo)}`
                        : "";
                  askConfirm({
                    title: `Delete ${nvrChecklists.length} checklist${nvrChecklists.length > 1 ? "s" : ""}?`,
                    description: rangeDesc
                      ? `This will permanently remove all checklists ${rangeDesc}. This action cannot be undone.`
                      : "This will permanently remove every checklist shown. This action cannot be undone.",
                    confirmText: "Delete",
                    tone: "danger",
                    onConfirm: async () => {
                      const count = nvrChecklists.length;
                      await Promise.all(nvrChecklists.map((c) => dbService.deleteCCTVChecklist(c.id)));
                      await loadData();
                      toast({ title: "All Deleted", description: `Successfully deleted all ${count} checklist(s) at once.` });
                    },
                  });
                }}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 h-8 px-2 text-xs sm:text-sm"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete Filtered</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {nvrChecklists.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:divide-x-4 lg:divide-primary">
                {[paginatedChecklists.slice(0, 10), paginatedChecklists.slice(10, 20), paginatedChecklists.slice(20, 30)].map((half, hIdx) => (
                  half.length > 0 && (
                    <div key={hIdx} className={hIdx > 0 ? "lg:pl-4" : ""}>
                      <Table className="border-collapse border-2 border-primary w-full table-auto text-xs sm:text-sm">
                        <TableHeader>
                          <TableRow className="border-2 border-primary bg-primary/10">
                            <TableHead className="border-2 border-primary whitespace-nowrap text-foreground text-xs sm:text-sm px-2">Date</TableHead>
                            <TableHead className="w-[50px] whitespace-nowrap p-1 text-center border-2 border-primary text-foreground text-xs sm:text-sm">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {half.map((checklist) => (
                            <TableRow key={checklist.id} className="border border-primary/70">
                              <TableCell
                                className="font-medium border border-primary/70 whitespace-nowrap cursor-pointer text-primary hover:underline text-xs sm:text-sm px-2 py-1.5"
                                onClick={() => handleViewChecklist(checklist)}
                              >
                                {formatDate(checklist.date)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap w-[50px] p-1 text-center border border-primary/70">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="outline" className="h-7 w-7">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleViewChecklist(checklist)}>
                                      <Eye className="h-4 w-4 mr-2" /> View
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteChecklist(checklist.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                ))}
              </div>
              {totalChecklistPages > 1 && (
                <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentChecklistPage - 1) * CHECKLISTS_PER_PAGE + 1}
                    {"–"}
                    {Math.min(currentChecklistPage * CHECKLISTS_PER_PAGE, nvrChecklists.length)} of {nvrChecklists.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChecklistsPage((p) => Math.max(1, p - 1))}
                      disabled={currentChecklistPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentChecklistPage} of {totalChecklistPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setChecklistsPage((p) => Math.min(totalChecklistPages, p + 1))}
                      disabled={currentChecklistPage === totalChecklistPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No checklists yet. Create your first daily checklist.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camera Setup Table */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Setup ({selectedNvr.cameras?.length || 0} Cameras)
          </CardTitle>
          <CardDescription>Configure camera locations for this NVR</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="border-collapse border-2 border-primary">
              <TableHeader>
                <TableRow className="border-2 border-primary bg-primary/10">
                  <TableHead className="w-12 border-2 border-primary text-foreground">SL</TableHead>
                  <TableHead className="w-20 border-2 border-primary text-foreground">Camera ID</TableHead>
                  <TableHead className="border-2 border-primary text-foreground">Location Name</TableHead>
                  <TableHead className="w-24 border-2 border-primary text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedNvr.cameras || []).map((camera, index) => (
                  <TableRow key={index} className="border border-primary/70">
                    <TableCell className="border border-primary/70">{index + 1}</TableCell>
                    <TableCell className="font-medium text-primary border border-primary/70">{camera.camera_id}</TableCell>
                    <TableCell className="border border-primary/70">{camera.location_name || "-"}</TableCell>
                    <TableCell className="border border-primary/70">
                      <Button size="sm" variant="outline" onClick={() => handleEditCamera(camera, index)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Camera Dialog */}
      <Dialog open={isCameraDialogOpen} onOpenChange={setIsCameraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Camera Location</DialogTitle>
            <DialogDescription>Update camera location details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCameraSubmit} className="space-y-4">
            <div>
              <Label htmlFor="camera_id">Camera ID</Label>
              <Input
                id="camera_id"
                value={cameraFormData.camera_id}
                onChange={(e) => setCameraFormData({ ...cameraFormData, camera_id: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location_name">Location Name</Label>
              <Input
                id="location_name"
                value={cameraFormData.location_name}
                onChange={(e) => setCameraFormData({ ...cameraFormData, location_name: e.target.value })}
                placeholder="e.g., Gate-01-Pocket Gate"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCameraForm}>Cancel</Button>
              <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create/View Checklist Dialog - Excel Style */}
      <Dialog open={isChecklistDialogOpen || isViewChecklistOpen} onOpenChange={(open) => {
        if (!open) {
          setIsChecklistDialogOpen(false);
          setIsViewChecklistOpen(false);
          setSelectedChecklist(null);
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {isViewChecklistOpen ? "View/Edit Checklist" : "New Daily Checklist"} - NVR-{selectedNvr.nvr_number}
            </DialogTitle>
            <DialogDescription>
              Date: {formatDate(checklistFormData.date)} | Drag column headers to resize
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {!isViewChecklistOpen && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="checklist_date">Date</Label>
                  <Input
                    id="checklist_date"
                    type="date"
                    value={checklistFormData.date}
                    onChange={(e) => setChecklistFormData({
                      ...checklistFormData,
                      date: normalizeDateString(e.target.value),
                    })}
                  />
                </div>
              </div>
            )}

            {/* Merge Toolbar (Remarks column) */}
            <div className="flex flex-wrap items-center gap-2 mb-2 p-2 rounded-md bg-muted/40 border">
              <span className="text-xs font-semibold mr-2">Remarks Merge:</span>
              <Button
                type="button"
                size="sm"
                variant={isMergeMode ? "default" : "outline"}
                onClick={() => {
                  setIsMergeMode(!isMergeMode);
                  setSelectedCellsForMerge([]);
                }}
              >
                {isMergeMode ? "Exit Merge Mode" : "Enable Merge Mode"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!isMergeMode || selectedCellsForMerge.length < 2}
                onClick={handleMergeCells}
              >
                Merge Selected ({selectedCellsForMerge.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mergedCells.length === 0}
                onClick={handleUnmergeAll}
              >
                Unmerge All
              </Button>
              {isMergeMode && (
                <span className="text-xs text-muted-foreground ml-2">
                  Click Remarks cells (consecutive rows) to select, then Merge Selected. Saved with this checklist.
                </span>
              )}
            </div>

            {/* Excel-like Table */}
            <div
              className="border-2 border-primary/70 rounded-lg overflow-auto bg-background"
              style={{ maxHeight: "60vh", userSelect: dragMerge ? "none" : "auto" }}
            >
              <table
                className="w-full border-collapse border-2 border-primary/70"
                style={{ fontSize: `${fontSize}px` }}
              >
                <thead className="sticky top-0 z-10">
                  <tr className="bg-primary/10">
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.sl, minWidth: columnWidths.sl }}
                    >
                      SL
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "sl")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.cameraId, minWidth: columnWidths.cameraId }}
                    >
                      Camera ID
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "cameraId")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-left font-bold relative select-none"
                      style={{ width: columnWidths.locationName, minWidth: columnWidths.locationName }}
                    >
                      Location Name
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "locationName")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.cameraPosition, minWidth: columnWidths.cameraPosition }}
                    >
                      Camera Position
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "cameraPosition")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.cameraRecordings, minWidth: columnWidths.cameraRecordings }}
                    >
                      Camera Recordings
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "cameraRecordings")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.clearVision, minWidth: columnWidths.clearVision }}
                    >
                      Clear Vision
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "clearVision")}
                      />
                    </th>
                    <th
                      className="border-2 border-primary p-2 text-center font-bold relative select-none"
                      style={{ width: columnWidths.remarks, minWidth: columnWidths.remarks }}
                    >
                      Remarks
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
                        onMouseDown={(e) => handleMouseDown(e, "remarks")}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {checklistCameras.map((camera, index) => (
                    <tr
                      key={index}
                      className="hover:bg-muted/50"
                      style={{ height: rowHeight }}
                    >
                      <td
                        className="border border-primary/70 p-1 text-center font-medium"
                        style={{
                          whiteSpace: wordWrap ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {index + 1}
                      </td>
                      <td
                        className="border border-primary/70 p-1 text-center font-bold text-primary"
                        style={{
                          whiteSpace: wordWrap ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {camera.camera_id}
                      </td>
                      <td
                        className="border border-primary/70 p-1 text-primary"
                        style={{
                          whiteSpace: wordWrap ? "normal" : "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {camera.location_name && camera.location_name.trim() ? camera.location_name : "NIL"}
                      </td>
                      <td className="border border-primary/70 p-1">
                        <Select
                          value={(!camera.location_name || !camera.location_name.trim()) ? "NIL" : camera.camera_position}
                          onValueChange={(value) => updateChecklistCamera(index, "camera_position", value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OK">OK</SelectItem>
                            <SelectItem value="NOT OK">NOT OK</SelectItem>
                            <SelectItem value="NIL">NIL</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {shouldRenderCell(index, "cameraRecordings") && (
                        <td
                          className={`border border-primary/70 p-1 align-middle ${isMergeMode ? "cursor-pointer" : ""
                            } ${isCellSelectedForMerge(index, "cameraRecordings")
                              ? "bg-primary/20 ring-2 ring-primary ring-inset"
                              : ""
                            } ${getMergeRowSpan(index, "cameraRecordings") > 1
                              ? "bg-accent/30"
                              : ""
                            }`}
                          rowSpan={getMergeRowSpan(index, "cameraRecordings")}
                          onClick={() => handleCellClickForMerge(index, "cameraRecordings")}
                          onMouseDown={(e) => handleMergeDragStart(e, index, "cameraRecordings")}
                          onMouseMove={(e) => handleMergeDragOver(e, index, "cameraRecordings")}
                        >
                          <Select
                            value={(!camera.location_name || !camera.location_name.trim()) ? "NIL" : camera.camera_recordings}
                            onValueChange={(value) => updateChecklistCamera(index, "camera_recordings", value)}
                          >
                            <SelectTrigger
                              className="h-7 text-xs"
                              style={{ pointerEvents: isMergeMode ? "none" : "auto" }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OK">OK</SelectItem>
                              <SelectItem value="NOT OK">NOT OK</SelectItem>
                              <SelectItem value="NIL">NIL</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      <td className="border border-primary/70 p-1">
                        <Select
                          value={(!camera.location_name || !camera.location_name.trim()) ? "NIL" : camera.clear_vision}
                          onValueChange={(value) => updateChecklistCamera(index, "clear_vision", value)}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OK">OK</SelectItem>
                            <SelectItem value="NOT OK">NOT OK</SelectItem>
                            <SelectItem value="NIL">NIL</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {shouldRenderCell(index, "remarks") && (
                        <td
                          className={`border border-primary/70 p-1 align-middle ${isMergeMode ? "cursor-pointer" : ""
                            } ${isCellSelectedForMerge(index, "remarks")
                              ? "bg-primary/20 ring-2 ring-primary ring-inset"
                              : ""
                            }`}
                          rowSpan={getMergeRowSpan(index, "remarks")}
                          onClick={() => handleCellClickForMerge(index, "remarks")}
                          onMouseDown={(e) => handleMergeDragStart(e, index, "remarks")}
                          onMouseMove={(e) => handleMergeDragOver(e, index, "remarks")}
                        >
                          <Input
                            value={camera.remarks}
                            onChange={(e) => updateChecklistCamera(index, "remarks", e.target.value)}
                            placeholder="Remarks..."
                            className="h-7 text-xs"
                            style={{
                              whiteSpace: wordWrap ? "normal" : "nowrap",
                              pointerEvents: isMergeMode ? "none" : "auto",
                            }}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 mt-4 border-t">
              <div>

                <Input
                  id="checked_by"
                  value={checklistFormData.checked_by}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, checked_by: e.target.value })}
                />
              </div>
              <div>

                <Input
                  id="verified_by"
                  value={checklistFormData.verified_by}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, verified_by: e.target.value })}
                />
              </div>
              <div>

                <Input
                  id="approved_by"
                  value={checklistFormData.approved_by}
                  onChange={(e) => setChecklistFormData({ ...checklistFormData, approved_by: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsChecklistDialogOpen(false);
                setIsViewChecklistOpen(false);
                setSelectedChecklist(null);
              }}
            >
              Cancel
            </Button>
            {isViewChecklistOpen && selectedChecklist ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handlePrintChecklist(selectedChecklist, selectedNvr)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={handleUpdateChecklist} className="bg-gradient-to-r from-primary to-primary/80">
                  Update Checklist
                </Button>
              </>
            ) : (
              <Button onClick={handleSaveChecklist} className="bg-gradient-to-r from-primary to-primary/80">
                Save Checklist
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Checklist Confirmation */}
      <AlertDialog
        open={pendingDeleteChecklistId !== null}
        onOpenChange={(open) => !open && setPendingDeleteChecklistId(null)}
      >
        <AlertDialogContent className="border-2 border-destructive/60 shadow-lg shadow-destructive/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Daily Checklist?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              This will permanently remove the selected daily checklist. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteChecklist}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shared styled confirm dialog */}
      <AlertDialog open={!!confirmState} onOpenChange={(o) => !o && setConfirmState(null)}>
        <AlertDialogContent
          className={
            confirmState?.tone === "warning"
              ? "z-[200] border-2 border-orange-500/60 shadow-lg shadow-orange-500/20"
              : "z-[200] border-2 border-destructive/60 shadow-lg shadow-destructive/20"
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className={`flex items-center gap-2 ${confirmState?.tone === "warning" ? "text-orange-600" : "text-destructive"}`}
            >
              <AlertTriangle className="h-5 w-5" />
              {confirmState?.title}
            </AlertDialogTitle>
            <AlertDialogDescription
              className={`mt-2 rounded-md border p-3 text-sm ${confirmState?.tone === "warning"
                ? "border-orange-500/30 bg-orange-500/5"
                : "border-destructive/30 bg-destructive/5"
                }`}
            >
              {confirmState?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmState?.onConfirm();
                setConfirmState(null);
              }}
              className={
                confirmState?.tone === "warning"
                  ? "bg-orange-500 text-white hover:bg-orange-500/90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {confirmState?.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CCTVCheckList;
