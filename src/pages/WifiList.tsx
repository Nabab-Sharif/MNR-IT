import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wifi, Plus, Edit, Trash2, Download, ArrowLeft, Printer, Building2, Users, Search, Upload, Share2, MoreVertical } from "lucide-react";
import dbService from "@/services/dbService";
import QRCode from "qrcode";
import WifiPrintCard from "@/components/WifiPrintCard";
import SearchFilter from "@/components/SearchFilter";
import DataImportExport from "@/components/DataImportExport";
import PermGate from "@/components/PermGate";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface WifiNetwork {
  id: number;
  wifi_name: string;
  wifi_password: string;
  wifi_qr_code: string;
  office_name: string;
  department_name: string;
  ip_address: string;
  added_date: string;
}

const WifiList = () => {
  const { toast } = useToast();
  const [wifiNetworks, setWifiNetworks] = useState<WifiNetwork[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWifi, setEditingWifi] = useState<WifiNetwork | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [printWifi, setPrintWifi] = useState<WifiNetwork | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [shareTarget, setShareTarget] = useState<WifiNetwork | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editUnit, setEditUnit] = useState<any | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [deleteUnit, setDeleteUnit] = useState<any | null>(null);
  const [editDept, setEditDept] = useState<any | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [deleteDept, setDeleteDept] = useState<any | null>(null);
  const [printTheme, setPrintTheme] = useState<string>(() => localStorage.getItem('wifi_print_theme') || 'blue');
  const printThemes: Record<string, { primary: string; glow: string; soft: string }> = {
    blue:   { primary: '#0066cc', glow: '#3b82f6', soft: 'rgba(0,102,204,0.10)' },
    green:  { primary: '#059669', glow: '#10b981', soft: 'rgba(5,150,105,0.10)' },
    purple: { primary: '#7c3aed', glow: '#a78bfa', soft: 'rgba(124,58,237,0.10)' },
    orange: { primary: '#ea580c', glow: '#fb923c', soft: 'rgba(234,88,12,0.10)' },
    red:    { primary: '#dc2626', glow: '#f87171', soft: 'rgba(220,38,38,0.10)' },
    teal:   { primary: '#0d9488', glow: '#2dd4bf', soft: 'rgba(13,148,136,0.10)' },
  };
  const printRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    wifi_name: "",
    wifi_password: "",
    office_name: "",
    department_name: "",
    ip_address: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useCloudRealtime(["wifi_networks"], () => { loadData(); });

  const loadData = async () => {
    const wifiData = await dbService.getWifiNetworks();
    const rows = wifiData || [];
    setWifiNetworks(rows);
    // Auto-heal networks saved without a QR code
    const missing = rows.filter((w: any) => w.wifi_name && !w.wifi_qr_code);
    if (missing.length) {
      try {
        for (const w of missing) {
          const qr = await generateQRCode(w.wifi_name, w.wifi_password || "");
          if (qr) await dbService.updateWifiNetwork(w.id, { wifi_qr_code: qr });
        }
        const refreshed = await dbService.getWifiNetworks();
        setWifiNetworks(refreshed || rows);
      } catch (e) { /* ignore */ }
    }
    try {
      const u = await dbService.getUnits('wifi');
      const d = await dbService.getDepartments('wifi');
      const byCreated = (a: any, b: any) => {
        const av = new Date(a?.created_at || 0).getTime() || a?.id || 0;
        const bv = new Date(b?.created_at || 0).getTime() || b?.id || 0;
        return av - bv;
      };
      setUnitsList((u || []).slice().sort(byCreated));
      setDepartmentsList((d || []).slice().sort(byCreated));
    } catch (e) { /* ignore */ }
  };

  const handleAddUnit = async () => {
    const name = newUnitName.trim();
    if (!name) return;
    if (unitsList.some((u: any) => (u.name || "").toLowerCase() === name.toLowerCase())) {
      toast({ title: "Duplicate", description: "Unit/Office already exists.", variant: "destructive" });
      return;
    }
    await dbService.addUnit({ name, scope: 'wifi' });
    setNewUnitName("");
    setUnitDialogOpen(false);
    await loadData();
    toast({ title: "Unit/Office added", description: name });
  };

  const handleAddDepartment = async () => {
    const name = newDeptName.trim();
    if (!name || !selectedOffice) return;
    if (departmentsList.some((d: any) => (d.name || "").toLowerCase() === name.toLowerCase() && (d.unit || "").toLowerCase() === selectedOffice.toLowerCase())) {
      toast({ title: "Duplicate", description: "Department already exists in this unit.", variant: "destructive" });
      return;
    }
    await dbService.addDepartment({ name, unit: selectedOffice, scope: 'wifi' });
    setNewDeptName("");
    setDeptDialogOpen(false);
    await loadData();
    toast({ title: "Department added", description: name });
  };

  const findUnitByName = (name: string) => unitsList.find((u: any) => (u.name || "").toLowerCase() === (name || "").toLowerCase());
  const findDeptByName = (name: string, unit: string) => departmentsList.find((d: any) => (d.name || "").toLowerCase() === (name || "").toLowerCase() && (d.unit || "").toLowerCase() === (unit || "").toLowerCase());

  const openEditUnit = (officeName: string) => {
    const u = findUnitByName(officeName) || { id: null, name: officeName };
    setEditUnit(u);
    setEditUnitName(u.name || officeName);
  };

  const handleUpdateUnit = async () => {
    if (!editUnit) return;
    const newName = editUnitName.trim();
    if (!newName) return;
    const oldName = editUnit.name;
    if (newName.toLowerCase() !== oldName.toLowerCase() && unitsList.some((u: any) => (u.name || "").toLowerCase() === newName.toLowerCase())) {
      toast({ title: "Duplicate", description: "Unit/Office already exists.", variant: "destructive" });
      return;
    }
    if (editUnit.id != null) {
      await dbService.updateUnit(editUnit.id, { name: newName });
    }
    // Cascade rename to wifi networks
    if (newName !== oldName) {
      const affected = wifiNetworks.filter(w => w.office_name === oldName);
      for (const w of affected) {
        await dbService.updateWifiNetwork(w.id, { ...w, office_name: newName });
      }
    }
    setEditUnit(null);
    await loadData();
    toast({ title: "Unit/Office updated", description: newName });
  };

  const confirmDeleteUnit = async () => {
    if (!deleteUnit) return;
    const name = deleteUnit.name;
    const { sendToRecycleBin } = await import("@/lib/recycleBin");
    if (deleteUnit.id != null) {
      await sendToRecycleBin({ entity: "WiFi Unit/Office", entity_id: String(deleteUnit.id), entity_label: name, collection: "Unit", payload: deleteUnit });
      await dbService.deleteUnit(deleteUnit.id);
    }
    // Delete wifi networks under this unit
    const affected = wifiNetworks.filter(w => w.office_name === name);
    for (const w of affected) {
      await sendToRecycleBin({ entity: "WiFi Network", entity_id: String(w.id), entity_label: w.wifi_name, collection: "WifiNetwork", payload: w });
      await dbService.deleteWifiNetwork(w.id);
    }
    setDeleteUnit(null);
    await loadData();
    toast({ title: "Unit/Office deleted", description: name });
  };

  const openEditDept = (deptName: string) => {
    const d = findDeptByName(deptName, selectedOffice || "") || { id: null, name: deptName, unit: selectedOffice };
    setEditDept(d);
    setEditDeptName(d.name || deptName);
  };

  const handleUpdateDept = async () => {
    if (!editDept) return;
    const newName = editDeptName.trim();
    if (!newName) return;
    const oldName = editDept.name;
    const unit = editDept.unit || selectedOffice || "";
    if (newName.toLowerCase() !== oldName.toLowerCase() && departmentsList.some((d: any) => (d.name || "").toLowerCase() === newName.toLowerCase() && (d.unit || "").toLowerCase() === unit.toLowerCase())) {
      toast({ title: "Duplicate", description: "Department already exists in this unit.", variant: "destructive" });
      return;
    }
    if (editDept.id != null) {
      await dbService.updateDepartment(editDept.id, { name: newName, unit });
    }
    if (newName !== oldName) {
      const affected = wifiNetworks.filter(w => w.office_name === unit && w.department_name === oldName);
      for (const w of affected) {
        await dbService.updateWifiNetwork(w.id, { ...w, department_name: newName });
      }
    }
    setEditDept(null);
    await loadData();
    toast({ title: "Department updated", description: newName });
  };

  const confirmDeleteDept = async () => {
    if (!deleteDept) return;
    const name = deleteDept.name;
    const unit = deleteDept.unit || selectedOffice || "";
    const { sendToRecycleBin } = await import("@/lib/recycleBin");
    if (deleteDept.id != null) {
      await sendToRecycleBin({ entity: "WiFi Department", entity_id: String(deleteDept.id), entity_label: name, collection: "Department", payload: deleteDept });
      await dbService.deleteDepartment(deleteDept.id);
    }
    const affected = wifiNetworks.filter(w => w.office_name === unit && w.department_name === name);
    for (const w of affected) {
      await sendToRecycleBin({ entity: "WiFi Network", entity_id: String(w.id), entity_label: w.wifi_name, collection: "WifiNetwork", payload: w });
      await dbService.deleteWifiNetwork(w.id);
    }
    setDeleteDept(null);
    await loadData();
    toast({ title: "Department deleted", description: name });
  };

  const generateQRCode = async (ssid: string, password: string) => {
    try {
      // Escape reserved characters per WIFI: URI spec (\ ; , : ")
      const esc = (v: string) => String(v ?? "").replace(/([\\;,:"])/g, "\\$1");
      const name = esc(ssid).trim();
      const pass = esc(password);
      const wifiString = password
        ? `WIFI:T:WPA;S:${name};P:${pass};H:false;;`
        : `WIFI:T:nopass;S:${name};;`;
      const qrCode = await QRCode.toDataURL(wifiString, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      return qrCode;
    } catch (error) {
      console.error("Error generating QR code:", error);
      return "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const qrCode = await generateQRCode(formData.wifi_name, formData.wifi_password);
      const dataWithQR = { ...formData, wifi_qr_code: qrCode };
      
      if (editingWifi) {
        await dbService.updateWifiNetwork(editingWifi.id, dataWithQR);
        toast({
          title: "✓ Password Saved",
          description: `WiFi "${formData.wifi_name}" updated successfully.`,
          className:
            "border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/10",
        });
      } else {
        await dbService.addWifiNetwork(dataWithQR);
        toast({
          title: "✓ Password Saved",
          description: `New WiFi "${formData.wifi_name}" added successfully.`,
          className:
            "border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/10",
        });
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error("Error saving WiFi:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save WiFi password.",
        variant: "destructive",
        className:
          "border-2 border-destructive/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)] bg-gradient-to-br from-background via-background to-destructive/10",
      });
    }
  };

  const handleEdit = (wifi: WifiNetwork) => {
    setEditingWifi(wifi);
    setFormData({
      wifi_name: wifi.wifi_name,
      wifi_password: wifi.wifi_password,
      office_name: wifi.office_name,
      department_name: wifi.department_name,
      ip_address: wifi.ip_address,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    const w = wifiNetworks.find(x => x.id === deleteId);
    if (w) {
      const { sendToRecycleBin } = await import("@/lib/recycleBin");
      await sendToRecycleBin({ entity: "WiFi Network", entity_id: String(w.id), entity_label: w.wifi_name, collection: "WifiNetwork", payload: w });
    }
    await dbService.deleteWifiNetwork(deleteId);
    await loadData();
    setDeleteId(null);
    toast({ title: "WiFi network deleted", description: "WiFi network has been deleted successfully." });
  };

  const resetForm = () => {
    setFormData({
      wifi_name: "",
      wifi_password: "",
      office_name: selectedOffice || "",
      department_name: selectedDepartment || "",
      ip_address: "",
    });
    setEditingWifi(null);
    setIsDialogOpen(false);
  };

  const downloadQRCode = (qrCode: string, wifiName: string) => {
    const link = document.createElement('a');
    link.download = `wifi_qr_${wifiName}.png`;
    link.href = qrCode;
    link.click();
    toast({ title: "QR Code downloaded", description: "WiFi QR code has been downloaded successfully." });
  };

  const printWifiCard = (wifi: WifiNetwork) => {
    setPrintWifi(wifi);
    setTimeout(() => {
      const printContent = document.getElementById('wifi-print-content');
      if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const theme = printThemes[printTheme] || printThemes.blue;
          const tp = theme.primary;
          const tg = theme.glow;
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title></title>
              <style>
                @page { size: A4; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                body { 
                  font-family: 'Segoe UI', system-ui, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  background: #ffffff;
                }
                .wifi-card {
                  width: 400px;
                  padding: 40px;
                  background: #ffffff;
                  border: 4px solid ${tp};
                  border-radius: 20px;
                  text-align: center;
                  box-shadow: 0 20px 60px ${theme.soft};
                }
                .logo { width: 120px; margin: 0 auto 20px; }
                .title { font-size: 20px; color: ${tp}; margin-bottom: 10px; }
                .wifi-name { font-size: 32px; font-weight: bold; color: #1e293b; margin: 15px 0; }
                .qr-code { 
                  width: 200px; height: 200px; 
                  margin: 25px auto; 
                  border: 4px solid ${tp};
                  border-radius: 16px;
                  padding: 10px;
                  background: white;
                }
                .qr-code img { width: 100%; height: 100%; }
                .scan-text { font-size: 14px; color: #64748b; margin: 10px 0; }
                .password-box {
                  background: linear-gradient(135deg, ${tp} 0%, ${tg} 100%);
                  color: white;
                  padding: 20px;
                  border-radius: 12px;
                  margin: 20px 0;
                }
                .password-label { font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; }
                .password { font-size: 24px; font-weight: bold; letter-spacing: 3px; margin-top: 8px; }
                .footer { margin-top: 25px; padding-top: 20px; border-top: 2px solid #e2e8f0; }
                .footer p { font-size: 12px; color: #64748b; }
                @media print {
                  html, body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                  .wifi-card { box-shadow: none; border: 3px solid ${tp}; background: #ffffff !important; }
                  .title { color: ${tp} !important; }
                  .wifi-name { color: #1e293b !important; }
                  .password-box { background: ${tp} !important; color: #ffffff !important; }
                  .password-box .password-label, .password-box .password { color: #ffffff !important; }
                  .scan-text, .footer p { color: #475569 !important; }
                }
              </style>
            </head>
            <body>
              <div class="wifi-card">
                <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="Logo" class="logo">
                <div class="title">WiFi Network</div>
                <div class="wifi-name">${wifi.wifi_name}</div>
                <div class="qr-code"><img src="${wifi.wifi_qr_code}" alt="QR Code"></div>
                <div class="scan-text">Scan QR Code to connect</div>
                <div class="password-box">
                  <div class="password-label">Password</div>
                  <div class="password">${wifi.wifi_password}</div>
                </div>
                <div class="footer">
                  <p>MNR Group - IT Department</p>
                  <p>Contact IT for assistance</p>
                </div>
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
      setPrintWifi(null);
    }, 100);
  };

  const printWifiList = (wifis: WifiNetwork[], titleSuffix = "") => {
    if (!wifis.length) {
      toast({ title: "Nothing to print", description: "No WiFi networks match current filter." });
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    // Use selected print theme
    localStorage.setItem('wifi_print_theme', printTheme);
    const theme = printThemes[printTheme] || printThemes.blue;
    const primary = theme.primary;
    const primarySoft = theme.soft;
    const primaryGlow = theme.glow;
    // Group by Office → Department
    const groups: Record<string, Record<string, WifiNetwork[]>> = {};
    wifis.forEach((w) => {
      const off = w.office_name || 'Unassigned Office';
      const dep = w.department_name || 'Unassigned Department';
      groups[off] = groups[off] || {};
      groups[off][dep] = groups[off][dep] || [];
      groups[off][dep].push(w);
    });
    const sections = Object.entries(groups).map(([office, deps]) => `
      <section class="group">
        <h2 class="office">${office}</h2>
        ${Object.entries(deps).map(([dep, list]) => `
          <h3 class="dept-title">${dep}</h3>
          <div class="grid">
            ${list.map((w) => `
              <div class="wifi-card">
                <div class="title">WiFi Network</div>
                <div class="wifi-name">${w.wifi_name || ''}</div>
                ${w.wifi_qr_code ? `<div class="qr-code"><img src="${w.wifi_qr_code}" alt="QR"></div>` : ''}
                <div class="scan-text">Scan QR Code to connect</div>
                <div class="password-box">
                  <div class="password-label">Password</div>
                  <div class="password">${w.wifi_password || ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </section>
    `).join('');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title></title>
      <style>
        @page { size: A4; margin: 0; }
        :root { --p: ${primary}; --pg: ${primaryGlow}; --ps: ${primarySoft}; }
        * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
        body { font-family:'Segoe UI',system-ui,sans-serif; background:#fff; padding:10mm; }
        .page-header { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:6px; border-bottom:3px solid var(--p); padding-bottom:10px; margin-bottom:14px; }
        .page-header img { width:60px; height:60px; object-fit:contain; }
        .page-header .brand h1 { font-size:20px; color:var(--p); margin:0; }
        .page-header .brand p { font-size:12px; color:#475569; margin:2px 0 0; }
        .group { margin-bottom:18px; }
        .office { font-size:16px; color:var(--p); background:var(--ps); padding:6px 10px; border-left:4px solid var(--p); margin-bottom:8px; }
        .dept-title { font-size:13px; color:var(--p); background:var(--ps); padding:4px 10px; border-left:3px solid var(--pg); margin:8px 0; }
        .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        .wifi-card { padding:20px; background:#fff; border:3px solid var(--p); border-radius:16px; text-align:center; page-break-inside:avoid; }
        .title { font-size:14px; color:var(--p); }
        .wifi-name { font-size:20px; font-weight:bold; color:#1e293b; margin:8px 0; }
        .qr-code { width:150px; height:150px; margin:10px auto; border:3px solid var(--p); border-radius:12px; padding:6px; background:#fff; }
        .qr-code img { width:100%; height:100%; }
        .scan-text { font-size:11px; color:#64748b; margin:4px 0; }
        .password-box { background:linear-gradient(135deg,var(--p),var(--pg)); color:#fff; padding:10px; border-radius:10px; margin-top:8px; }
        .password-label { font-size:10px; opacity:.9; text-transform:uppercase; letter-spacing:1px; }
        .password { font-size:16px; font-weight:bold; letter-spacing:2px; margin-top:4px; }
        @media print { body { background:#fff; } }
      </style></head>
      <body>
        <div class="page-header">
          <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR Group" />
          <div class="brand">
            <h1>MNR Group - IT Department</h1>
            <p>WiFi Networks${titleSuffix ? ' — ' + titleSuffix : ''} · Total: ${wifis.length}</p>
          </div>
        </div>
        ${sections}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const handleExportData = () => {
    const data = wifiNetworks;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wifi_networks_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "WiFi networks data has been exported successfully." });
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const inputEl = event.target;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== "string") throw new Error("Unreadable file");
        const parsed = JSON.parse(result);

        // Accept: array | { wifi_networks: [] } | { data: [] } | full-site backup
        const list: any[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.wifi_networks)
          ? parsed.wifi_networks
          : Array.isArray(parsed?.wifiNetworks)
          ? parsed.wifiNetworks
          : Array.isArray(parsed?.data?.wifi_networks)
          ? parsed.data.wifi_networks
          : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

        if (!list.length) throw new Error("No WiFi networks found in this file");

        const existing = await dbService.getWifiNetworks();
        const key = (n: string, o: string, d: string) =>
          `${(n || "").trim().toLowerCase()}|${(o || "").trim().toLowerCase()}|${(d || "").trim().toLowerCase()}`;
        const seen = new Set(
          (existing || []).map((w: any) => key(w.wifi_name, w.office_name, w.department_name))
        );

        let added = 0;
        let skipped = 0;
        for (const raw of list) {
          const wifi_name = raw?.wifi_name ?? raw?.wifiName ?? raw?.ssid;
          if (!wifi_name) { skipped++; continue; }
          const wifi_password = raw?.wifi_password ?? raw?.password ?? "";
          const office_name = raw?.office_name ?? raw?.office ?? "";
          const department_name = raw?.department_name ?? raw?.department ?? "";
          const k = key(wifi_name, office_name, department_name);
          if (seen.has(k)) { skipped++; continue; }
          seen.add(k);
          const qr = raw?.wifi_qr_code || (await generateQRCode(wifi_name, wifi_password));
          await dbService.addWifiNetwork({
            wifi_name,
            wifi_password,
            office_name,
            department_name,
            ip_address: raw?.ip_address ?? "",
            wifi_qr_code: qr,
          });
          added++;
        }

        await loadData();
        toast({
          title: "Data imported",
          description: `${added} WiFi network(s) imported${skipped ? `, ${skipped} skipped (duplicate/invalid)` : ""}.`,
          className:
            "border-2 border-primary/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)] bg-gradient-to-br from-background via-background to-primary/10",
        });
      } catch (error: any) {
        console.error("WiFi import failed:", error);
        toast({
          title: "Import failed",
          description: error?.message || "Failed to import data. Please check the file format.",
          variant: "destructive",
          className:
            "border-2 border-destructive/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)] bg-gradient-to-br from-background via-background to-destructive/10",
        });
      } finally {
        if (inputEl) inputEl.value = "";
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({ title: "Copied!", description: `${label}: ${value}` });
  };

  const buildShareText = (wifi: WifiNetwork) =>
    `🌟 Welcome to MNR Group! 🌟\n\nWe are delighted to have you with us. Please find your complimentary WiFi access details below:\n\n📶 WiFi Name: ${wifi.wifi_name}\n🔑 Password: ${wifi.wifi_password}\n\n💻 A warm welcome from the IT Department — we're always here to assist you. Should you face any connectivity issues, please don't hesitate to reach out.\n\n✅ Enjoy a smooth and secure connection!\n\n— IT Department, MNR Group`;

  const shareWifi = (wifi: WifiNetwork) => setShareTarget(wifi);

  const getWifiByOffice = () => {
    const officeGroups: { [key: string]: WifiNetwork[] } = {};
    const q = searchTerm.toLowerCase();
    const filtered = wifiNetworks.filter(wifi => {
      if (officeFilter !== "all" && wifi.office_name !== officeFilter) return false;
      if (deptFilter !== "all" && wifi.department_name !== deptFilter) return false;
      if (!q) return true;
      return (
        wifi.wifi_name?.toLowerCase().includes(q) ||
        wifi.office_name?.toLowerCase().includes(q) ||
        wifi.department_name?.toLowerCase().includes(q)
      );
    });

    // Seed keys in unit creation order so cards appear in the order they were added
    unitsList.forEach((u: any) => {
      if (u?.name) officeGroups[u.name] = [];
    });

    filtered.forEach(wifi => {
      if (wifi.office_name) {
        if (!officeGroups[wifi.office_name]) {
          officeGroups[wifi.office_name] = [];
        }
        officeGroups[wifi.office_name].push(wifi);
      }
    });

    // When filtering/searching, drop empty seeded units
    if (q || officeFilter !== "all" || deptFilter !== "all") {
      Object.keys(officeGroups).forEach((k) => {
        if (officeGroups[k].length === 0) delete officeGroups[k];
      });
    }
    return officeGroups;
  };

  const getWifiByDepartment = (officeName: string) => {
    const deptGroups: { [key: string]: WifiNetwork[] } = {};
    const filtered = searchTerm
      ? wifiNetworks.filter(wifi => 
          wifi.office_name === officeName &&
          (wifi.wifi_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           wifi.department_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : wifiNetworks.filter(wifi => wifi.office_name === officeName);

    // Seed keys in department creation order so cards render in the order departments were added
    const norm = (v: string) => (v || "").trim().toLowerCase();
    departmentsList
      .filter((d: any) => norm(d.unit) === norm(officeName))
      .forEach((d: any) => {
        if (d?.name) deptGroups[d.name] = [];
      });

    filtered.forEach(wifi => {
      if (wifi.department_name) {
        if (!deptGroups[wifi.department_name]) {
          deptGroups[wifi.department_name] = [];
        }
        deptGroups[wifi.department_name].push(wifi);
      }
    });

    if (searchTerm) {
      Object.keys(deptGroups).forEach((k) => {
        if (deptGroups[k].length === 0) delete deptGroups[k];
      });
    }
    return deptGroups;
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="office_name">Office/Unit Name *</Label>
          <Input
            id="office_name"
            value={formData.office_name}
            onChange={(e) => setFormData({ ...formData, office_name: e.target.value })}
            placeholder="Type office name"
            required
          />
        </div>
        <div>
          <Label htmlFor="department_name">Department Name *</Label>
          <Input
            id="department_name"
            value={formData.department_name}
            onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
            placeholder="Type department name"
            required
          />
        </div>
        <div>
          <Label htmlFor="wifi_name">WiFi Name (SSID) *</Label>
          <Input
            id="wifi_name"
            value={formData.wifi_name}
            onChange={(e) => setFormData({ ...formData, wifi_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="wifi_password">WiFi Password *</Label>
          <Input
            id="wifi_password"
            type="text"
            value={formData.wifi_password}
            onChange={(e) => setFormData({ ...formData, wifi_password: e.target.value })}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="ip_address">IP Address</Label>
          <Input
            id="ip_address"
            value={formData.ip_address}
            onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            placeholder="e.g., 192.168.1.1"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
          {editingWifi ? "Update" : "Add"} WiFi Network
        </Button>
      </DialogFooter>
    </form>
  );

  const wifiByOffice = getWifiByOffice();

  const shareDialog = (
    <Dialog open={!!shareTarget} onOpenChange={(o) => !o && setShareTarget(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share WiFi</DialogTitle>
          <DialogDescription>
            {shareTarget ? `Send "${shareTarget.wifi_name}" credentials via:` : ''}
          </DialogDescription>
        </DialogHeader>
        {shareTarget && (() => {
          const text = buildShareText(shareTarget);
          const enc = encodeURIComponent(text);
          const subject = encodeURIComponent(`WiFi Access - ${shareTarget.wifi_name}`);
          const options = [
            { label: 'WhatsApp', color: 'bg-emerald-500', href: `https://wa.me/?text=${enc}` },
            { label: 'Imo', color: 'bg-sky-500', href: `imo://send?text=${enc}` },
            { label: 'Email (Gmail)', color: 'bg-red-500', href: `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${enc}` },
            { label: 'Outlook Email', color: 'bg-blue-600', href: `https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${enc}` },
            { label: 'Default Mail', color: 'bg-slate-600', href: `mailto:?subject=${subject}&body=${enc}` },
            { label: 'Telegram', color: 'bg-cyan-500', href: `https://t.me/share/url?url=${enc}&text=${enc}` },
            { label: 'SMS', color: 'bg-amber-500', href: `sms:?body=${enc}` },
          ];
          return (
            <div className="grid grid-cols-2 gap-2">
              {options.map((o) => (
                <a
                  key={o.label}
                  href={o.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(() => setShareTarget(null), 300)}
                  className={`${o.color} text-white text-sm font-semibold text-center py-3 rounded-lg hover:opacity-90 transition`}
                >
                  {o.label}
                </a>
              ))}
              <button
                onClick={() => { navigator.clipboard.writeText(text); toast({ title: 'Copied', description: 'Share text copied.' }); setShareTarget(null); }}
                className="col-span-2 border-2 border-primary text-primary text-sm font-semibold text-center py-3 rounded-lg hover:bg-primary/10 transition"
              >
                Copy to Clipboard
              </button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
  const officeOptions = [
    { value: "all", label: "All Units/Offices" },
    ...Array.from(new Set(wifiNetworks.map(w => w.office_name).filter(Boolean))).sort().map(v => ({ value: v, label: v })),
  ];

  const unitDeptDialogs = (
    <>
      <Dialog open={!!editUnit} onOpenChange={(o) => !o && setEditUnit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit/Office</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit_unit_name">Unit/Office Name *</Label>
              <Input id="edit_unit_name" value={editUnitName} onChange={(e) => setEditUnitName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnit(null)}>Cancel</Button>
            <Button onClick={handleUpdateUnit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDept} onOpenChange={(o) => !o && setEditDept(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Under Unit/Office: <span className="font-semibold text-primary">{editDept?.unit || selectedOffice}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit_dept_name">Department Name *</Label>
              <Input id="edit_dept_name" value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDept(null)}>Cancel</Button>
            <Button onClick={handleUpdateDept}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUnit} onOpenChange={(o) => !o && setDeleteUnit(null)}>
        <AlertDialogContent className="border-2 border-destructive/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)] bg-gradient-to-br from-background via-background to-destructive/5">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60 bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-destructive">Delete Unit/Office?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              "{deleteUnit?.name}" and all its WiFi networks will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDept} onOpenChange={(o) => !o && setDeleteDept(null)}>
        <AlertDialogContent className="border-2 border-destructive/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)] bg-gradient-to-br from-background via-background to-destructive/5">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60 bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-destructive">Delete Department?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              "{deleteDept?.name}" and all its WiFi networks will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDept} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
  const deptOptions = [
    { value: "all", label: "All Departments" },
    ...Array.from(new Set(
      wifiNetworks
        .filter(w => officeFilter === "all" || w.office_name === officeFilter)
        .map(w => w.department_name)
        .filter(Boolean)
    )).sort().map(v => ({ value: v, label: v })),
  ];

  // Office view
  if (!selectedOffice) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              WiFi Networks
            </h1>
            <p className="text-muted-foreground mt-2">Select an office to view WiFi networks</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={printTheme} onValueChange={setPrintTheme}>
              <SelectTrigger className="w-32 border-primary/30">
                <SelectValue placeholder="Print Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blue">🔵 Blue</SelectItem>
                <SelectItem value="green">🟢 Green</SelectItem>
                <SelectItem value="purple">🟣 Purple</SelectItem>
                <SelectItem value="orange">🟠 Orange</SelectItem>
                <SelectItem value="red">🔴 Red</SelectItem>
                <SelectItem value="teal">🩵 Teal</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('wifi-import-file')?.click()} className="border-primary/30 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const all = Object.values(wifiByOffice).flat();
                const suffix = [
                  officeFilter !== "all" ? officeFilter : null,
                  deptFilter !== "all" ? deptFilter : null,
                ].filter(Boolean).join(" - ");
                printWifiList(all, suffix);
              }}
              className="border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print ({Object.values(wifiByOffice).flat().length})
            </Button>
            <input id="wifi-import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
            <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
              <PermGate action="add">
                <DialogTrigger asChild>
                  <Button onClick={() => setNewUnitName("")} className="bg-transparent border-2 border-primary text-primary hover:bg-primary/10">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Unit/Office
                  </Button>
                </DialogTrigger>
              </PermGate>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Unit/Office</DialogTitle>
                  <DialogDescription>Create a new unit/office to organize WiFi networks</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label htmlFor="unit_name">Unit/Office Name *</Label>
                    <Input
                      id="unit_name"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="Enter unit/office name"
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUnitDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddUnit}>Add Unit/Office</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search Filter */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search WiFi networks by name, office, or department..."
              filters={[
                {
                  value: officeFilter,
                  onChange: (v) => { setOfficeFilter(v); setDeptFilter("all"); },
                  options: officeOptions,
                  placeholder: "Unit/Office",
                },
                {
                  value: deptFilter,
                  onChange: setDeptFilter,
                  options: deptOptions,
                  placeholder: "Department",
                },
              ]}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {(searchTerm || officeFilter !== "all" || deptFilter !== "all") ? (
            Object.values(wifiByOffice).flat().map((wifi) => (
              <Card key={wifi.id} className="animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-sky-400 dark:border-sky-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle
                        className="text-lg text-primary cursor-pointer hover:underline"
                        title="Click to copy WiFi name"
                        onClick={() => copyToClipboard(wifi.wifi_name, "WiFi Name")}
                      >
                        {wifi.wifi_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <span className="font-semibold">{wifi.office_name}</span>
                        {wifi.department_name && <> · <span className="text-success font-semibold">{wifi.department_name}</span></>}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => shareWifi(wifi)} title="Share WiFi">
                        <Share2 className="h-3 w-3" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" title="Actions"><MoreVertical className="h-3 w-3" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermGate action="edit">
                            <DropdownMenuItem onClick={() => handleEdit(wifi)}>
                              <Edit className="h-3 w-3 mr-2" /> Edit
                            </DropdownMenuItem>
                          </PermGate>
                          <PermGate action="delete">
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(wifi.id)}>
                              <Trash2 className="h-3 w-3 mr-2" /> Delete
                            </DropdownMenuItem>
                          </PermGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-semibold">Password:</span>{" "}
                      <span
                        className="cursor-pointer text-primary hover:underline font-mono"
                        title="Click to copy password"
                        onClick={() => copyToClipboard(wifi.wifi_password, "Password")}
                      >
                        {wifi.wifi_password}
                      </span>
                    </p>
                    {wifi.ip_address && (
                      <p><span className="font-semibold">IP:</span> <span className="text-primary">{wifi.ip_address}</span></p>
                    )}
                  </div>
                  {wifi.wifi_qr_code && (
                    <div className="flex flex-col items-center space-y-2">
                      <img src={wifi.wifi_qr_code} alt="WiFi QR Code" className="w-40 h-40 border-2 border-primary/20 rounded-lg" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => downloadQRCode(wifi.wifi_qr_code, wifi.wifi_name)}>
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => printWifiCard(wifi)}>
                          <Printer className="h-3 w-3 mr-1" />
                          Print
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
          Object.entries(wifiByOffice).map(([officeName, officeWifis]) => (
            <Card 
              key={officeName} 
              className="cursor-pointer animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-sky-400 dark:border-sky-500"
              onClick={() => setSelectedOffice(officeName)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-primary flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      <span className="truncate">{officeName}</span>
                    </CardTitle>
                    <CardDescription>{officeWifis.length} WiFi Networks</CardDescription>
                  </div>
                  <PermGate action="edit">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditUnit(officeName); }}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteUnit(findUnitByName(officeName) || { id: null, name: officeName }); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PermGate>
                </div>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-lg">{officeWifis.length}</Badge>
              </CardContent>
            </Card>
          ))
          )}
        </div>

        {Object.keys(wifiByOffice).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No WiFi networks found</h3>
              <p className="text-muted-foreground">Add your first WiFi network to get started</p>
            </CardContent>
          </Card>
        )}
        {shareDialog}
        {unitDeptDialogs}
      </div>
    );
  }

  // Department view
  if (selectedOffice && !selectedDepartment) {
    const wifiByDept = getWifiByDepartment(selectedOffice);
    
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedOffice(null); setSearchTerm(""); }}
              aria-label="Back to Offices"
              title="Back to Offices"
              className="mb-4 border-2 border-primary text-primary bg-transparent hover:bg-primary/15 hover:text-primary hover:border-primary hover:ring-2 hover:ring-primary/40 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {selectedOffice} - Departments
            </h1>
            <p className="text-muted-foreground mt-2">Select a department to view WiFi details</p>
          </div>
          <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
            <PermGate action="add">
              <DialogTrigger asChild>
                <Button
                  onClick={() => setNewDeptName("")}
                  className="bg-transparent border-2 border-primary text-primary hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Department</DialogTitle>
                <DialogDescription>Under Unit/Office: <span className="font-semibold text-primary">{selectedOffice}</span></DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Unit/Office</Label>
                  <Input value={selectedOffice || ""} disabled className="bg-muted" />
                </div>
                <div>
                  <Label htmlFor="dept_name">Department Name *</Label>
                  <Input
                    id="dept_name"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="Enter department name"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddDepartment}>Add Department</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Filter */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search WiFi networks..."
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {searchTerm ? (
            Object.values(wifiByDept).flat().map((wifi) => (
              <Card key={wifi.id} className="animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-sky-400 dark:border-sky-500">
                <CardHeader>
                  <CardTitle
                    className="text-lg text-primary cursor-pointer hover:underline"
                    title="Click to open department"
                    onClick={() => setSelectedDepartment(wifi.department_name)}
                  >
                    {wifi.wifi_name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    <span className="text-success font-semibold">{wifi.department_name}</span>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))
          ) : (
          Object.entries(wifiByDept).map(([deptName, deptWifis]) => (
            <Card 
              key={deptName} 
              className="cursor-pointer animate-scale-in bg-gradient-to-br from-card to-card/80 border-2 border-emerald-400 dark:border-emerald-500"
              onClick={() => setSelectedDepartment(deptName)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Badge className="w-fit mb-2">{deptWifis.length} Networks</Badge>
                    <CardTitle className="text-primary flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      <span className="truncate">{deptName}</span>
                    </CardTitle>
                  </div>
                  <PermGate action="edit">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDept(deptName); }}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDept(findDeptByName(deptName, selectedOffice || "") || { id: null, name: deptName, unit: selectedOffice }); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PermGate>
                </div>
              </CardHeader>
            </Card>
          )))}
        </div>

        {Object.keys(wifiByDept).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No departments found</h3>
              <p className="text-muted-foreground">Add WiFi networks to create departments</p>
            </CardContent>
          </Card>
        )}
        {unitDeptDialogs}
      </div>
    );
  }

  // WiFi details view
  const filteredWifi = wifiNetworks.filter(
    wifi => wifi.office_name === selectedOffice && wifi.department_name === selectedDepartment
  ).filter(wifi => 
    !searchTerm || wifi.wifi_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setSelectedDepartment(null); setSearchTerm(""); }}
            aria-label="Back to Departments"
            title="Back to Departments"
            className="mb-4 border-2 border-primary text-primary bg-transparent hover:bg-primary/15 hover:text-primary hover:border-primary hover:ring-2 hover:ring-primary/40 transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {selectedOffice} - {selectedDepartment}
          </h1>
          <p className="text-muted-foreground mt-2">{filteredWifi.length} WiFi networks</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => printWifiList(filteredWifi, `${selectedOffice} - ${selectedDepartment}`)}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print ({filteredWifi.length})
          </Button>
          <PermGate action="add">
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm();
                  setFormData(prev => ({ ...prev, office_name: selectedOffice, department_name: selectedDepartment }));
                }}
                className="bg-transparent border-2 border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add WiFi Network
              </Button>
            </DialogTrigger>
          </PermGate>
          </div>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingWifi ? "Edit WiFi Network" : "Add New WiFi Network"}</DialogTitle>
              <DialogDescription>QR code will be generated automatically</DialogDescription>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Filter */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search WiFi networks..."
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filteredWifi.map((wifi) => (
          <Card key={wifi.id} className="animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-sky-400 dark:border-sky-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle
                    className="text-lg text-primary cursor-pointer hover:underline"
                    title="Click to copy WiFi name"
                    onClick={() => copyToClipboard(wifi.wifi_name, "WiFi Name")}
                  >
                    {wifi.wifi_name}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    <span className="font-bold text-success">{wifi.department_name}</span>
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => shareWifi(wifi)} title="Share WiFi">
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" title="Actions"><MoreVertical className="h-3 w-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <PermGate action="edit">
                        <DropdownMenuItem onClick={() => handleEdit(wifi)}>
                          <Edit className="h-3 w-3 mr-2" /> Edit
                        </DropdownMenuItem>
                      </PermGate>
                      <PermGate action="delete">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(wifi.id)}>
                          <Trash2 className="h-3 w-3 mr-2" /> Delete
                        </DropdownMenuItem>
                      </PermGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Password:</span>{" "}
                  <span
                    className="cursor-pointer text-primary hover:underline font-mono"
                    title="Click to copy password"
                    onClick={() => copyToClipboard(wifi.wifi_password, "Password")}
                  >
                    {wifi.wifi_password}
                  </span>
                </p>
                {wifi.ip_address && (
                  <p><span className="font-semibold">IP:</span> <span className="text-primary">{wifi.ip_address}</span></p>
                )}
              </div>
              
              {wifi.wifi_qr_code && (
                <div className="flex flex-col items-center space-y-2">
                  <img src={wifi.wifi_qr_code} alt="WiFi QR Code" className="w-40 h-40 border-2 border-primary/20 rounded-lg" />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => downloadQRCode(wifi.wifi_qr_code, wifi.wifi_name)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => printWifiCard(wifi)}
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Print
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWifi.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Wifi className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No WiFi networks found</h3>
            <p className="text-muted-foreground">Add WiFi networks to this department</p>
          </CardContent>
        </Card>
      )}

      {/* Hidden print content */}
      <div id="wifi-print-content" className="hidden">
        {printWifi && (
          <WifiPrintCard
            ref={printRef}
            wifiName={printWifi.wifi_name}
            wifiPassword={printWifi.wifi_password}
            qrCode={printWifi.wifi_qr_code}
          />
        )}
      </div>
      {shareDialog}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="border-2 border-destructive/60 rounded-2xl shadow-[0_0_40px_-8px_hsl(var(--destructive)/0.5)] bg-gradient-to-br from-background via-background to-destructive/5">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60 bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-destructive">
              Delete WiFi Network?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              This action cannot be undone. The WiFi network will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WifiList;
