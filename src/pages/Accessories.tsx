import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PermGate from "@/components/PermGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Monitor,
  Smartphone,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wifi,
  Shield,
  HardDrive,
  Printer,
  Calendar,
  Network,
  Eye,
  Download,
  Upload,
  Filter,
  Camera,
  Image as ImageIcon,
  X,
  MoreVertical,
  Copy,
  EyeOff,
  Mail,
  Phone as PhoneIcon,
  KeyRound,
  Cpu,
  ArrowLeft,
  FileText,
} from "lucide-react";
import dbService from "@/services/dbService";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";

const deviceTypes = [
  { value: "laptop", label: "Laptop" },
  { value: "desktop", label: "Desktop" },
  { value: "ip_phone", label: "IP Phone" }
];

const windowsVersions = [
  { value: "windows_10_pro", label: "Windows 10 Pro" },
  { value: "windows_11_pro", label: "Windows 11 Pro" },
  { value: "windows_10_enterprise", label: "Windows 10 Enterprise" },
  { value: "windows_server_2019", label: "Windows Server 2019 Standard" },
  { value: "windows_10_iot", label: "Windows 10 IoT Enterprise" }
];

const isAntivirusExpired = (validity: string | null | undefined) => {
  if (!validity) return false;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(validity)
    ? new Date(`${validity}T00:00:00`)
    : new Date(validity);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const PROFILE_BANNER_CSS = `
.profile-banner{position:relative;background:linear-gradient(120deg,#0f172a 0%,#172554 52%,#075985 100%);color:#fff;padding:22px 26px;border-radius:16px;overflow:hidden;margin-bottom:0}
.profile-banner::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 88% 8%,rgba(125,211,252,.26),transparent 42%),radial-gradient(circle at 10% 100%,rgba(56,189,248,.16),transparent 48%);pointer-events:none}
.profile-banner .pb-top{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
.profile-banner .pb-brand{display:flex;align-items:center;gap:12px}
.profile-banner .pb-brand img{height:42px;background:#fff;padding:5px 7px;border-radius:10px}
.profile-banner .pb-brand h1{margin:0;font-size:19px;letter-spacing:.2px;font-weight:800}
.profile-banner .pb-brand p{margin:3px 0 0;font-size:9px;opacity:.78;letter-spacing:1.5px;text-transform:uppercase}
.profile-banner .pb-date{font-size:10px;font-weight:600;letter-spacing:.5px;color:#e0f2fe;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);padding:7px 11px;border-radius:8px}
.profile-banner .pb-identity{position:relative;z-index:1;display:flex;align-items:center;gap:16px;margin-top:22px;padding-top:18px;border-top:1px solid rgba(255,255,255,.2)}
.profile-banner .pb-avatar{display:flex;width:64px;height:64px;flex:0 0 64px;align-items:center;justify-content:center;overflow:hidden;border:2px solid rgba(255,255,255,.55);border-radius:16px;background:rgba(255,255,255,.14);color:#fff;font-size:18px;font-weight:800;box-shadow:0 5px 16px rgba(2,6,23,.2)}
.profile-banner .pb-avatar img{width:100%;height:100%;object-fit:cover}
.profile-banner .pb-person{min-width:0}
.profile-banner .pb-name{margin:0;color:#fff;font-size:25px;font-weight:800;line-height:1.15;letter-spacing:-.35px;overflow-wrap:anywhere}
.profile-banner .pb-designation{margin:5px 0 0;color:#bae6fd;font-size:12px;font-weight:500;letter-spacing:.2px}
.profile-banner .pb-crumbs{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:12px;font-size:10px}
.profile-banner .pb-chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);padding:5px 10px;border-radius:7px;font-weight:600;letter-spacing:.2px}
.profile-banner .pb-sep{opacity:.35}
`;

const PROFILE_SCREEN_CSS = `
#asset-profile{color:#0f172a}
#asset-profile .profile-hero{position:relative;isolation:isolate;overflow:hidden;border-radius:24px;padding:22px;background:linear-gradient(125deg,#0f172a 0%,#172554 50%,#0369a1 100%);color:#fff;box-shadow:0 18px 40px -24px rgba(2,132,199,.65)}
#asset-profile .profile-hero::after{content:"";position:absolute;z-index:-1;width:280px;height:280px;right:-85px;top:-155px;border-radius:50%;background:rgba(125,211,252,.16);box-shadow:0 0 0 35px rgba(125,211,252,.06),0 0 0 70px rgba(125,211,252,.04)}
#asset-profile .profile-section{min-width:0;padding:18px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 8px 24px -20px rgba(15,23,42,.4)}
#asset-profile .profile-section-title{display:flex;align-items:center;min-height:34px;margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:15px;font-weight:750;letter-spacing:-.01em}
#asset-profile .print-info-grid{align-items:stretch}
#asset-profile .print-info-item{height:100%;min-width:0;border:1px solid #e2e8f0;border-left:3px solid #38bdf8;border-radius:14px;background:linear-gradient(145deg,#fff,#f8fafc);box-shadow:0 3px 10px -8px rgba(15,23,42,.24)}
#asset-profile .print-info-item:hover{transform:translateY(-1px);box-shadow:0 8px 18px -12px rgba(2,132,199,.5)}
#asset-profile .profile-section table{overflow:hidden;border:1px solid #e2e8f0;border-radius:12px}
@media(max-width:639px){#asset-profile .profile-section{padding:14px;border-radius:16px}#asset-profile .profile-hero{padding:18px;border-radius:18px}}
:is(.dark) #asset-profile .profile-section{border-color:#334155;background:#111827}
:is(.dark) #asset-profile .profile-section-title{border-color:#334155;color:#f1f5f9}
:is(.dark) #asset-profile .print-info-item{border-color:#334155;background:linear-gradient(145deg,#1e293b,#111827)}
@media print{#asset-profile{max-width:none!important;padding:0!important}#asset-profile .profile-section{break-inside:avoid;box-shadow:none;border-color:#cbd5e1}#asset-profile .print-info-item{box-shadow:none;transform:none}#asset-profile .profile-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

const buildProfileBanner = (asset: any) => {
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const unit = asset?.unit_office || '—';
  const dept = asset?.division || asset?.department || '—';
  const name = asset?.employee_name || 'Unknown User';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'U';
  const avatar = asset?.picture
    ? `<img src="${asset.picture}" alt="${name}"/>`
    : initials;
  return `<div class="profile-banner">
    <div class="pb-top">
      <div class="pb-brand">
        <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR"/>
        <div><h1>MNR Group</h1><p>IT Asset Profile</p></div>
      </div>
      <div class="pb-date">${date}</div>
    </div>
    <div class="pb-identity">
      <div class="pb-avatar">${avatar}</div>
      <div class="pb-person">
        <h2 class="pb-name">${name}</h2>
        <p class="pb-designation">${asset?.designation || 'Designation not set'}</p>
      </div>
    </div>
    <div class="pb-crumbs">
      <span class="pb-chip">Department · ${dept}</span>
      <span class="pb-chip">Unit / Office · ${unit}</span>
    </div>
  </div>`;
};

// Open custom protocol URLs (tightvnc://, anydesk://, ultraviewer://) safely —
// window.open throws "invalid URL" for these in some browsers.
const openAppProtocol = (url: string) => {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch { /* protocol handler not installed */ }
};

const Accessories = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accessories, setAccessories] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAntivirus, setFilterAntivirus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState(null);
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearchTerm(q);
  }, [searchParams]);

  const copyToClipboard = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied`, description: value });
  };

  // Return to whatever route opened this page (deep-link `from` param), else stay.
  const goBackToOrigin = () => {
    const from = searchParams.get("from");
    if (from) {
      navigate(from, {
        replace: true,
        state: location.state,
      });
      return true;
    }
    return false;
  };

  // ===== Issue Voucher (same layout as the official MNR paper voucher) =====
  const printIssueVoucher = (asset: any) => {
    const esc = (v: any) => String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[c]);
    const peripherals: any[] = Array.isArray(asset.peripherals) ? asset.peripherals : [];
    const periphQty = peripherals.reduce((s, p) => s + (parseInt(p.quantity) || 0), 0);
    const totalItems = 1 + periphQty;
    const periphNames = peripherals.map((p) => p.product_type).filter(Boolean).join(", ");
    const desc = `${esc(asset.device_type || "Device")}: Model: ${esc(asset.specification || "-")}${
      asset.sl_no ? `  SL: ${esc(asset.sl_no)}` : ""
    }${periphNames ? `<br/>(${esc(periphNames)})` : ""}`;
    const issueDate = asset.purchase_date
      ? new Date(asset.purchase_date).toLocaleDateString("en-GB").replace(/\//g, ".")
      : new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title></title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{font-family:'Times New Roman',Georgia,serif;color:#111;margin:0;padding:16mm 14mm;font-size:13.5px;line-height:1.55}
.center{text-align:center}
.company{font-size:19px;font-weight:700;text-decoration:underline;margin-bottom:6px}
.addr{font-size:15px;font-weight:700;text-decoration:underline;margin-bottom:6px}
.doc-title{font-size:16px;font-weight:700;text-decoration:underline;margin-bottom:22px}
ol.info{margin:0 0 14px 4px;padding-left:18px}
ol.info li{margin-bottom:9px}
table{width:100%;border-collapse:collapse;margin:14px 0 18px}
th,td{border:1px solid #333;padding:6px 8px;vertical-align:top;font-size:13px}
th{font-weight:400;text-align:left}
.tc-title{font-weight:700;text-decoration:underline;margin:6px 0 6px 4px}
ul.tc{list-style:none;margin:0 0 26px 4px;padding:0}
ul.tc li{margin-bottom:5px;padding-left:20px;position:relative}
ul.tc li:before{content:"\\2713";position:absolute;left:0}
.sign{margin-top:34px}
.sign .line{border-top:1px solid #333;width:210px;margin:34px 0 4px}
</style></head><body>
<div class="center">
  <div class="company">${esc(asset.unit_office || "MNR Sweaters Ltd.")}</div>
  <div class="addr">Baraiderchala, Sreepur, Gazipur, Dhaka</div>
  <div class="doc-title">Issue Voucher</div>
</div>
<ol class="info">
  <li>Name: ${esc(asset.employee_name || "")}</li>
  <li>ID NO: ${esc(asset.id_no || "")}</li>
  <li>Designation: ${esc(asset.designation || "")}</li>
  <li>Department: ${esc(asset.division || "")}</li>
  <li>The following equipment / stationary items have been issued to you. Please acknowledge receipts of the same. In case of employment separation, you must deposit the goods to the office in workable conditions.</li>
</ol>
<table>
  <thead><tr>
    <th style="width:12%">Serial No</th>
    <th style="width:38%">Descriptions</th>
    <th style="width:12%">No of the Items</th>
    <th style="width:16%">Date of Issue</th>
    <th style="width:22%">Receiver's Signature with Date</th>
  </tr></thead>
  <tbody><tr>
    <td>1</td>
    <td>${desc}</td>
    <td class="center">${totalItems}</td>
    <td>${issueDate}</td>
    <td></td>
  </tr></tbody>
</table>
<div class="tc-title">Terms and Conditions:</div>
<ul class="tc">
  <li>The Laptop will be MNR Group property.</li>
  <li>It should be used carefully.</li>
  <li>Laptop should be used only for office work purposes.</li>
  <li>Do not change current settings.</li>
  <li>Any hardware issue in the warranty period please don't replace/repair without notifying the IT Department of MNR Group.</li>
  <li>If you lost the Laptop immediately notify the IT Department, MNR Group. The management of MNR Group will decide the damage or penalty for the incident.</li>
  <li>Before you leave the job, you must return the Laptop to issuing authority.</li>
  <li>MNR Group reserves the right to withdraw the Laptop from its user at any time without any prior notice.</li>
</ul>
<div class="sign">
  <div>Issued By</div>
  <div class="line"></div>
  <div>Signature</div>
  <div>IT Department, MNR Sweaters Limited</div>
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };
  
  const [formData, setFormData] = useState({
    unit: "",
    division: "",
    sl_no: "",
    pc_no: "",
    dp_lp_no: "",
    employee_name: "",
    designation: "",
    id_no: "",
    email: "",
    email_password: "",
    device_type: "",
    specification: "",
    mobile: "",
    ip_no: "",
    unit_office: "",
    ultraview_id: "",
    anydesk_id: "",
    windows_version: "",
    antivirus_code: "",
    antivirus_validity: "",
    printer: "",
    scanner: "",
    boot_partition: "",
    peripherals: [],
    purchase_date: "",
    remarks: "",
    picture: ""
  });

  const [peripheralForm, setPeripheralForm] = useState({
    product_type: "",
    exchange_date: new Date().toISOString().slice(0, 16),
    exchange_reason: "",
    quantity: 1,
    exchange_history: []
  });
  const [editingPeripheralIndex, setEditingPeripheralIndex] = useState(null);
  const [showPeripheralDialog, setShowPeripheralDialog] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useCloudRealtime(
    ["it_assets_cloud", "accessories_cloud", "units_cloud", "departments_cloud"],
    () => { loadData(); }
  );

  const loadData = async () => {
    const accessoriesData = await dbService.getITAssets();
    const usersData = await dbService.getUsers();
    const departmentsData = await dbService.getDepartments();
    const unitsData = await dbService.getUnits();
    
    setAccessories(accessoriesData);
    setUsers(usersData);
    setDepartments(departmentsData);
    setUnits(unitsData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const wasEditing = Boolean(editingAccessory);

    if (!formData.unit_office || !formData.division) {
      toast({
        title: "Required fields missing",
        description: "Please select both Unit/Office and Department before submitting.",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedUnit = units.find(unit => unit.name === formData.unit_office);
      const dataToSubmit = {
        ...formData,
        unit_id: selectedUnit?.id || 1
      };

      if (editingAccessory) {
        await dbService.updateITAsset(editingAccessory.id, dataToSubmit);
        toast({
          title: "IT Asset updated",
          description: "IT Asset information has been updated successfully.",
        });
      } else {
        await dbService.addITAsset(dataToSubmit);
        toast({
          title: "IT Asset added",
          description: "New IT Asset has been added successfully.",
        });
      }

      await loadData();
      resetForm();
      setIsDialogOpen(false);
      if (wasEditing) goBackToOrigin();
    } catch (err: any) {
      console.error("IT Asset save failed:", err);
      toast({
        title: "Save failed",
        description: err?.message || "Could not save IT Asset. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (accessory) => {
    setEditingAccessory(accessory);
    // Convert old string-based peripherals to new array format if needed
    const peripheralsData = Array.isArray(accessory.peripherals) 
      ? accessory.peripherals 
      : [];
    setFormData({
      ...accessory,
      peripherals: peripheralsData
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id) => {
    const asset = accessories.find((a: any) => a.id === id);
    setDeleteTarget(asset || { id });
  };

  // Deep link: /accessories?edit=<assetId> opens the edit form directly.
  const editHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || editHandledRef.current === editId) return;
    const target = (accessories as any[]).find((a: any) => String(a.id) === String(editId));
    if (target) {
      editHandledRef.current = editId;
      handleEdit(target);
    }
  }, [searchParams, accessories]);

  // Deep link: /accessories?profile=<assetId> opens the full profile view page.
  const profileHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const profileId = searchParams.get("profile");
    if (!profileId || profileHandledRef.current === profileId) return;
    const target = (accessories as any[]).find((a: any) => String(a.id) === String(profileId));
    if (target) {
      profileHandledRef.current = profileId;
      setSelectedAsset(target);
      setViewDetailsDialog(true);
      window.scrollTo({ top: 0 });
    }
  }, [searchParams, accessories]);

  const confirmDeleteAsset = async () => {
    if (!deleteTarget?.id) return;
    await dbService.deleteITAsset(deleteTarget.id);
    await loadData();
    toast({
      title: "IT Asset deleted",
      description: "IT Asset has been deleted successfully.",
    });
    setDeleteTarget(null);
  };

  const resetForm = () => {
    setFormData({
      unit: "",
      division: "",
      sl_no: "",
      pc_no: "",
      dp_lp_no: "",
      employee_name: "",
      designation: "",
      id_no: "",
      email: "",
    email_password: "",
      device_type: "",
      specification: "",
      mobile: "",
      ip_no: "",
      unit_office: "",
      ultraview_id: "",
      anydesk_id: "",
      windows_version: "",
      antivirus_code: "",
      antivirus_validity: "",
      printer: "",
      scanner: "",
      boot_partition: "",
      peripherals: [],
      purchase_date: "",
      remarks: "",
      picture: ""
    });
    setEditingAccessory(null);
  };

  const resetPeripheralForm = () => {
    setPeripheralForm({
      product_type: "",
      exchange_date: new Date().toISOString().slice(0, 16),
      exchange_reason: "",
      quantity: 1,
      exchange_history: []
    });
    setEditingPeripheralIndex(null);
  };

  const handleAddPeripheral = () => {
    if (!peripheralForm.product_type) {
      toast({
        title: "Error",
        description: "Please enter a product type",
        variant: "destructive",
      });
      return;
    }

    const currentDate = new Date().toISOString().slice(0, 16);
    const exchangeEntry = {
      date: peripheralForm.exchange_date || currentDate,
      reason: peripheralForm.exchange_reason
    };

    if (editingPeripheralIndex !== null) {
      const updatedPeripherals = [...formData.peripherals];
      const existingPeripheral = updatedPeripherals[editingPeripheralIndex];
      
      // Add to exchange history
      const updatedHistory = [...(existingPeripheral.exchange_history || []), exchangeEntry];
      
      updatedPeripherals[editingPeripheralIndex] = {
        ...peripheralForm,
        exchange_history: updatedHistory,
        exchange_date: peripheralForm.exchange_date || currentDate
      };
      
      setFormData({ ...formData, peripherals: updatedPeripherals });
      toast({
        title: "Peripheral updated",
        description: "Peripheral has been updated successfully.",
      });
    } else {
      const newPeripheral = {
        ...peripheralForm,
        exchange_date: peripheralForm.exchange_date || currentDate,
        exchange_history: [exchangeEntry]
      };
      setFormData({ ...formData, peripherals: [...formData.peripherals, newPeripheral] });
      toast({
        title: "Peripheral added",
        description: "Peripheral has been added successfully.",
      });
    }
    
    setShowPeripheralDialog(false);
    resetPeripheralForm();
  };

  const handleEditPeripheral = (index) => {
    setEditingPeripheralIndex(index);
    setPeripheralForm(formData.peripherals[index]);
    setShowPeripheralDialog(true);
  };

  const handleDeletePeripheral = (index) => {
    const updatedPeripherals = formData.peripherals.filter((_, i) => i !== index);
    setFormData({ ...formData, peripherals: updatedPeripherals });
    toast({
      title: "Peripheral deleted",
      description: "Peripheral has been removed successfully.",
    });
  };

  const getPeripheralStats = () => {
    const stats = {};
    formData.peripherals.forEach(peripheral => {
      if (!stats[peripheral.product_type]) {
        stats[peripheral.product_type] = 0;
      }
      stats[peripheral.product_type] += parseInt(peripheral.quantity) || 0;
    });
    return stats;
  };

  const getTotalPeripherals = () => {
    return formData.peripherals.reduce((total, peripheral) => {
      return total + (parseInt(peripheral.quantity) || 0);
    }, 0);
  };

  const getFilteredAccessories = () => {
    let filtered = Array.isArray(accessories) ? accessories : [];

    // Apply category filter locally
    if (filterCategory !== "all") {
      filtered = filtered.filter((asset: any) => {
        switch (filterCategory) {
          case 'laptops': return asset.device_type === 'laptop';
          case 'desktops': return asset.device_type === 'desktop';
          case 'in_repair': return asset.remarks?.toLowerCase().includes('repair') || asset.remarks?.toLowerCase().includes('faulty');
          case 'active': return !asset.remarks?.toLowerCase().includes('repair') && !asset.remarks?.toLowerCase().includes('faulty') && !asset.remarks?.toLowerCase().includes('inactive');
          case 'expired_antivirus': return isAntivirusExpired(asset.antivirus_validity);
          default: return true;
        }
      });
    }

    filtered = filtered.filter((accessory) => {
      const matchesDepartment = filterDepartment === "all" || accessory.division === filterDepartment;
      const matchesUnit = filterUnit === "all" || accessory.unit_office === filterUnit;
      const antivirusExpired = isAntivirusExpired(accessory.antivirus_validity);
      const matchesAntivirus =
        filterAntivirus === "all" ||
        (filterAntivirus === "expired" && antivirusExpired) ||
        (filterAntivirus === "valid" && Boolean(accessory.antivirus_validity) && !antivirusExpired);
      return matchesDepartment && matchesUnit && matchesAntivirus;
    });

    const withSl = filtered.map((accessory, index) => ({ ...accessory, __sl: index + 1 }));
    return withSl.filter((accessory, index) => {
      const q = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      if (q) {
        const devicePrefix = accessory.device_type === 'laptop' ? 'LP' : accessory.device_type === 'desktop' ? 'DP' : '';
        const derivedDpLp = accessory.dp_lp_no || (devicePrefix ? `${devicePrefix}-${accessory.pc_no || ''}` : '');
        const normalizeId = (value: any) => String(value || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
        const numericOnly = (value: any) => String(value || '').replace(/\D/g, '');
        const isNumberSearch = /^\d+$/.test(q);

        if (isNumberSearch) {
          const displaySl = String(accessory.__sl);
          matchesSearch =
            displaySl === q ||
            numericOnly(accessory.sl_no) === q ||
            numericOnly(accessory.pc_no) === q ||
            numericOnly(derivedDpLp) === q;
        } else {
        const flatten = (val: any): string => {
          if (val == null) return '';
          if (Array.isArray(val)) return val.map(flatten).join(' ');
          if (typeof val === 'object') return Object.values(val).map(flatten).join(' ');
          return String(val);
        };
          const haystack = `${flatten(accessory)} ${derivedDpLp} ${normalizeId(derivedDpLp)}`.toLowerCase();
          matchesSearch = haystack.includes(q) || normalizeId(derivedDpLp).includes(normalizeId(q));
        }
      }
      return matchesSearch;
    });
  };

  const filteredAccessories = getFilteredAccessories();

  const getBadgeVariant = (type) => {
    const typeMap = {
      "laptop": "default",
      "desktop": "secondary",
      "server": "destructive"
    };
    return typeMap[type?.toLowerCase()] || "outline";
  };

  const handleExportData = async () => {
    try {
      // NOTE: these are async DB reads — they must be awaited, otherwise the
      // exported JSON is just a serialized Promise (empty file).
      const [assets, unitsData, departmentsData] = await Promise.all([
        dbService.getITAssets(),
        dbService.getUnits(),
        dbService.getDepartments(),
      ]);
      const data = {
        exportDate: new Date().toISOString(),
        assets: assets || [],
        units: unitsData || [],
        departments: departmentsData || [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mnr_it_assets_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Data exported",
        description: `${(assets || []).length} IT asset(s) exported successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Could not export IT asset data.",
        variant: "destructive",
      });
    }
  };

  const handleImportData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') throw new Error("Invalid file format");
        const parsed = JSON.parse(result);
        // Accept: plain array of assets, { assets: [] }, { data: { it_assets: [] } }
        const payload = Array.isArray(parsed)
          ? { assets: parsed }
          : parsed?.data && typeof parsed.data === 'object'
            ? { assets: parsed.data.it_assets || parsed.data.assets || [], units: parsed.data.units, departments: parsed.data.departments }
            : { assets: parsed?.assets || [], units: parsed?.units, departments: parsed?.departments };

        if (!Array.isArray(payload.assets) || payload.assets.length === 0) {
          throw new Error("No IT asset records found in this file.");
        }
        const success = await dbService.importData(payload);
        if (!success) throw new Error("Import failed");
        await loadData();
        toast({
          title: "Data imported",
          description: `${payload.assets.length} IT asset(s) imported successfully.`,
        });
      } catch (error: any) {
        toast({
          title: "Import failed",
          description: error?.message || "Failed to import data. Please check the file format.",
          variant: "destructive",
        });
      } finally {
        if (event.target) event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleViewDetails = (asset) => {
    // Convert old string-based peripherals to new array format if needed
    const peripheralsData = Array.isArray(asset.peripherals) 
      ? asset.peripherals 
      : [];
    setSelectedAsset({
      ...asset,
      peripherals: peripheralsData
    });
    setViewDetailsDialog(true);
  };

  const handlePrintAsset = (asset) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    const peripherals = Array.isArray(asset.peripherals) ? asset.peripherals : [];
    const peripheralStats: { [key: string]: number } = {};
    peripherals.forEach((p: any) => {
      peripheralStats[p.product_type] = (peripheralStats[p.product_type] || 0) + (parseInt(p.quantity) || 0);
    });
    const totalPeripherals = Object.values(peripheralStats).reduce((s, v) => s + v, 0);
    const summaryHtml = Object.keys(peripheralStats).length
      ? `<div style="margin-top:10px;padding:10px;background:#f0f9ff;border-left:4px solid #0284c7;border-radius:4px;"><strong>Peripherals Summary:</strong><br/>${Object.entries(peripheralStats).map(([t, c]) => `${t} Total: ${c}`).join('<br/>')}<br/><strong>Total Peripherals: ${totalPeripherals}</strong></div>`
      : '';
    const peripheralsHtml = peripherals.length
      ? `<div class="section"><h3>Peripherals</h3><table class="periph"><thead><tr><th>Product</th><th>Qty</th><th>Exchange Date</th></tr></thead><tbody>${peripherals.map((p: any) => `<tr><td>${p.product_type || '-'}</td><td style="text-align:center">${p.quantity || '-'}</td><td>${p.exchange_date ? new Date(p.exchange_date).toLocaleDateString() : '-'}</td></tr>`).join('')}</tbody></table>${summaryHtml}</div>`
      : '';
    const field = (label: string, value: any) => `<div class="item"><div class="item-label">${label}</div><div class="item-value">${value || '-'}</div></div>`;
    const banner = buildProfileBanner(asset);
    const initials = (asset.employee_name || '?').split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase();
    const printedOn = new Date().toLocaleString();
    const styles = `
      @page{size:A4;margin:8mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:10.5px;line-height:1.4;padding:0 10px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      ${PROFILE_BANNER_CSS}
      .id-card{margin:10px 0 12px;border:1px solid #bae6fd;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(2,132,199,.08)}
      .id-card-top{background:linear-gradient(135deg,#0c4a6e 0%,#0284c7 55%,#06b6d4 100%);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:14px}
      .avatar{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;letter-spacing:.5px;flex-shrink:0}
      .id-name-block{flex:1;min-width:0}
      .name{font-size:18px;font-weight:800;line-height:1.15;letter-spacing:.2px}
      .designation{font-size:11px;opacity:.9;margin-top:2px;font-weight:500}
      .badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
      .badge{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:999px;letter-spacing:.3px}
      .id-meta{text-align:right;font-size:10px;line-height:1.35}
      .id-meta .k{opacity:.75;font-size:8.5px;text-transform:uppercase;letter-spacing:.5px}
      .id-meta .v{font-family:'Consolas',monospace;font-weight:700;font-size:11px}
      .row-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .section{margin-top:10px;break-inside:avoid;page-break-inside:avoid;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden;background:#fff}
      .section > h3{color:#fff;background:linear-gradient(90deg,#0284c7,#0ea5e9);padding:5px 10px;margin:0;font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;display:flex;align-items:center;gap:6px}
      .section > .body{padding:7px 8px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
      .grid-2{grid-template-columns:repeat(2,1fr)}
      .item{background:#f8fafc;padding:5px 9px;border-left:3px solid #0284c7;border-radius:4px;min-height:34px}
      .item-label{font-size:8.5px;color:#0369a1;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
      .item-value{font-size:11px;color:#0f172a;margin-top:1px;font-weight:600;word-break:break-word}
      .section.security > h3{background:linear-gradient(90deg,#059669,#10b981)}
      .section.security .item{border-left-color:#059669}
      .section.security .item-label{color:#065f46}
      .section.device > h3{background:linear-gradient(90deg,#4f46e5,#6366f1)}
      .section.device .item{border-left-color:#4f46e5}
      .section.device .item-label{color:#3730a3}
      .section.remarks > h3{background:linear-gradient(90deg,#b45309,#f59e0b)}
      .periph{width:100%;border-collapse:collapse;font-size:10px}
      .periph th{background:#0284c7;color:#fff;padding:5px 6px;text-align:left;font-weight:600}
      .periph td{padding:4px 6px;border-bottom:1px solid #e2e8f0}
      .periph tr:nth-child(even) td{background:#f8fafc}
      .footer-note{padding:6px 10px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:4px;font-size:10.5px;color:#78350f}
      .foot{margin-top:14px;padding-top:6px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:9px;color:#64748b}
      .signatures{margin-top:20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
      .sig{border-top:1px solid #475569;padding-top:4px;text-align:center;font-size:10px;color:#334155;font-weight:600}
    `;
    const content = `<!DOCTYPE html><html><head><title>IT Asset - ${asset.employee_name || ''}</title><style>${styles}</style></head><body>
      ${banner}
      <div class="id-card">
        <div class="id-card-top">
          <div class="avatar">${initials}</div>
          <div class="id-name-block">
            <div class="name">${asset.employee_name || '-'}</div>
            <div class="designation">${asset.designation || '-'}</div>
            <div class="badges">
              ${asset.division ? `<span class="badge">🏷 ${asset.division}</span>` : ''}
              ${asset.unit_office ? `<span class="badge">🏢 ${asset.unit_office}</span>` : ''}
              ${asset.device_type ? `<span class="badge">💻 ${String(asset.device_type).toUpperCase()}</span>` : ''}
            </div>
          </div>
          <div class="id-meta">
            <div class="k">PC No</div>
            <div class="v">${asset.pc_no || '-'}</div>
            <div class="k" style="margin-top:4px">DP / LP No</div>
            <div class="v">${asset.dp_lp_no || '-'}</div>
          </div>
        </div>
      </div>

      <div class="section"><h3>👤 Personal & Contact</h3><div class="body"><div class="grid">
        ${field('Email', asset.email)}
        ${field('Mobile', asset.mobile)}
        ${field('Department', asset.division)}
        ${field('Unit / Office', asset.unit_office)}
      </div></div></div>

      <div class="section device"><h3>💻 Device Information</h3><div class="body"><div class="grid">
        ${field('PC No', asset.pc_no)}
        ${field('Serial No', asset.sl_no)}
        ${field('DP / LP No', asset.dp_lp_no)}
        ${field('Device Type', asset.device_type)}
        ${field('IP Address', asset.ip_no)}
        ${field('Windows Version', asset.windows_version)}
        ${field('Boot Partition', asset.boot_partition)}
        ${field('Purchase Date', asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '')}
        ${field('Printer', asset.printer)}
        ${field('Scanner', asset.scanner)}
        ${field('Specification', asset.specification)}
      </div>
      </div></div>

      <div class="section security"><h3>🔐 Remote Access & Security</h3><div class="body"><div class="grid">
        ${field('UltraViewer ID', asset.ultraview_id)}
        ${field('AnyDesk ID', asset.anydesk_id)}
        ${field('IP Address', asset.ip_no)}
        ${field('Antivirus Code', asset.antivirus_code)}
        ${field('Antivirus Validity', asset.antivirus_validity ? new Date(asset.antivirus_validity).toLocaleDateString() : '')}
        ${field('Boot Partition', asset.boot_partition)}
      </div></div></div>

      ${peripheralsHtml}
      ${asset.remarks ? `<div class="section remarks"><h3>📝 Remarks</h3><div class="body"><div class="footer-note">${asset.remarks}</div></div></div>` : ''}

      <div class="signatures">
        <div class="sig">User Signature</div>
        <div class="sig">IT Officer</div>
        <div class="sig">Authorized By</div>
      </div>
      <div class="foot">
        <div>IT Asset Profile · Confidential</div>
        <div>Printed: ${printedOn}</div>
      </div>
    </body></html>`;
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  const handlePictureUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          setFormData({ ...formData, picture: result });
          toast({
            title: "Picture uploaded",
            description: "User picture has been uploaded successfully.",
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePicture = () => {
    setFormData({ ...formData, picture: "" });
    toast({
      title: "Picture deleted",
      description: "User picture has been deleted successfully.",
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode } 
      });
      setCameraStream(stream);
      setShowCameraDialog(true);
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraDialog(false);
  };

  const capturePhoto = () => {
    const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
    if (!videoElement) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(videoElement, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg');
    setFormData({ ...formData, picture: imageData });
    stopCamera();
    toast({
      title: "Photo captured",
      description: "User photo has been captured successfully.",
    });
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);
    if (cameraStream) {
      stopCamera();
      setTimeout(() => {
        setFacingMode(newFacingMode);
        startCamera();
      }, 100);
    }
  };

  const handlePrintOverview = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataToUse = filteredAccessories;
    const escapeHtml = (value: unknown) =>
      String(value ?? '-').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]);
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    // Get stats
    const totalAssets = dataToUse.length;
    const laptopCount = dataToUse.filter(a => a.device_type?.toLowerCase() === 'laptop').length;
    const desktopCount = dataToUse.filter(a => a.device_type?.toLowerCase() === 'desktop').length;
    const activeCount = dataToUse.filter(a => !a.remarks?.toLowerCase().includes('repair')).length;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>IT Assets Overview - MNR Group IT</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          @media print {
            html, body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
            color: white;
            padding: 25px 30px;
            border-radius: 16px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
          }
          .header-title {
            font-size: 28px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .header-subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 4px;
          }
          .header-date {
            text-align: right;
            font-size: 13px;
            opacity: 0.9;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 25px;
          }
          .stat-card {
            background: white;
            border-radius: 14px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            border: 1px solid rgba(0,0,0,0.05);
          }
          .stat-card.blue { border-left: 4px solid #3b82f6; }
          .stat-card.purple { border-left: 4px solid #8b5cf6; }
          .stat-card.green { border-left: 4px solid #10b981; }
          .stat-card.orange { border-left: 4px solid #f59e0b; }
          .stat-value {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .stat-card.blue .stat-value { color: #3b82f6; }
          .stat-card.purple .stat-value { color: #8b5cf6; }
          .stat-card.green .stat-value { color: #10b981; }
          .stat-card.orange .stat-value { color: #f59e0b; }
          .stat-label {
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
          }
          .table-container {
            background: white;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          }
          .table-header {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            padding: 16px 20px;
            font-size: 16px;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            background: #f1f5f9;
            padding: 12px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e2e8f0;
          }
          td {
            padding: 12px 16px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 12px;
            color: #334155;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          tr:hover {
            background: #f0f9ff;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .badge-laptop {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
          }
          .badge-desktop {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
          }
          .footer {
            margin-top: 25px;
            text-align: center;
            color: #64748b;
            font-size: 12px;
            padding: 15px;
            border-top: 1px solid #e2e8f0;
          }
          .no-print {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
          }
          .no-print:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
        
        <div class="header">
          <div>
            <div class="header-title">MNR Group IT</div>
            <div class="header-subtitle">IT Assets Overview Report</div>
          </div>
          <div class="header-date">
            Generated: ${currentDate}<br/>
            ${filterUnit !== 'all' ? 'Unit: ' + filterUnit : 'All Units'}
            ${filterDepartment !== 'all' ? ' | Dept: ' + filterDepartment : ''}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-value">${totalAssets}</div>
            <div class="stat-label">Total Assets</div>
          </div>
          <div class="stat-card purple">
            <div class="stat-value">${laptopCount}</div>
            <div class="stat-label">Laptops</div>
          </div>
          <div class="stat-card green">
            <div class="stat-value">${desktopCount}</div>
            <div class="stat-label">Desktops</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-value">${activeCount}</div>
            <div class="stat-label">Active</div>
          </div>
        </div>

        <div class="table-container">
          <div class="table-header">📊 IT Assets List (${totalAssets} items)</div>
          <table>
            <thead>
              <tr>
                <th>SL</th>
                <th>Employee</th>
                <th>PC No</th>
                <th>Device Type</th>
                <th>Contact</th>
                <th>IP Address</th>
                <th>Antivirus Validity</th>
              </tr>
            </thead>
            <tbody>
              ${dataToUse.map((asset, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${asset.employee_name || '-'}</strong><br/>${asset.designation || '-'}<br/><span style="color:#2563eb;font-weight:600">${asset.division || asset.department || '-'}</span><br/>${asset.unit_office || '-'}</td>
                  <td>${asset.pc_no || '-'}</td>
                  <td><span class="badge badge-${asset.device_type?.toLowerCase() || 'laptop'}">${asset.device_type || '-'}</span></td>
                  <td>Email: ${escapeHtml(asset.email)}<br/>Email Password: ${escapeHtml(asset.email_password)}<br/>Phone: ${escapeHtml(asset.mobile)}</td>
                  <td>${asset.ip_no || '-'}</td>
                  <td>${asset.antivirus_validity ? new Date(asset.antivirus_validity).toLocaleDateString('en-GB') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          © ${new Date().getFullYear()} MNR Group IT Department. All rights reserved.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="w-full p-3 sm:p-6 space-y-6 sm:space-y-8 bg-background text-foreground min-h-screen">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="border-2 border-primary/50 text-primary bg-transparent hover:bg-primary/10 hover:text-primary hover:border-primary hover:ring-2 hover:ring-primary/20 transition-all"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-3xl font-bold text-primary truncate">IT Assets</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintOverview}
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Printer className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <PermGate action="add">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
              className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add IT Asset</span>
            </Button>
          </PermGate>
        </div>
      </div>

      <Card className="bg-card border-2 border-primary/40 shadow-none">
        <CardHeader className="pb-3">
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="w-full sm:w-80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search IT assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 border-border focus-visible:ring-primary/40"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[12rem] sm:max-w-[20rem]">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className={`w-full border-border focus:ring-primary/40 [&>span]:truncate ${filterCategory !== 'all' ? 'pr-9' : ''}`}>
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="laptops">Laptops</SelectItem>
                <SelectItem value="desktops">Desktops</SelectItem>
                <SelectItem value="in_repair">In Repair</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired_antivirus">Expired Antivirus</SelectItem>
                </SelectContent>
              </Select>
              {filterCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterCategory('all')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 bg-background rounded"
                  title="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[12rem] sm:max-w-[20rem]">
              <Select value={filterUnit} onValueChange={(v) => { setFilterUnit(v); setFilterDepartment("all"); }}>
                <SelectTrigger className={`w-full border-border focus:ring-primary/40 [&>span]:truncate ${filterUnit !== 'all' ? 'pr-9' : ''}`}>
                  <SelectValue placeholder="Filter by Unit/Office" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Units/Offices</SelectItem>
                {units.map(unit => (
                  <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>
                ))}
                </SelectContent>
              </Select>
              {filterUnit !== 'all' && (
                <button
                  type="button"
                  onClick={() => { setFilterUnit('all'); setFilterDepartment('all'); }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 bg-background rounded"
                  title="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[12rem] sm:max-w-[20rem]">
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className={`w-full border-border focus:ring-primary/40 [&>span]:truncate ${filterDepartment !== 'all' ? 'pr-9' : ''}`}>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {(() => {
                  const filtered = departments.filter((dept: any) => filterUnit === "all" || dept.unit === filterUnit);
                  const seen = new Set<string>();
                  const unique = filtered.filter((dept: any) => {
                    const key = (dept.name || "").trim().toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return unique
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ));
                })()}
                </SelectContent>
              </Select>
              {filterDepartment !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterDepartment('all')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 bg-background rounded"
                  title="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[12rem] sm:max-w-[20rem]">
              <Select value={filterAntivirus} onValueChange={setFilterAntivirus}>
                <SelectTrigger className={`w-full border-border focus:ring-primary/40 [&>span]:truncate ${filterAntivirus !== 'all' ? 'pr-9' : ''}`}>
                  <SelectValue placeholder="Filter by Antivirus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Antivirus</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              {filterAntivirus !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterAntivirus('all')}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 bg-background rounded"
                  title="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {(searchTerm || filterCategory !== "all" || filterUnit !== "all" || filterDepartment !== "all" || filterAntivirus !== "all") && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => { setSearchTerm(""); setFilterCategory("all"); setFilterUnit("all"); setFilterDepartment("all"); setFilterAntivirus("all"); }}
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                title="Clear filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleExportData}
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={() => document.getElementById('import-file').click()}
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </div>
          </div>

          <div className="rounded-2xl border-2 border-primary/40 overflow-x-auto shadow-lg shadow-primary/10">
            <Table className="min-w-[1100px] border-collapse [&_th]:border [&_th]:border-primary/30 [&_td]:border [&_td]:border-border">
              <TableHeader>
                <TableRow className="!bg-primary/5 hover:!bg-primary/10 border-b-2 border-primary/50">
                  <TableHead className="text-foreground font-bold tracking-wider text-[10px] sm:text-[11px] text-center w-8 sm:w-12 h-11 px-1 sm:px-2">SL</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[10px] sm:text-[11px] text-center w-14 sm:w-24 px-1 sm:px-2">PC No</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[10px] sm:text-[11px] text-center w-14 sm:w-24 px-1 sm:px-2">DP / LP No</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[11px]">Employee</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[11px]">Contact</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[11px]">Remote Access</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[11px]">Antivirus</TableHead>
                  <TableHead className="text-foreground font-bold tracking-wider text-[11px] text-center w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:capitalize">
                {filteredAccessories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No IT assets found
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    return filteredAccessories.map((accessory, idx) => {
                    const devicePrefix = accessory.device_type === 'laptop' ? 'LP' : accessory.device_type === 'desktop' ? 'DP' : '';
                    const deviceColor = accessory.device_type === 'laptop' ? 'text-white bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-800 shadow-md shadow-emerald-500/30' : accessory.device_type === 'desktop' ? 'text-white bg-gradient-to-br from-blue-500 to-blue-700 border-blue-800 shadow-md shadow-blue-500/30' : 'text-muted-foreground bg-gray-100 border-gray-300';
                    const initials = (accessory.employee_name || '?').split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase();
                    const antivirusExpired = isAntivirusExpired(accessory.antivirus_validity);
                    return (
                    <TableRow key={accessory.id} className="group transition-colors odd:bg-primary/[0.035] even:bg-muted/30 hover:bg-primary/[0.08]">
                      <TableCell className="text-center align-middle py-3 px-1 sm:px-2">
                         <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-foreground text-[11px] sm:text-xs font-bold">{(accessory as any).__sl ?? idx + 1}</span>
                      </TableCell>
                      <TableCell className="align-middle py-3 text-center px-1 sm:px-2">
                        {accessory.pc_no ? (
                          <button
                            type="button"
                            onClick={() => handleViewDetails(accessory)}
                            className="inline-block font-mono text-[11px] sm:text-sm font-black text-primary hover:opacity-80 hover:underline tracking-wider cursor-pointer transition-colors break-all"
                            title="Open employee profile"
                          >
                            {accessory.pc_no}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-middle py-3 text-center px-1 sm:px-2">
                        {devicePrefix ? (
                          <span className="inline-block font-mono text-[11px] sm:text-sm font-black text-foreground tracking-wider break-all">
                            {accessory.dp_lp_no || `${devicePrefix}-${accessory.pc_no || '—'}`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                       <TableCell className="align-middle py-3">
                         <div className="flex items-center gap-2.5">
                           {accessory.picture && (
                             <img src={accessory.picture} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" />
                           )}
                           <div className="min-w-0">
                             <button
                               type="button"
                               onClick={() => handleViewDetails(accessory)}
                               className="font-semibold text-primary hover:opacity-80 hover:underline text-sm truncate text-left cursor-pointer transition-colors"
                               title="Open employee profile"
                             >
                               {accessory.employee_name}
                             </button>
                            {accessory.designation && (
                              <div className="text-[11px] text-muted-foreground truncate">{accessory.designation}</div>
                            )}
                            {(accessory.division || accessory.department) && (
                              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                                {accessory.division || accessory.department}
                              </div>
                            )}
                            {accessory.unit_office && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {accessory.unit_office}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle py-3 normal-case">
                        <div className="flex flex-col gap-1 text-xs normal-case">
                          <div className="break-all">
                            <span className="font-semibold text-muted-foreground">Email: </span>
                            {accessory.email ? (
                              <button type="button" onClick={() => copyToClipboard(accessory.email, 'Email')} className="text-left hover:text-primary hover:underline break-all">
                                {accessory.email}
                              </button>
                            ) : '—'}
                          </div>
                          <div className="break-all">
                            <span className="font-semibold text-muted-foreground">Email Password: </span>
                            {accessory.email_password ? (
                              <button type="button" onClick={() => copyToClipboard(accessory.email_password, 'Email password')} className="text-left hover:text-primary hover:underline break-all">
                                {accessory.email_password}
                              </button>
                            ) : '—'}
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground">Phone: </span>
                            {(accessory.mobile || accessory.phone_no) ? (
                              <button type="button" onClick={() => copyToClipboard(accessory.mobile || accessory.phone_no, 'Phone number')} className="text-left hover:text-primary hover:underline">
                                {accessory.mobile || accessory.phone_no}
                              </button>
                            ) : '—'}
                          </div>
                        </div>
                      </TableCell>
                       <TableCell className="align-top py-3">
                         {(() => {
                           const isValidIp = accessory.ip_no && /^\d{1,3}(\.\d{1,3}){3}$/.test(String(accessory.ip_no).trim());
                           const ipValue = isValidIp ? String(accessory.ip_no).trim() : '';
                           const anydesk = accessory.anydesk_id ? String(accessory.anydesk_id).trim() : '';
                           const ultraview = accessory.ultraview_id ? String(accessory.ultraview_id).trim() : '';
                            const copyOpen = (value: string, url: string, label: string) => {
                              navigator.clipboard.writeText(value).catch(() => {});
                              try {
                                // Custom protocols (tightvnc://, anydesk://...) throw on window.open
                                // in some browsers — use a temporary anchor click instead.
                                const a = document.createElement('a');
                                a.href = url;
                                a.style.display = 'none';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                              } catch { /* protocol handler not installed */ }
                              toast({ title: `${label} Copied`, description: `${value} copied to clipboard` });
                            };
                           return (
                             <div className="flex flex-col gap-1 text-xs">
                               <button
                                 type="button"
                                 disabled={!ipValue}
                                 onClick={() => ipValue && copyOpen(ipValue, `tightvnc://${ipValue}`, 'IP')}
                                 className="flex items-center gap-1.5 text-left text-primary hover:opacity-80 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                 title={ipValue ? 'Copy IP & open TightVNC' : 'No IP'}
                               >
                                 <Network className="h-3.5 w-3.5 text-primary" />
                                 <span className="font-mono">{ipValue || '-'}</span>
                               </button>
                               <button
                                 type="button"
                                 disabled={!anydesk}
                                 onClick={() => anydesk && copyOpen(anydesk, `anydesk:${anydesk}`, 'AnyDesk')}
                                 className="flex items-center gap-1.5 text-left text-red-600 hover:text-red-800 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                 title={anydesk ? 'Copy AnyDesk & open' : 'No AnyDesk'}
                               >
                                 <Monitor className="h-3.5 w-3.5" />
                                 <span className="font-mono">{anydesk || '-'}</span>
                               </button>
                               <button
                                 type="button"
                                 disabled={!ultraview}
                                 onClick={() => ultraview && copyOpen(ultraview, `ultraviewer://connect?id=${ultraview}`, 'UltraViewer')}
                                 className="flex items-center gap-1.5 text-left text-purple-600 hover:text-purple-800 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                 title={ultraview ? 'Copy UltraViewer & open' : 'No UltraViewer'}
                               >
                                 <Eye className="h-3.5 w-3.5" />
                                 <span className="font-mono">{ultraview || '-'}</span>
                               </button>
                             </div>
                           );
                         })()}
                       </TableCell>
                       <TableCell className="align-middle py-3">
                         <div className="text-sm">
                           {accessory.antivirus_code ? (
                             <button
                               type="button"
                               onClick={() => {
                                 navigator.clipboard.writeText(accessory.antivirus_code);
                                 toast({ title: 'Antivirus Key Copied', description: accessory.antivirus_code });
                               }}
                                className={`font-mono text-xs font-semibold ${antivirusExpired ? 'text-red-600 dark:text-red-400' : 'text-foreground'} hover:opacity-80 px-2 py-1 transition-colors`}
                               title="Click to copy"
                             >
                               {accessory.antivirus_code}
                             </button>
                           ) : (
                             <span className="text-muted-foreground">—</span>
                           )}
                           {accessory.antivirus_validity && (
                             <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                               <Calendar className="h-3 w-3" />
                               {new Date(accessory.antivirus_validity).toLocaleDateString()}
                             </div>
                           )}
                         </div>
                       </TableCell>
                      <TableCell className="align-middle py-3 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-primary/30 hover:bg-primary/10 hover:border-primary/60 shadow-sm rounded-full transition-all group-hover:scale-110">
                              <MoreVertical className="h-4 w-4 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleViewDetails(accessory)}>
                              <Eye className="h-4 w-4 mr-2 text-blue-600" /> View
                            </DropdownMenuItem>
                            <PermGate action="edit">
                              <DropdownMenuItem onClick={() => handleEdit(accessory)}>
                                <Edit className="h-4 w-4 mr-2 text-primary" /> Edit
                              </DropdownMenuItem>
                            </PermGate>
                            <DropdownMenuItem onClick={() => handlePrintAsset(accessory)}>
                              <Printer className="h-4 w-4 mr-2 text-emerald-600" /> Print
                            </DropdownMenuItem>
                            <PermGate action="delete">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(accessory.id)}
                                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </PermGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );});
                  })()
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* IT Asset Form Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(v) => {
          setIsDialogOpen(v);
          if (!v) {
            editHandledRef.current = null;
            goBackToOrigin();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-2 border-primary shadow-2xl shadow-primary/20 rounded-2xl bg-gradient-to-br from-background via-background to-primary/5">
          <DialogHeader className="pb-4 border-b-2 border-primary/30 -mx-6 px-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-t-2xl">
            <DialogTitle className="text-primary text-2xl font-bold flex items-center gap-2">
              <Monitor className="h-6 w-6" />
              {editingAccessory ? "Edit IT Asset" : "Add New IT Asset"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingAccessory ? "Update IT asset information" : "Enter the details for the new IT asset"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Employee Information */}
              <div className="md:col-span-2 lg:col-span-3">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Employee Information
                </h3>
              </div>

              <div>
                <Label htmlFor="employee_name">Employee Name *</Label>
                <Input
                  id="employee_name"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  required
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="designation">Designation *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>

              <div>
                <Label htmlFor="id_no">ID No</Label>
                <Input
                  id="id_no"
                  value={(formData as any).id_no || ""}
                  onChange={(e) => setFormData({ ...formData, id_no: e.target.value } as any)}
                  placeholder="Employee ID No"
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>

              <div>
                <Label htmlFor="email_password">Email Password</Label>
                <Input
                  id="email_password"
                  type="text"
                  value={formData.email_password}
                  onChange={(e) => setFormData({ ...formData, email_password: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="division">Department/Division *</Label>
                <Select
                  value={formData.division}
                  onValueChange={(value) => setFormData({ ...formData, division: value })}
                  disabled={!formData.unit_office}
                >
                  <SelectTrigger className="border-border focus:ring-primary/40">
                    <SelectValue placeholder={formData.unit_office ? "Select department" : "Select unit/office first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments
                      .filter((d: any) => d.unit === formData.unit_office)
                      .map((d: any) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="unit_office">Unit/Office *</Label>
                <Select
                  value={formData.unit_office}
                  onValueChange={(value) =>
                    setFormData({ ...formData, unit_office: value, division: "" })
                  }
                >
                  <SelectTrigger className="border-border focus:ring-primary/40">
                    <SelectValue placeholder="Select unit/office" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device Information */}
              <div className="md:col-span-2 lg:col-span-3 mt-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Device Information
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="device_type">Device Type *</Label>
                  <Select
                  value={formData.device_type}
                  onValueChange={(value) => {
                    setFormData((prev: any) => {
                      const prefix = value === 'laptop' ? 'LP' : value === 'desktop' ? 'DP' : value === 'ip_phone' ? 'IP' : '';
                      let nextDpLp = prev.dp_lp_no;
                      // Auto-generate for new asset, or when field is empty on edit
                      const shouldAuto = !editingAccessory || !prev.dp_lp_no;
                      if (shouldAuto && prefix) {
                        const nums = accessories
                          .filter((a: any) => (a.device_type || '').toString().toLowerCase() === value && a.id !== editingAccessory?.id)
                          .map((a: any) => {
                            const s = (a.dp_lp_no || '').toString();
                            const m = s.match(/(\d+)\s*$/);
                            return m ? parseInt(m[1], 10) : 0;
                          });
                        const next = (nums.length ? Math.max(...nums) : 0) + 1;
                        nextDpLp = `${prefix}-${String(next).padStart(2, '0')}`;
                      } else if (shouldAuto && !prefix) {
                        nextDpLp = "";
                      }
                      return { ...prev, device_type: value, dp_lp_no: nextDpLp };
                    });
                  }}
                >
                  <SelectTrigger className="border-border focus:ring-primary/40">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
                <div>
                  <Label htmlFor="dp_lp_no">
                    {formData.device_type === 'laptop' ? 'LP No' : formData.device_type === 'desktop' ? 'DP No' : 'DP / LP No'}
                  </Label>
                  <Input
                    id="dp_lp_no"
                    value={formData.dp_lp_no || ''}
                    onChange={(e) => setFormData({ ...formData, dp_lp_no: e.target.value })}
                    placeholder={formData.device_type ? 'Auto-generated' : 'Select device type first'}
                    className="border-border focus-visible:ring-primary/40 font-mono"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="pc_no">PC Number *</Label>
                <Input
                  id="pc_no"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.pc_no}
                  onChange={(e) => setFormData({ ...formData, pc_no: e.target.value.replace(/\D/g, '') })}
                  required
                  className={`focus-visible:ring-primary/40 ${
                    formData.pc_no && accessories.some((a: any) =>
                      a.pc_no && String(a.pc_no).trim().toLowerCase() === String(formData.pc_no).trim().toLowerCase() &&
                      a.id !== editingAccessory?.id
                    ) ? 'border-red-500 focus-visible:ring-red-500' : 'border-border'
                  }`}
                />
                {formData.pc_no && accessories.some((a: any) =>
                  a.pc_no && String(a.pc_no).trim().toLowerCase() === String(formData.pc_no).trim().toLowerCase() &&
                  a.id !== editingAccessory?.id
                ) && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    This PC Number is already assigned to another asset.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="ip_no">IP Address</Label>
                <Input
                  id="ip_no"
                  value={formData.ip_no}
                  onChange={(e) => setFormData({ ...formData, ip_no: e.target.value })}
                  placeholder="192.168.1.100"
                  className={`focus-visible:ring-primary/40 ${
                    formData.ip_no && accessories.some((a: any) =>
                      a.ip_no && String(a.ip_no).trim() === String(formData.ip_no).trim() &&
                      a.id !== editingAccessory?.id
                    ) ? 'border-red-500 focus-visible:ring-red-500' : 'border-border'
                  }`}
                />
                {formData.ip_no && accessories.some((a: any) =>
                  a.ip_no && String(a.ip_no).trim() === String(formData.ip_no).trim() &&
                  a.id !== editingAccessory?.id
                ) && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    This IP address is already assigned to another asset.
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="windows_version">Windows Version</Label>
                <Select value={formData.windows_version} onValueChange={(value) => setFormData({ ...formData, windows_version: value })}>
                  <SelectTrigger className="border-border focus:ring-primary/40">
                    <SelectValue placeholder="Select Windows version" />
                  </SelectTrigger>
                  <SelectContent>
                    {windowsVersions.map(version => (
                      <SelectItem key={version.value} value={version.value}>{version.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="md:col-span-2 lg:col-span-3">
                <Label htmlFor="specification">Specification</Label>
                <Textarea
                  id="specification"
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  placeholder="Hardware specifications..."
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>

              {/* Remote Access */}
              <div className="md:col-span-2 lg:col-span-3 mt-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Remote Access
                </h3>
              </div>
              
              <div>
                <Label htmlFor="ultraview_id">UltraViewer ID</Label>
                <Input
                  id="ultraview_id"
                  value={formData.ultraview_id}
                  onChange={(e) => setFormData({ ...formData, ultraview_id: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="anydesk_id">AnyDesk ID</Label>
                <Input
                  id="anydesk_id"
                  value={formData.anydesk_id}
                  onChange={(e) => setFormData({ ...formData, anydesk_id: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>

              {/* Security Information */}
              <div className="md:col-span-2 lg:col-span-3 mt-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security & Software
                </h3>
              </div>
              
              <div>
                <Label htmlFor="antivirus_code">Antivirus Code</Label>
                <Input
                  id="antivirus_code"
                  value={formData.antivirus_code}
                  onChange={(e) => setFormData({ ...formData, antivirus_code: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="antivirus_validity">Antivirus Validity</Label>
                <Input
                  id="antivirus_validity"
                  type="date"
                  value={formData.antivirus_validity}
                  onChange={(e) => setFormData({ ...formData, antivirus_validity: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="boot_partition">Boot Partition</Label>
                <Input
                  id="boot_partition"
                  value={formData.boot_partition}
                  onChange={(e) => setFormData({ ...formData, boot_partition: e.target.value })}
                  placeholder="C: Drive, etc."
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>

              {/* Peripherals */}
              <div className="md:col-span-2 lg:col-span-3 mt-6">
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Peripherals & Others
                </h3>
              </div>
              
              <div>
                <Label htmlFor="printer">Printer</Label>
                <Input
                  id="printer"
                  value={formData.printer}
                  onChange={(e) => setFormData({ ...formData, printer: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="scanner">Scanner</Label>
                <Input
                  id="scanner"
                  value={formData.scanner}
                  onChange={(e) => setFormData({ ...formData, scanner: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              <div>
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
              
              {/* Peripherals Management */}
              <div className="md:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <Label>Peripherals Management</Label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      resetPeripheralForm();
                      setShowPeripheralDialog(true);
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Peripheral
                  </Button>
                </div>
                
                {formData.peripherals.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-primary">Total Peripherals: {getTotalPeripherals()}</p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {Object.entries(getPeripheralStats()).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between bg-white p-2 rounded">
                            <span className="font-medium capitalize">{type}:</span>
                            <Badge variant="secondary">{String(count)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-primary/5">
                            <TableHead className="text-primary">Product Type</TableHead>
                            <TableHead className="text-primary">Quantity</TableHead>
                            <TableHead className="text-primary">Exchange Date</TableHead>
                            <TableHead className="text-primary">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {formData.peripherals.map((peripheral, index) => (
                            <TableRow key={index}>
                              <TableCell className="capitalize font-medium">{peripheral.product_type}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{peripheral.quantity}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(peripheral.exchange_date).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditPeripheral(index)}
                                    className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeletePeripheral(index)}
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-dashed border-border rounded-lg text-center text-muted-foreground text-sm">
                    No peripherals added. Click "Add Peripheral" to add items.
                  </div>
                )}
              </div>
              
              <div className="md:col-span-2 lg:col-span-3">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional notes or remarks..."
                  className="border-border focus-visible:ring-primary/40"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsDialogOpen(false); goBackToOrigin(); }}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editingAccessory ? "Update User" : "Add User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Asset Details View Dialog */}
      <Dialog
        open={viewDetailsDialog}
        onOpenChange={(v) => {
          setViewDetailsDialog(v);
          if (!v && searchParams.get("profile")) {
            profileHandledRef.current = null;
            if (!goBackToOrigin()) navigate("/accessories", { replace: true });
          }
        }}
      >
        <DialogContent className="w-screen max-w-none h-screen max-h-screen top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 overflow-y-auto bg-slate-50 p-0 dark:bg-slate-950 print:block print:max-w-full print:max-h-none print:overflow-visible print:bg-white print:p-0">
          <style>{PROFILE_SCREEN_CSS}</style>
          <DialogHeader className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200 bg-background/95 px-4 py-3 pr-12 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pr-14 print:hidden">
            <div>
              <Button
                variant="outline"
                size="sm"
                className="mb-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setViewDetailsDialog(false)}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">IT Asset Profile</DialogTitle>
              <DialogDescription className="hidden text-xs text-muted-foreground sm:block">
                Employee, device and security details in one place
              </DialogDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <PermGate action="edit">
                <Button
                  variant="outline"
                  className="h-9 border-slate-300 px-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-10 sm:px-4"
                  onClick={() => {
                    if (!selectedAsset) return;
                    setViewDetailsDialog(false);
                    handleEdit(selectedAsset);
                  }}
                >
                  <Edit className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </PermGate>
              <Button
                variant="outline"
                className="h-9 border-slate-300 px-3 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:h-10 sm:px-4"
                onClick={() => selectedAsset && printIssueVoucher(selectedAsset)}
              >
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Issue Voucher</span>
              </Button>
              <Button
                onClick={() => {
                  if (!selectedAsset) return;
                  const printWindow = window.open("", "_blank", "width=900,height=700");
                  if (!printWindow) return;
                  
                  // Calculate peripherals totals for print
                  const peripheralStatsPrint: { [key: string]: number } = {};
                  if (selectedAsset.peripherals && selectedAsset.peripherals.length > 0) {
                    selectedAsset.peripherals.forEach((p: any) => {
                      if (!peripheralStatsPrint[p.product_type]) {
                        peripheralStatsPrint[p.product_type] = 0;
                      }
                      peripheralStatsPrint[p.product_type] += parseInt(p.quantity) || 0;
                    });
                  }
                  const totalPeripheralsPrint = Object.values(peripheralStatsPrint).reduce((sum, val) => sum + val, 0);
                  
                  const peripheralsSummaryPrintHtml = Object.keys(peripheralStatsPrint).length > 0 
                    ? `<div style="margin-top: 10px; padding: 10px; background: #f0f9ff; border-left: 4px solid #0284c7; border-radius: 4px;"><strong>Peripherals Summary:</strong><br/>${Object.entries(peripheralStatsPrint).map(([type, count]) => `${type} Total: ${count}`).join('<br/>')}<br/><strong style="font-size: 14px;">Total Peripherals: ${totalPeripheralsPrint}</strong></div>` 
                    : '';
                  
                  const peripheralsHtml = selectedAsset.peripherals && selectedAsset.peripherals.length > 0 
                    ? `<div style="margin-top: 15px;"><h3 style="color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 5px; margin-bottom: 10px;">Peripherals</h3><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background: #0284c7; color: white;"><th style="padding: 8px; border: 1px solid #ddd;">Product</th><th style="padding: 8px; border: 1px solid #ddd;">Qty</th><th style="padding: 8px; border: 1px solid #ddd;">Date</th></tr></thead><tbody>${selectedAsset.peripherals.map((p: any) => `<tr><td style="padding: 8px; border: 1px solid #ddd;">${p.product_type}</td><td style="padding: 8px; border: 1px solid #ddd;">${p.quantity}</td><td style="padding: 8px; border: 1px solid #ddd;">${p.exchange_date ? new Date(p.exchange_date).toLocaleDateString() : '-'}</td></tr>`).join('')}</tbody></table>${peripheralsSummaryPrintHtml}</div>` 
                    : '';
                  
                  const bannerHtml = buildProfileBanner(selectedAsset);
                  const content = `<!DOCTYPE html>
                    <html>
                      <head>
                        <title>IT Asset Profile - ${selectedAsset.employee_name}</title>
                        <style>
                          @page { size: A4; margin: 10mm; }
                          ${PROFILE_BANNER_CSS}
                          body { margin: 0; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; }
                          .section { margin: 16px 0; }
                          .section h3 { margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #dbe5ef; color: #075985; font-size: 12px; letter-spacing: .6px; text-transform: uppercase; }
                          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
                          .item { min-width: 0; padding: 9px 11px; border: 1px solid #e2e8f0; border-left: 3px solid #38bdf8; border-radius: 8px; background: #f8fafc; }
                          .item-label { color: #64748b; font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
                          .item-value { margin-top: 3px; color: #172033; font-size: 12px; overflow-wrap: anywhere; }
                        </style>
                      </head>
                      <body>
                        ${bannerHtml}
                        <div class="section">
                          <h3>Personal Information</h3>
                          <div class="grid">
                            <div class="item"><div class="item-label">Email</div><div class="item-value">${selectedAsset.email || '-'}</div></div>
                            <div class="item"><div class="item-label">Mobile</div><div class="item-value">${selectedAsset.mobile || '-'}</div></div>
                            <div class="item"><div class="item-label">Department</div><div class="item-value">${selectedAsset.division || selectedAsset.department || '-'}</div></div>
                            <div class="item"><div class="item-label">Unit / Office</div><div class="item-value">${selectedAsset.unit_office || '-'}</div></div>
                          </div>
                        </div>
                        <div class="section">
                          <h3>Device Information</h3>
                          <div class="grid">
                            <div class="item"><div class="item-label">PC No</div><div class="item-value">${selectedAsset.pc_no || '-'}</div></div>
                            <div class="item"><div class="item-label">Serial No</div><div class="item-value">${selectedAsset.sl_no || '-'}</div></div>
                            <div class="item"><div class="item-label">Device Type</div><div class="item-value">${selectedAsset.device_type || '-'}</div></div>
                            <div class="item"><div class="item-label">IP Address</div><div class="item-value">${selectedAsset.ip_no || '-'}</div></div>
                            <div class="item"><div class="item-label">Windows</div><div class="item-value">${selectedAsset.windows_version || '-'}</div></div>
                            <div class="item"><div class="item-label">Specification</div><div class="item-value">${selectedAsset.specification || '-'}</div></div>
                          </div>
                        </div>
                        <div class="section">
                          <h3>Remote Access</h3>
                          <div class="grid">
                            <div class="item"><div class="item-label">UltraViewer ID</div><div class="item-value">${selectedAsset.ultraview_id || '-'}</div></div>
                            <div class="item"><div class="item-label">AnyDesk ID</div><div class="item-value">${selectedAsset.anydesk_id || '-'}</div></div>
                          </div>
                        </div>
                        <div class="section">
                          <h3>Security</h3>
                          <div class="grid">
                            <div class="item"><div class="item-label">Antivirus Code</div><div class="item-value">${selectedAsset.antivirus_code || '-'}</div></div>
                            <div class="item"><div class="item-label">Validity</div><div class="item-value">${selectedAsset.antivirus_validity || '-'}</div></div>
                            <div class="item"><div class="item-label">Printer</div><div class="item-value">${selectedAsset.printer || '-'}</div></div>
                            <div class="item"><div class="item-label">Scanner</div><div class="item-value">${selectedAsset.scanner || '-'}</div></div>
                          </div>
                        </div>
                        ${peripheralsHtml}
                      </body>
                    </html>`;
                  
                  const printStyles = `
                    @page { size: A4 portrait; margin: 0; }
                    :root { color-scheme: light; }
                    *, *::before, *::after { box-sizing: border-box; }
                    html { width: 100%; min-width: 0; margin: 0 !important; background: #fff; }
                    body { width: auto; min-width: 0; max-width: 100%; margin: 0 !important; padding: 9mm !important; overflow-x: hidden; background: #fff; color: #172033; font-family: "Segoe UI", Arial, sans-serif; font-size: 9.5pt; line-height: 1.45; -webkit-font-smoothing: antialiased; }
                    img, table { max-width: 100%; }
                    .profile-banner { width: 100%; max-width: 100%; padding: 19px 23px 22px; border-radius: 14px; box-shadow: 0 8px 24px rgba(3, 105, 161, .15); print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    .profile-banner .pb-brand img { height: 38px; }
                    .profile-banner .pb-brand h1 { font-size: 17px; }
                    .profile-banner .pb-brand p { font-size: 8px; }
                    .profile-banner .pb-title { margin-top: 18px; font-size: 9px; }
                    .profile-banner .pb-crumbs { gap: 7px; margin-top: 9px; }
                    .profile-banner .pb-chip { padding: 4px 8px; font-size: 8px; }
                    .profile-pic { width: 92px; height: 92px; margin: -42px auto 9px; border: 4px solid #fff; box-shadow: 0 4px 14px rgba(15,23,42,.15); }
                    .name { color: #0f172a; font-size: 21px; line-height: 1.2; letter-spacing: -.35px; }
                    .designation { margin: 4px 0 18px; color: #64748b; font-size: 9.5pt; }
                    .section { margin: 0 0 13px; padding: 12px 14px; border: 1px solid #dbe5ef; border-radius: 12px; background: #fff; break-inside: avoid; }
                    .section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 9px; padding: 0 0 7px; border-bottom: 1px solid #dbe5ef; color: #075985; font-size: 9pt; font-weight: 750; letter-spacing: .65px; }
                    .section h3::before { content: ""; width: 3px; height: 13px; border-radius: 3px; background: #0ea5e9; }
                    .grid { width: 100%; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
                    .item { min-width: 0; padding: 8px 10px; border: 1px solid #e2e8f0; border-left: 3px solid #38bdf8; border-radius: 8px; background: #f8fafc; }
                    .item-label { color: #64748b; font-size: 7.5pt; letter-spacing: .55px; }
                    .item-value { overflow-wrap: anywhere; color: #172033; font-size: 9pt; font-weight: 550; }
                    .section table { width: 100%; overflow: hidden; border: 1px solid #dbe5ef; border-collapse: separate; border-spacing: 0; border-radius: 8px; }
                    .section th, .section td { padding: 7px 9px !important; border: 0 !important; border-bottom: 1px solid #e2e8f0 !important; text-align: left; }
                    .section th { background: #eaf5fc !important; color: #075985 !important; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .45px; }
                    .section tbody tr:nth-child(even) { background: #f8fafc; }
                    .section tbody tr:last-child td { border-bottom: 0 !important; }
                    @media print {
                      html, body { width: 100%; max-width: 100%; }
                      body { padding: 9mm !important; }
                      * { box-shadow: none !important; }
                      .profile-banner { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                      .section, .item, tr { break-inside: avoid; }
                    }
                  `;
                  const printContent = content
                    .replace(/<title>.*?<\/title>/, "<title></title>")
                    .replace("</style>", `${printStyles}</style>`);

                  printWindow.document.open();
                  printWindow.document.write(printContent);
                  printWindow.document.close();
                  printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
                }}
                className="h-9 bg-sky-600 px-3 text-white hover:bg-sky-700 sm:h-10 sm:px-4"
              >
                <Printer className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Print</span>
              </Button>
            </div>
          </DialogHeader>
          {selectedAsset && (
            <div id="asset-profile" className="print-container w-full px-3 py-5 sm:px-6 sm:py-8">
              {/* Profile Banner (screen + print) */}
              <div className="profile-hero mb-5 sm:mb-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR Group" className="h-11 w-11 rounded-xl border border-white/20 bg-white p-1 object-contain shadow-lg sm:h-12 sm:w-12" />
                    <div>
                      <div className="text-sm font-bold tracking-wide sm:text-base">MNR Group</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/80">IT Asset Profile</div>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-sky-50 backdrop-blur">
                    {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/30 bg-white/15 text-xl font-bold text-white shadow-xl">
                      {selectedAsset.picture ? (
                        <img src={selectedAsset.picture} alt={selectedAsset.employee_name || 'Employee'} className="h-full w-full object-cover" />
                      ) : (
                        (selectedAsset.employee_name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-bold tracking-tight sm:text-3xl">{selectedAsset.employee_name || 'Unknown User'}</h2>
                      <p className="mt-1 truncate text-sm font-medium text-sky-100">{selectedAsset.designation || 'Designation not set'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                          {selectedAsset.division || selectedAsset.department || 'Department not set'}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                          {selectedAsset.unit_office || 'Unit / Office not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {selectedAsset.device_type && (
                      <span className="rounded-lg border border-white/20 bg-slate-950/20 px-3 py-2 text-xs font-semibold capitalize text-white">
                        {selectedAsset.device_type}
                      </span>
                    )}
                    {selectedAsset.pc_no && (
                      <span className="rounded-lg border border-white/20 bg-slate-950/20 px-3 py-2 font-mono text-xs font-semibold text-white">
                        PC {selectedAsset.pc_no}
                      </span>
                    )}
                    {selectedAsset.ip_no && (
                      <span className="rounded-lg border border-white/20 bg-slate-950/20 px-3 py-2 font-mono text-xs font-semibold text-white">
                        IP {selectedAsset.ip_no}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* User Details Content */}
              <div className="mt-4 sm:mt-6">
                <div className="grid grid-cols-1 items-start gap-4 sm:gap-5 lg:grid-cols-2">
                  {/* Employee Information */}
                  <div className="profile-section print-section">
                    <h3 className="profile-section-title print-section-title">
                      Employee Information
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div
                        onClick={() => copyToClipboard(selectedAsset.email, 'Email')}
                        className="group cursor-pointer print-info-item bg-gradient-to-br from-primary/10 to-card text-foreground p-3 rounded-xl border border-primary/25 hover:border-primary/60 hover:shadow-md transition-all"
                        title="Click to copy email"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <Mail className="h-3.5 w-3.5" /> Email
                          </div>
                          <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition" />
                        </div>
                        <p className="print-info-value text-sm font-medium mt-1 break-all">{selectedAsset.email || 'N/A'}</p>
                        {selectedAsset.email_password && (
                          <div
                            className="mt-2 pt-2 border-t border-border flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <KeyRound className="h-3.5 w-3.5 text-primary" />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(selectedAsset.email_password, 'Email password')}
                              className="flex-1 text-left font-mono text-xs bg-primary/10 rounded px-2 py-1 hover:bg-primary/20 transition"
                              title="Click to copy password"
                            >
                              {showEmailPassword ? selectedAsset.email_password : '••••••••••'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowEmailPassword((v) => !v)}
                              className="p-1 rounded hover:bg-primary/20 text-primary"
                              title={showEmailPassword ? 'Hide' : 'Show'}
                            >
                              {showEmailPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div
                        onClick={() => copyToClipboard(selectedAsset.mobile, 'Mobile')}
                        className="group cursor-pointer print-info-item bg-gradient-to-br from-primary/10 to-card text-foreground p-3 rounded-xl border border-primary/25 hover:border-primary/60 hover:shadow-md transition-all"
                        title="Click to copy mobile"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <PhoneIcon className="h-3.5 w-3.5" /> Mobile
                          </div>
                          <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition" />
                        </div>
                        <p className="print-info-value text-sm font-medium mt-1">{selectedAsset.mobile || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Department</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.division || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Unit/Office</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.unit_office || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Device Information */}
                  <div className="profile-section print-section">
                    <h3 className="profile-section-title print-section-title">
                      Device Information
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Device Type</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.device_type || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">PC Number</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.pc_no || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Serial Number</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.sl_no || 'N/A'}</p>
                      </div>
                      <div 
                        className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-primary/10 transition-colors no-print"
                        onClick={() => {
                          if (selectedAsset.ip_no) {
                            navigator.clipboard.writeText(selectedAsset.ip_no).catch(() => {});
                            openAppProtocol(`tightvnc://${selectedAsset.ip_no}`);
                            toast({
                              title: "IP Copied",
                              description: `${selectedAsset.ip_no} copied and TightVNC opened`,
                            });
                          }
                        }}
                        title="Click to open TightVNC and copy IP"
                      >
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">IP Address</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.ip_no || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary hidden print:block">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">IP Address</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.ip_no || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary md:col-span-2">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Specification</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.specification || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Windows Version</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.windows_version || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                   {/* Remote Access */}
                   <div className="profile-section print-section">
                    <h3 className="profile-section-title print-section-title">
                      Remote Access
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div 
                        className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-primary/10 transition-colors no-print"
                        onClick={() => {
                          if (selectedAsset.ultraview_id) {
                            navigator.clipboard.writeText(selectedAsset.ultraview_id);
                            window.location.href = `uvnc://${selectedAsset.ultraview_id}`;
                            toast({
                              title: "UltraViewer ID Copied",
                              description: `${selectedAsset.ultraview_id} copied and UltraViewer opening`,
                            });
                          }
                        }}
                        title="Click to copy ID and open UltraViewer"
                      >
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">UltraViewer ID</p>
                        <p className="print-info-value text-sm font-medium text-primary">{selectedAsset.ultraview_id || 'N/A'}</p>
                      </div>
                      <div 
                        className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-primary/10 transition-colors no-print"
                        onClick={() => {
                          if (selectedAsset.anydesk_id) {
                            navigator.clipboard.writeText(selectedAsset.anydesk_id);
                            window.location.href = `anydesk:${selectedAsset.anydesk_id}`;
                            toast({
                              title: "AnyDesk ID Copied",
                              description: `${selectedAsset.anydesk_id} copied and AnyDesk opening`,
                            });
                          }
                        }}
                        title="Click to copy ID and open AnyDesk"
                      >
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">AnyDesk ID</p>
                        <p className="print-info-value text-sm font-medium text-primary">{selectedAsset.anydesk_id || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary hidden print:block">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">UltraViewer ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.ultraview_id || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary hidden print:block">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">AnyDesk ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.anydesk_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="print-section hidden">

                    <h3 className="print-section-title text-base sm:text-lg font-bold text-primary border-b-2 border-primary/30 pb-2 mb-3">
                      Remote Access
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div 
                        className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-primary/10 transition-colors no-print"
                        onClick={() => {
                          if (selectedAsset.ultraview_id && selectedAsset.ip_no) {
                            navigator.clipboard.writeText(selectedAsset.ip_no).catch(() => {});
                            openAppProtocol(`ultraviewer://${selectedAsset.ip_no}`);
                            toast({
                              title: "IP Copied",
                              description: `${selectedAsset.ip_no} copied and UltraViewer opened`,
                            });
                          }
                        }}
                        title="Click to open UltraViewer and copy IP"
                      >
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">UltraViewer ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.ultraview_id || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary hidden print:block">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">UltraViewer ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.ultraview_id || 'N/A'}</p>
                      </div>
                      <div 
                        className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary cursor-pointer hover:bg-primary/10 transition-colors no-print"
                        onClick={() => {
                          if (selectedAsset.anydesk_id && selectedAsset.ip_no) {
                            navigator.clipboard.writeText(selectedAsset.ip_no).catch(() => {});
                            openAppProtocol(`anydesk://${selectedAsset.ip_no}`);
                            toast({
                              title: "IP Copied",
                              description: `${selectedAsset.ip_no} copied and AnyDesk opened`,
                            });
                          }
                        }}
                        title="Click to open AnyDesk and copy IP"
                      >
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">AnyDesk ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.anydesk_id || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary hidden print:block">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">AnyDesk ID</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.anydesk_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Security & Software */}
                  <div className="profile-section print-section">
                    <h3 className="profile-section-title print-section-title">
                      Security & Software
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div
                        onClick={() => copyToClipboard(selectedAsset.antivirus_code, 'Antivirus Code')}
                        className="group cursor-pointer print-info-item bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900/40 text-slate-900 dark:text-emerald-100 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-800/70 hover:border-emerald-400 hover:shadow-md transition-all"
                        title="Click to copy antivirus code"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <Shield className="h-3.5 w-3.5" /> Antivirus Code
                          </div>
                          <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition" />
                        </div>
                        <p className="print-info-value text-sm font-mono font-medium mt-1 break-all">{selectedAsset.antivirus_code || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Antivirus Validity</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.antivirus_validity || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Boot Partition</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.boot_partition || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Peripherals & Others */}
                  <div className="profile-section print-section lg:col-span-2">
                    <h3 className="profile-section-title print-section-title">
                      Peripherals & Others
                    </h3>
                    <div className="print-info-grid grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Printer</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.printer || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Scanner</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.scanner || 'N/A'}</p>
                      </div>
                      <div className="print-info-item bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground">Purchase Date</p>
                        <p className="print-info-value text-sm font-medium">{selectedAsset.purchase_date || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {selectedAsset.peripherals && selectedAsset.peripherals.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold text-primary mb-2">Peripherals List</h4>
                        <table className="print-table w-full border-collapse">
                          <thead>
                            <tr className="bg-primary text-primary-foreground">
                              <th className="p-2 text-left">Product Type</th>
                              <th className="p-2 text-left">Quantity</th>
                              <th className="p-2 text-left">Exchange Date</th>
                              <th className="p-2 text-left">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAsset.peripherals.map((peripheral, idx) => (
                              <tr key={idx} className="border-b border-primary/20">
                                <td className="p-2 capitalize font-medium">{peripheral.product_type}</td>
                                <td className="p-2">{peripheral.quantity}</td>
                                <td className="p-2 text-xs">{new Date(peripheral.exchange_date).toLocaleString()}</td>
                                <td className="p-2 text-xs">{peripheral.exchange_reason || 'N/A'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {selectedAsset.remarks && (
                      <div className="mt-4 bg-primary/5 dark:bg-primary/10 text-foreground p-3 rounded-lg border-l-4 border-primary">
                        <p className="print-info-label text-xs font-semibold text-muted-foreground mb-1">Remarks</p>
                        <p className="print-info-value text-sm">{selectedAsset.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Print Footer */}
              <div className="print-footer hidden print:block mt-8 pt-4 border-t-2 border-sky-200 text-center text-muted-foreground">
                <p className="text-sm">Created by IT Team - MNR Group</p>
                <p className="text-xs mt-1">Generated on {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={(open) => !open && stopCamera()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">Capture Photo</DialogTitle>
            <DialogDescription>
              Position the camera and click capture to take a photo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                id="camera-preview"
                autoPlay
                playsInline
                ref={(video) => {
                  if (video && cameraStream) {
                    video.srcObject = cameraStream;
                  }
                }}
                className="w-full h-auto"
              />
            </div>
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={switchCamera}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <Camera className="h-4 w-4 mr-2" />
                Switch Camera
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={stopCamera}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Peripheral Dialog */}
      <Dialog open={showPeripheralDialog} onOpenChange={setShowPeripheralDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {editingPeripheralIndex !== null ? "Edit Peripheral" : "Add Peripheral"}
            </DialogTitle>
            <DialogDescription>
              {editingPeripheralIndex !== null ? "Update peripheral information" : "Add a new peripheral item"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product_type">Product Type *</Label>
              <Input
                id="product_type"
                placeholder="Enter product type (e.g., Mouse, Keyboard, Monitor)"
                value={peripheralForm.product_type}
                onChange={(e) => setPeripheralForm({ ...peripheralForm, product_type: e.target.value })}
                className="border-border focus-visible:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground mt-1">Type any product name to create it</p>
            </div>
            
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={peripheralForm.quantity}
                onChange={(e) => setPeripheralForm({ ...peripheralForm, quantity: parseInt(e.target.value) || 1 })}
                className="border-border focus-visible:ring-primary/40"
              />
            </div>
            
            <div>
              <Label htmlFor="exchange_date">Exchange Date & Time</Label>
              <Input
                id="exchange_date"
                type="datetime-local"
                value={peripheralForm.exchange_date}
                onChange={(e) => setPeripheralForm({ ...peripheralForm, exchange_date: e.target.value })}
                className="border-border focus-visible:ring-primary/40"
              />
              <p className="text-xs text-muted-foreground mt-1">Auto-fills with current date & time</p>
            </div>

            <div>
              <Label htmlFor="exchange_reason">Exchange Reason</Label>
              <Textarea
                id="exchange_reason"
                placeholder="Reason for exchange..."
                value={peripheralForm.exchange_reason}
                onChange={(e) => setPeripheralForm({ ...peripheralForm, exchange_reason: e.target.value })}
                className="border-border focus-visible:ring-primary/40"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowPeripheralDialog(false);
                  resetPeripheralForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleAddPeripheral}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {editingPeripheralIndex !== null ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-2 border-destructive rounded-2xl shadow-[0_0_50px_-8px_hsl(var(--destructive)/0.7)] bg-gradient-to-br from-background via-background to-destructive/10">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 ring-2 ring-destructive/40">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl font-bold text-destructive">Delete IT Asset?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.employee_name || deleteTarget?.pc_no || "this IT asset"}
              </span>?
              <br />This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="rounded-xl border-2 border-primary text-primary hover:bg-primary/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAsset} className="rounded-xl border-2 border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Accessories;