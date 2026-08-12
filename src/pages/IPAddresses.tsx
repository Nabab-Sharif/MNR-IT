import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Network, Plus, Edit, Trash2, ArrowLeft, CheckCircle, XCircle, Monitor, Server, Download, Upload, Printer as PrinterIcon, X } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import dbService from "@/services/dbService";
import SearchFilter from "@/components/SearchFilter";
import PermGate from "@/components/PermGate";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";
import { supabase } from "@/integrations/supabase/client";

interface IPAddress {
  id: number;
  ip_address: string;
  series: string;
  status: "used" | "available";
  used_by: string;
  user_department: string;
  unit_office: string;
  device_type: string;
  added_date: string;
}

const IPAddresses = () => {
  const { toast } = useToast();
  const [ipAddresses, setIpAddresses] = useState<IPAddress[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [editingIP, setEditingIP] = useState<IPAddress | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterDevice, setFilterDevice] = useState("all");
  const [newSeriesName, setNewSeriesName] = useState("");
  const [customSeries, setCustomSeries] = useState<string[]>([]);
  const [statsView, setStatsView] = useState<null | "total" | "used" | "available" | "devices">(null);
  const [statsSearch, setStatsSearch] = useState("");
  const [statsDeviceFilter, setStatsDeviceFilter] = useState("all");
  const [statsSeriesFilter, setStatsSeriesFilter] = useState("all");
  const [statsDeptFilter, setStatsDeptFilter] = useState("all");
  const [statsUnitFilter, setStatsUnitFilter] = useState("all");
  const [deleteIP, setDeleteIP] = useState<IPAddress | null>(null);
  const [deleteSeries, setDeleteSeries] = useState<string | null>(null);
  const [editSeries, setEditSeries] = useState<string | null>(null);
  const [editSeriesName, setEditSeriesName] = useState("");

  const [formData, setFormData] = useState({
    ip_address: "",
    series: "",
    status: "available" as "used" | "available",
    used_by: "",
    user_department: "",
    unit_office: "",
    device_type: "",
  });

  useEffect(() => {
    loadData();
    loadCustomSeries();
  }, []);

  useCloudRealtime(["ip_addresses"], () => { loadData(); });

  const loadData = async () => {
    const data = await dbService.getIPAddresses();
    setIpAddresses(data || []);
  };

  const loadCustomSeries = () => {
    const saved = localStorage.getItem('mnr_ip_series');
    if (saved) {
      setCustomSeries(JSON.parse(saved));
    }
  };

  const saveCustomSeries = (series: string[]) => {
    localStorage.setItem('mnr_ip_series', JSON.stringify(series));
    setCustomSeries(series);
  };

  const getAllSeries = () => {
    const ipSeries = new Set<string>();
    ipAddresses.forEach(ip => {
      if (ip.series) ipSeries.add(ip.series);
    });
    customSeries.forEach(s => ipSeries.add(s));
    return Array.from(ipSeries).sort();
  };

  const getAllDeviceTypes = () => {
    const types = new Set<string>();
    ipAddresses.forEach(ip => {
      if (ip.device_type) types.add(ip.device_type);
    });
    return Array.from(types);
  };

  const handleAddSeries = async () => {
    const raw = newSeriesName.trim();
    if (!raw) return;

    // Accept "a.b.c" (=> /24), "a.b.c.d" (=> /24), or "a.b.c.d/N"
    const [ipPart, maskPart] = raw.split("/");
    const octets = ipPart.split(".").map((o) => Number(o));
    let networkInt = 0;
    let cidr = 24;
    let prefix = "";

    if (
      octets.length === 3 &&
      octets.every((o) => Number.isInteger(o) && o >= 0 && o <= 255)
    ) {
      prefix = `${octets[0]}.${octets[1]}.${octets[2]}`;
      networkInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8)) >>> 0;
      cidr = maskPart ? parseInt(maskPart, 10) : 24;
    } else if (
      octets.length === 4 &&
      octets.every((o) => Number.isInteger(o) && o >= 0 && o <= 255)
    ) {
      cidr = maskPart ? parseInt(maskPart, 10) : 24;
      const ipInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
      const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
      networkInt = (ipInt & mask) >>> 0;
      prefix = `${octets[0]}.${octets[1]}.${octets[2]}`;
    } else {
      toast({ title: "Invalid series", description: "Use format like 192.168.1.0/24", variant: "destructive" });
      return;
    }

    if (!Number.isInteger(cidr) || cidr < 16 || cidr > 30) {
      toast({ title: "Invalid CIDR", description: "Supported mask range is /16 to /30.", variant: "destructive" });
      return;
    }

    const mask = (0xffffffff << (32 - cidr)) >>> 0;
    const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;
    const intToIp = (n: number) =>
      [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");

    const label = `${intToIp(networkInt)}/${cidr}`;

    const existing = new Set(getAllSeries().map((s) => s.toLowerCase()));
    if (existing.has(label.toLowerCase()) || existing.has(prefix.toLowerCase())) {
      toast({ title: "Duplicate series", description: `${label} already exists.`, variant: "destructive" });
      return;
    }

    const updated = [...customSeries, label];
    saveCustomSeries(updated);
    setNewSeriesName("");
    setIsSeriesDialogOpen(false);

    // Auto-generate usable host IPs (exclude network + broadcast)
    try {
      const existingIPs = new Set(ipAddresses.map((ip) => ip.ip_address));
      let created = 0;
      for (let n = networkInt + 1; n < broadcastInt; n++) {
        const addr = intToIp(n);
        if (existingIPs.has(addr)) continue;
        await dbService.addIPAddress({
          ip_address: addr,
          series: label,
          status: "available",
          used_by: "",
          user_department: "",
          unit_office: "",
          device_type: "",
        });
        created++;
      }
      await loadData();
      const usable = broadcastInt - networkInt - 1;
      toast({
        title: "Series added",
        description: `${label} — ${usable} usable IPs (created ${created}).`,
      });
    } catch (err) {
      console.error("Auto-generate IPs failed:", err);
      toast({ title: "Error", description: "Failed to auto-generate IPs.", variant: "destructive" });
    }
  };

  const confirmDeleteSeries = async () => {
    if (!deleteSeries) return;
    const target = deleteSeries;
    try {
      // Remove from custom series list
      const updated = customSeries.filter((s) => s !== target);
      saveCustomSeries(updated);

      // Bulk delete all IPs belonging to this series
      const toDelete = ipAddresses.filter((ip) => ip.series === target);
      const { error } = await supabase.from("ip_addresses").delete().eq("series", target);
      if (error) throw error;
      await loadData();
      toast({
        title: "Series deleted",
        description: `${target} and ${toDelete.length} IP addresses removed.`,
        variant: "destructive",
      });
    } catch (err) {
      console.error("Delete series failed:", err);
      toast({ title: "Error", description: "Failed to delete series.", variant: "destructive" });
    } finally {
      setDeleteSeries(null);
    }
  };

  const openEditSeries = (series: string) => {
    setEditSeries(series);
    setEditSeriesName(series);
  };

  const confirmEditSeries = async () => {
    if (!editSeries) return;
    const newName = editSeriesName.trim();
    if (!newName) {
      toast({ title: "Invalid name", description: "Series name cannot be empty.", variant: "destructive" });
      return;
    }
    if (newName === editSeries) {
      setEditSeries(null);
      return;
    }
    const existing = new Set(getAllSeries().map((s) => s.toLowerCase()));
    if (existing.has(newName.toLowerCase())) {
      toast({ title: "Duplicate series", description: `${newName} already exists.`, variant: "destructive" });
      return;
    }
    try {
      // Update custom series list
      const updated = customSeries.map((s) => (s === editSeries ? newName : s));
      if (!customSeries.includes(editSeries)) updated.push(newName);
      saveCustomSeries(updated);

      // Update series label on all matching IPs
      const toUpdate = ipAddresses.filter((ip) => ip.series === editSeries);
      for (const ip of toUpdate) {
        await dbService.updateIPAddress(ip.id, { ...ip, series: newName });
      }
      await loadData();
      toast({ title: "Series renamed", description: `${editSeries} → ${newName}` });
    } catch (err) {
      console.error("Rename series failed:", err);
      toast({ title: "Error", description: "Failed to rename series.", variant: "destructive" });
    } finally {
      setEditSeries(null);
      setEditSeriesName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Preserve existing series label (e.g., "192.168.1.0/24"); fall back to /24 prefix
    const ipParts = formData.ip_address.split(".");
    const fallbackSeries = ipParts.slice(0, 3).join(".");
    const series = formData.series?.trim() || fallbackSeries;

    const dataToSave = {
      ...formData,
      series,
    };

    const ipNorm = formData.ip_address.trim();
    const duplicate = ipAddresses.find(
      (ip) => ip.ip_address?.trim() === ipNorm && (!editingIP || ip.id !== editingIP.id)
    );
    if (duplicate) {
      toast({ title: "Duplicate IP address", description: `${ipNorm} already exists.`, variant: "destructive" });
      return;
    }

    // Prevent same device type being used by another IP in the same series
    const deviceTypeNorm = (formData.device_type || "").trim().toLowerCase();
    if (deviceTypeNorm) {
      const deviceDuplicate = ipAddresses.find(
        (ip) =>
          ip.series === series &&
          (ip.device_type || "").trim().toLowerCase() === deviceTypeNorm &&
          (!editingIP || ip.id !== editingIP.id)
      );
      if (deviceDuplicate) {
        toast({
          title: "Duplicate device type",
          description: `"${formData.device_type}" is already assigned to ${deviceDuplicate.ip_address} in ${series}.`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      if (editingIP) {
        await dbService.updateIPAddress(editingIP.id, dataToSave);
        toast({ title: "IP Address updated", description: "IP Address has been updated successfully." });
      } else {
        await dbService.addIPAddress(dataToSave);
        toast({ title: "IP Address added", description: "New IP Address has been added successfully." });
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error("Error saving IP:", error);
      toast({ title: "Error", description: "Failed to save IP Address.", variant: "destructive" });
    }
  };

  const handleEdit = (ip: IPAddress) => {
    setEditingIP(ip);
    setFormData({
      ip_address: ip.ip_address,
      series: ip.series,
      status: ip.status,
      used_by: ip.used_by || "",
      user_department: ip.user_department || "",
      unit_office: ip.unit_office || "",
      device_type: ip.device_type || "",
    });
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteIP) return;
    await dbService.deleteIPAddress(deleteIP.id);
    await loadData();
    toast({ title: "IP Address deleted", description: `${deleteIP.ip_address} has been removed.`, variant: "destructive" });
    setDeleteIP(null);
  };

  const handlePrintIP = (ip: IPAddress) => {
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`
      <html><head><title>IP ${ip.ip_address}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
        .card{border:2px solid #0ea5e9;border-radius:12px;padding:20px;max-width:480px;margin:0 auto}
        h1{margin:0 0 12px;font-size:22px;color:#0369a1}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e5e7eb}
        .row:last-child{border-bottom:0}
        .k{color:#64748b}.v{font-weight:600}
      </style></head><body>
      <div class="card">
        <h1>IP Address Details</h1>
        <div class="row"><span class="k">IP Address</span><span class="v">${ip.ip_address}</span></div>
        <div class="row"><span class="k">Series</span><span class="v">${ip.series || "-"}</span></div>
        <div class="row"><span class="k">Status</span><span class="v">${ip.status}</span></div>
        <div class="row"><span class="k">Used By</span><span class="v">${ip.used_by || "-"}</span></div>
        <div class="row"><span class="k">Department</span><span class="v">${ip.user_department || "-"}</span></div>
        <div class="row"><span class="k">Unit/Office</span><span class="v">${ip.unit_office || "-"}</span></div>
        <div class="row"><span class="k">Device Type</span><span class="v">${ip.device_type || "-"}</span></div>
      </div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
      </body></html>`);
    w.document.close();
  };

  const handlePrintStats = (title: string, rowsHtml: string, headers: string[]) => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    const thead = headers.map((h) => `<th>${h}</th>`).join("");
    w.document.write(`
      <html><head><title>${title}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:16px;color:#0f172a}
        h1{margin:0 0 12px;font-size:20px;color:#0369a1;border-bottom:2px solid #0ea5e9;padding-bottom:8px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #0ea5e9;padding:6px 8px;text-align:left}
        th{background:#e0f2fe;color:#0369a1;font-weight:600}
        tr:nth-child(even) td{background:#f8fafc}
        @page{size:A4 landscape;margin:10mm}
      </style></head><body>
      <h1>${title}</h1>
      <table><thead><tr>${thead}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
      </body></html>`);
    w.document.close();
  };

  const resetForm = () => {
    setFormData({
      ip_address: selectedSeries ? `${selectedSeries}.` : "",
      series: selectedSeries || "",
      status: "available",
      used_by: "",
      user_department: "",
      unit_office: "",
      device_type: "",
    });
    setEditingIP(null);
    setIsDialogOpen(false);
  };

  const getSeriesStats = (series: string) => {
    const seriesIPs = ipAddresses.filter((ip) => ip.series === series);
    const used = seriesIPs.filter((ip) => ip.status === "used").length;
    const available = seriesIPs.filter((ip) => ip.status === "available").length;
    return { total: seriesIPs.length, used, available };
  };

  const getDeviceTypeStats = (type: string) => {
    return ipAddresses.filter((ip) => ip.device_type === type).length;
  };

  const getFilteredIPs = () => {
    let filtered = ipAddresses;

    if (selectedSeries) {
      filtered = filtered.filter((ip) => ip.series === selectedSeries);
    }

    if (selectedDeviceType) {
      filtered = filtered.filter((ip) => ip.device_type === selectedDeviceType);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (ip) =>
          ip.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ip.used_by?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ip.device_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ip.user_department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ip.unit_office?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((ip) => ip.status === filterStatus);
    }

    if (filterUnit !== "all") {
      filtered = filtered.filter((ip) => (ip.unit_office || "") === filterUnit);
    }
    if (filterDept !== "all") {
      filtered = filtered.filter((ip) => (ip.user_department || "") === filterDept);
    }
    if (filterDevice !== "all") {
      filtered = filtered.filter((ip) => (ip.device_type || "") === filterDevice);
    }

    return filtered.sort((a, b) => {
      const aNum = parseInt(a.ip_address.split(".").pop() || "0");
      const bNum = parseInt(b.ip_address.split(".").pop() || "0");
      return aNum - bNum;
    });
  };

  const handleExportData = () => {
    const data = getFilteredIPs();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ip_addresses_${selectedSeries || "all"}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "IP Addresses data has been exported successfully." });
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result;
          if (typeof result === 'string') {
            const data = JSON.parse(result);
            for (const ip of data) {
              if (ip.ip_address) {
                await dbService.addIPAddress(ip);
              }
            }
            await loadData();
            toast({ title: "Data imported", description: "IP Addresses have been imported successfully." });
          }
        } catch (error) {
          toast({ title: "Import failed", description: "Failed to import data. Please check the file format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
  };

  const allSeries = getAllSeries();
  const allDeviceTypes = getAllDeviceTypes();
  const totalIPs = ipAddresses.length;
  const usedIPs = ipAddresses.filter(ip => ip.status === "used").length;
  const availableIPs = ipAddresses.filter(ip => ip.status === "available").length;

  // Main view - show all cards
  if (!selectedSeries && !selectedDeviceType) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {!statsView && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              IP Address Management
            </h1>
            <p className="text-muted-foreground mt-2">Manage IP addresses by series and device type</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('ip-import-file')?.click()} className="border-primary/30 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input id="ip-import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
            <Dialog open={isSeriesDialogOpen} onOpenChange={setIsSeriesDialogOpen}>
              <PermGate action="add">
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-primary/30">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Series
                  </Button>
                </DialogTrigger>
              </PermGate>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New IP Series</DialogTitle>
                  <DialogDescription>
                    Enter network with CIDR (e.g., 192.168.1.0/24 → 254 usable, /25 → 126 usable)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={newSeriesName}
                    onChange={(e) => setNewSeriesName(e.target.value)}
                    placeholder="e.g., 192.168.1.0/24"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSeriesDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddSeries} className="bg-gradient-to-r from-primary to-primary/80">Add Series</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <PermGate action="add">
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="border-2 border-primary text-primary bg-transparent hover:bg-primary/10">
                    <Plus className="h-4 w-4 mr-2" />
                    Add IP Address
                  </Button>
                </DialogTrigger>
              </PermGate>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingIP ? "Edit IP Address" : "Add New IP Address"}</DialogTitle>
                  <DialogDescription>Fill in the IP address details</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="series">IP Series *</Label>
                      <Select
                        value={formData.series}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            series: value,
                            ip_address: formData.ip_address && formData.ip_address.startsWith(`${value}.`)
                              ? formData.ip_address
                              : `${value}.`,
                          })
                        }
                      >
                        <SelectTrigger id="series">
                          <SelectValue placeholder="Select IP series" />
                        </SelectTrigger>
                        <SelectContent>
                          {allSeries.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No series yet. Add one first.</div>
                          ) : allSeries.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ip_address">IP Address *</Label>
                      <Input
                        id="ip_address"
                        value={formData.ip_address}
                        onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                        placeholder="e.g., 192.168.1.100"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status *</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: "used" | "available") => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="device_type">Device Type</Label>
                      <Input
                        id="device_type"
                        value={formData.device_type}
                        onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                        placeholder="e.g., PC, Laptop, Server"
                      />
                    </div>
                    <div>
                      <Label htmlFor="used_by">Used By</Label>
                      <Input
                        id="used_by"
                        value={formData.used_by}
                        onChange={(e) => setFormData({ ...formData, used_by: e.target.value })}
                        placeholder="User name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="user_department">User Department</Label>
                      <Input
                        id="user_department"
                        value={formData.user_department}
                        onChange={(e) => setFormData({ ...formData, user_department: e.target.value })}
                        placeholder="Department name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit_office">Unit/Office</Label>
                      <Input
                        id="unit_office"
                        value={formData.unit_office}
                        onChange={(e) => setFormData({ ...formData, unit_office: e.target.value })}
                        placeholder="Unit or Office name"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                    <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
                      {editingIP ? "Update" : "Add"} IP Address
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        )}

        {/* Search Filter */}
        {!statsView && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search IP addresses, users, departments..."
              filters={[
                {
                  value: filterStatus,
                  onChange: setFilterStatus,
                  placeholder: "Filter by status",
                  options: [
                    { value: "all", label: "All Status" },
                    { value: "used", label: "Used" },
                    { value: "available", label: "Available" },
                  ],
                },
                {
                  value: filterSeries,
                  onChange: setFilterSeries,
                  placeholder: "Filter by series",
                  options: [
                    { value: "all", label: "All Series" },
                    ...allSeries.map((s) => ({ value: s, label: s })),
                  ],
                },
                {
                  value: filterUnit,
                  onChange: setFilterUnit,
                  placeholder: "Filter by unit/office",
                  options: [
                    { value: "all", label: "All Units/Offices" },
                    ...Array.from(new Set(ipAddresses.map(ip => ip.unit_office).filter(Boolean) as string[])).sort().map(u => ({ value: u, label: u })),
                  ],
                },
                {
                  value: filterDept,
                  onChange: setFilterDept,
                  placeholder: "Filter by department",
                  options: [
                    { value: "all", label: "All Departments" },
                    ...Array.from(new Set(ipAddresses.map(ip => ip.user_department).filter(Boolean) as string[])).sort().map(d => ({ value: d, label: d })),
                  ],
                },
                {
                  value: filterDevice,
                  onChange: setFilterDevice,
                  placeholder: "Filter by device type",
                  options: [
                    { value: "all", label: "All Device Types" },
                    ...Array.from(new Set(ipAddresses.map(ip => ip.device_type).filter(Boolean) as string[])).sort().map(d => ({ value: d, label: d })),
                  ],
                },
              ]}
            />
          </CardContent>
        </Card>
        )}

        {/* Search Results (main view) */}
        {!statsView && (searchTerm.trim() || filterStatus !== "all" || filterSeries !== "all" || filterUnit !== "all" || filterDept !== "all" || filterDevice !== "all") && (() => {
          const q = searchTerm.trim().toLowerCase();
          const results = ipAddresses.filter((ip) => {
            if (filterStatus !== "all" && ip.status !== filterStatus) return false;
            if (filterSeries !== "all" && (ip.series || "") !== filterSeries) return false;
            if (filterUnit !== "all" && (ip.unit_office || "") !== filterUnit) return false;
            if (filterDept !== "all" && (ip.user_department || "") !== filterDept) return false;
            if (filterDevice !== "all" && (ip.device_type || "") !== filterDevice) return false;
            if (!q) return true;
            return (
              ip.ip_address?.toLowerCase().includes(q) ||
              (ip.used_by || "").toLowerCase().includes(q) ||
              (ip.user_department || "").toLowerCase().includes(q) ||
              (ip.unit_office || "").toLowerCase().includes(q) ||
              (ip.device_type || "").toLowerCase().includes(q) ||
              (ip.series || "").toLowerCase().includes(q)
            );
          });
          return (
            <Card className="border-2 border-primary">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-primary">
                  Search Results <span className="text-sm font-normal text-muted-foreground">({results.length})</span>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSearchTerm("")}><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="border border-primary/60 border-collapse [&_th]:border [&_th]:border-primary/60 [&_td]:border [&_td]:border-primary/40">
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Series</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Used By</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Unit/Office</TableHead>
                        <TableHead>Device Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No matching IPs</TableCell></TableRow>
                      ) : results.map((ip) => (
                        <TableRow key={ip.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => handleEdit(ip)}>{ip.ip_address}</TableCell>
                          <TableCell>{ip.series}</TableCell>
                          <TableCell><Badge variant={ip.status === "used" ? "default" : "secondary"}>{ip.status}</Badge></TableCell>
                          <TableCell>{ip.used_by || "-"}</TableCell>
                          <TableCell>{ip.user_department || "-"}</TableCell>
                          <TableCell>{ip.unit_office || "-"}</TableCell>
                          <TableCell>{ip.device_type || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Stats Cards */}
        {!statsView && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card
            onClick={() => setStatsView(statsView === "total" ? null : "total")}
            className={`cursor-pointer animate-slide-up border-2 border-primary transition-all hover:shadow-md ${statsView === "total" ? "ring-2 ring-primary/50" : ""}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total IP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalIPs}</div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatsView(statsView === "used" ? null : "used")}
            className={`cursor-pointer animate-slide-up border-2 border-success transition-all hover:shadow-md ${statsView === "used" ? "ring-2 ring-success/50" : ""}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Used IP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{usedIPs}</div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatsView(statsView === "available" ? null : "available")}
            className={`cursor-pointer animate-slide-up border-2 border-warning transition-all hover:shadow-md ${statsView === "available" ? "ring-2 ring-warning/50" : ""}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Available IP</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{availableIPs}</div>
            </CardContent>
          </Card>
          <Card
            onClick={() => setStatsView(statsView === "devices" ? null : "devices")}
            className={`cursor-pointer animate-slide-up border-2 border-destructive transition-all hover:shadow-md ${statsView === "devices" ? "ring-2 ring-destructive/50" : ""}`}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Device Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{allDeviceTypes.length}</div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Stats Details Panel */}
        {statsView && (() => {
          const base =
            statsView === "used" ? ipAddresses.filter(ip => ip.status === "used")
            : statsView === "available" ? ipAddresses.filter(ip => ip.status === "available")
            : ipAddresses;
          const q = statsSearch.trim().toLowerCase();
          const allDepartments = Array.from(new Set(ipAddresses.map(ip => ip.user_department).filter(Boolean) as string[])).sort();
          const allUnits = Array.from(new Set(ipAddresses.map(ip => ip.unit_office).filter(Boolean) as string[])).sort();
          const filtered = base.filter(ip => {
            if (statsSeriesFilter !== "all" && (ip.series || "") !== statsSeriesFilter) return false;
            if (statsDeptFilter !== "all" && (ip.user_department || "") !== statsDeptFilter) return false;
            if (statsUnitFilter !== "all" && (ip.unit_office || "") !== statsUnitFilter) return false;
            if (statsDeviceFilter !== "all" && (ip.device_type || "") !== statsDeviceFilter) return false;
            if (!q) return true;
            return (
              ip.ip_address?.toLowerCase().includes(q) ||
              (ip.used_by || "").toLowerCase().includes(q) ||
              (ip.user_department || "").toLowerCase().includes(q) ||
              (ip.unit_office || "").toLowerCase().includes(q) ||
              (ip.device_type || "").toLowerCase().includes(q) ||
              (ip.series || "").toLowerCase().includes(q)
            );
          });
          const title =
            statsView === "total" ? "All IP Addresses"
            : statsView === "used" ? "Used IP Addresses"
            : statsView === "available" ? "Available IP Addresses"
            : "Device Types Overview";

          if (statsView === "devices") {
            const deviceRows = [...ipAddresses]
              .filter(ip => {
                if (ip.status !== "used") return false;
                if (!q) return true;
                return (
                  (ip.device_type || "").toLowerCase().includes(q) ||
                  ip.ip_address?.toLowerCase().includes(q) ||
                  (ip.used_by || "").toLowerCase().includes(q) ||
                  (ip.user_department || "").toLowerCase().includes(q) ||
                  (ip.unit_office || "").toLowerCase().includes(q) ||
                  (ip.series || "").toLowerCase().includes(q)
                );
              })
              .sort((a, b) => (a.device_type || "Unassigned").localeCompare(b.device_type || "Unassigned"));
            return (
              <Card className="border-2 border-destructive print:border-black" id="ip-stats-details">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setStatsView(null)} title="Back" className="border-2 border-destructive text-destructive hover:bg-destructive/10">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-destructive">{title} <span className="text-sm font-normal text-muted-foreground">({deviceRows.length})</span></CardTitle>
                  </div>
                  <div className="flex items-center gap-2 no-print">
                    <Input placeholder="Search..." value={statsSearch} onChange={(e) => setStatsSearch(e.target.value)} className="w-56" />
                    <Button variant="outline" size="sm" onClick={() => {
                      const esc = (v: string) => (v || "-").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
                      const rowsHtml = deviceRows.map((ip) => `<tr>
                        <td>${esc(ip.device_type || "Unassigned")}</td>
                        <td>${esc(ip.ip_address)}</td>
                        <td>${esc(ip.series)}</td>
                        <td>${esc(ip.status)}</td>
                        <td>${esc(ip.used_by || "")}</td>
                        <td>${esc(ip.user_department || "")}</td>
                        <td>${esc(ip.unit_office || "")}</td>
                      </tr>`).join("");
                      handlePrintStats(
                        `${title} (${deviceRows.length})`,
                        rowsHtml || `<tr><td colspan="7" style="text-align:center">No IP addresses</td></tr>`,
                        ["Device Type", "IP Address", "Series", "Status", "Used By", "Department", "Unit/Office"],
                      );
                    }}><PrinterIcon className="h-4 w-4 mr-1" />Print</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table className="border border-destructive/60 border-collapse [&_th]:border [&_th]:border-destructive/60 [&_td]:border [&_td]:border-destructive/40">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device Type</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Series</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Used By</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Unit/Office</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deviceRows.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No IP addresses</TableCell></TableRow>
                        ) : deviceRows.map((ip) => (
                          <TableRow key={ip.id}>
                            <TableCell className="font-semibold">{ip.device_type || "Unassigned"}</TableCell>
                            <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => handleEdit(ip)}>{ip.ip_address}</TableCell>
                            <TableCell>{ip.series}</TableCell>
                            <TableCell><Badge variant={ip.status === "used" ? "default" : "secondary"}>{ip.status}</Badge></TableCell>
                            <TableCell>{ip.used_by || "-"}</TableCell>
                            <TableCell>{ip.user_department || "-"}</TableCell>
                            <TableCell>{ip.unit_office || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          }

          const borderColor = statsView === "total" ? "border-primary" : statsView === "used" ? "border-success" : "border-warning";
          return (
            <Card className={`border-2 ${borderColor} print:border-black`} id="ip-stats-details">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setStatsView(null)} title="Back" className={`border-2 ${borderColor} hover:bg-muted/40`}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle>{title} <span className="text-sm font-normal text-muted-foreground">({filtered.length})</span></CardTitle>
                </div>
                 <div className="flex items-center gap-2 flex-wrap no-print">
                   <Input placeholder="Search..." value={statsSearch} onChange={(e) => setStatsSearch(e.target.value)} className="w-56" />
                   <div className="flex items-center gap-1">
                     <Select value={statsSeriesFilter} onValueChange={setStatsSeriesFilter}>
                       <SelectTrigger className="w-40"><SelectValue placeholder="Series" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="all">All Series</SelectItem>
                         {allSeries.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                       </SelectContent>
                     </Select>
                     {statsSeriesFilter !== "all" && (
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsSeriesFilter("all")} title="Clear"><X className="h-4 w-4" /></Button>
                     )}
                   </div>
                   {statsView !== "available" && (
                   <div className="flex items-center gap-1">
                     <Select value={statsDeptFilter} onValueChange={setStatsDeptFilter}>
                       <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="all">All Departments</SelectItem>
                         {allDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                       </SelectContent>
                     </Select>
                     {statsDeptFilter !== "all" && (
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsDeptFilter("all")} title="Clear"><X className="h-4 w-4" /></Button>
                     )}
                   </div>
                   )}
                   {statsView !== "available" && (
                   <div className="flex items-center gap-1">
                     <Select value={statsUnitFilter} onValueChange={setStatsUnitFilter}>
                       <SelectTrigger className="w-44"><SelectValue placeholder="Unit/Office" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="all">All Units/Offices</SelectItem>
                         {allUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                       </SelectContent>
                     </Select>
                     {statsUnitFilter !== "all" && (
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsUnitFilter("all")} title="Clear"><X className="h-4 w-4" /></Button>
                     )}
                   </div>
                   )}
                   {statsView !== "available" && (
                   <div className="flex items-center gap-1">
                     <Select value={statsDeviceFilter} onValueChange={setStatsDeviceFilter}>
                       <SelectTrigger className="w-44"><SelectValue placeholder="Device type" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="all">All Device Types</SelectItem>
                         {allDeviceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                       </SelectContent>
                     </Select>
                     {statsDeviceFilter !== "all" && (
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStatsDeviceFilter("all")} title="Clear"><X className="h-4 w-4" /></Button>
                     )}
                   </div>
                   )}
                   <Button variant="outline" size="sm" onClick={() => {
                     const esc = (v: string) => (v || "-").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
                     const rowsHtml = filtered.map((ip) => `<tr>
                       <td>${esc(ip.ip_address)}</td>
                       <td>${esc(ip.series)}</td>
                       <td>${esc(ip.status)}</td>
                       <td>${esc(ip.used_by || "")}</td>
                       <td>${esc(ip.user_department || "")}</td>
                       <td>${esc(ip.unit_office || "")}</td>
                       <td>${esc(ip.device_type || "")}</td>
                     </tr>`).join("");
                     handlePrintStats(
                       `${title} (${filtered.length})`,
                       rowsHtml || `<tr><td colspan="7" style="text-align:center">No IP addresses</td></tr>`,
                       ["IP Address", "Series", "Status", "Used By", "Department", "Unit/Office", "Device Type"],
                     );
                   }}><PrinterIcon className="h-4 w-4 mr-1" />Print</Button>
                 </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table
                    className={
                      statsView === "total"
                        ? "border border-primary/60 border-collapse [&_th]:border [&_th]:border-primary/60 [&_td]:border [&_td]:border-primary/40"
                        : statsView === "used"
                        ? "border border-success/60 border-collapse [&_th]:border [&_th]:border-success/60 [&_td]:border [&_td]:border-success/40"
                        : "border border-warning/60 border-collapse [&_th]:border [&_th]:border-warning/60 [&_td]:border [&_td]:border-warning/40"
                    }
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Series</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Used By</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Unit/Office</TableHead>
                        <TableHead>Device Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No IP addresses</TableCell></TableRow>
                      ) : filtered.map(ip => (
                        <TableRow key={ip.id}>
                          <TableCell className="font-mono font-bold text-primary cursor-pointer hover:underline" onClick={() => handleEdit(ip)}>{ip.ip_address}</TableCell>
                          <TableCell>{ip.series}</TableCell>
                          <TableCell><Badge variant={ip.status === "used" ? "default" : "secondary"}>{ip.status}</Badge></TableCell>
                          <TableCell>{ip.used_by || "-"}</TableCell>
                          <TableCell>{ip.user_department || "-"}</TableCell>
                          <TableCell>{ip.unit_office || "-"}</TableCell>
                          <TableCell>{ip.device_type || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* IP Series Cards */}
        {!statsView && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-primary">IP Series</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allSeries.map((series) => {
              const stats = getSeriesStats(series);
              return (
                <Card
                  key={series}
                  className="cursor-pointer animate-slide-up bg-transparent border-2 border-primary hover:border-primary/70 transition-colors"
                  onClick={() => setSelectedSeries(series)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-primary flex items-center gap-2">
                      <Network className="h-5 w-5" />
                      {series}.x
                    </CardTitle>
                    <div className="flex gap-1">
                      <PermGate action="edit">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); openEditSeries(series); }}
                          className="h-8 w-8 p-0 text-primary hover:text-primary"
                          title="Edit series"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </PermGate>
                      <PermGate action="delete">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setDeleteSeries(series); }}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete series"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermGate>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <div className="text-xl font-bold text-primary">{stats.total}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="bg-success/10 rounded-lg p-2">
                        <div className="text-xl font-bold text-success">{stats.used}</div>
                        <div className="text-xs text-muted-foreground">Used</div>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-2">
                        <div className="text-xl font-bold text-primary">{stats.available}</div>
                        <div className="text-xs text-muted-foreground">Available</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {/* Device Type Cards */}
        {!statsView && allDeviceTypes.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-primary">Device Types</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {allDeviceTypes.map((type) => (
                <Card
                  key={type}
                  className="cursor-pointer animate-scale-in bg-transparent border-2 border-primary hover:border-primary/70 transition-colors"
                  onClick={() => setSelectedDeviceType(type)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-primary flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      {type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-lg">{getDeviceTypeStats(type)}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {allSeries.length === 0 && allDeviceTypes.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No IP addresses found</h3>
              <p className="text-muted-foreground">Add IP series or IP addresses to get started</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={!!editSeries} onOpenChange={(o) => { if (!o) { setEditSeries(null); setEditSeriesName(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit IP Series</DialogTitle>
              <DialogDescription>Rename this series label. Existing IPs will be re-tagged.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={editSeriesName}
                onChange={(e) => setEditSeriesName(e.target.value)}
                placeholder="e.g., 192.168.1.0/24"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setEditSeries(null); setEditSeriesName(""); }}>Cancel</Button>
                <Button onClick={confirmEditSeries} className="bg-gradient-to-r from-primary to-primary/80">Save</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteSeries} onOpenChange={(o) => !o && setDeleteSeries(null)}>
          <AlertDialogContent className="border-2 border-destructive rounded-2xl shadow-xl bg-card">
            <AlertDialogHeader>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center text-destructive">Delete IP Series?</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {deleteSeries && (
                  <span className="block mt-2 rounded-lg border-2 border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-base font-semibold text-foreground">
                    {deleteSeries}
                  </span>
                )}
                <span className="mt-3 block text-sm">
                  This will also delete all IP addresses in this series. This action cannot be undone.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteSeries} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Detail view
  const filteredIPs = getFilteredIPs();
  const viewTitle = selectedSeries ? `${selectedSeries}.x` : selectedDeviceType;

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Button
            variant="outline"
            onClick={() => { setSelectedSeries(null); setSelectedDeviceType(null); setSearchTerm(""); }}
            className="mb-4 border-primary/30 text-primary hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {viewTitle}
          </h1>
          <p className="text-muted-foreground mt-2">{filteredIPs.length} IP addresses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <PermGate action="add">
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    if (selectedSeries) {
                      setFormData((prev) => ({ ...prev, ip_address: `${selectedSeries}.`, series: selectedSeries }));
                    }
                  }}
                  className="border-2 border-primary text-primary bg-transparent hover:bg-primary/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add IP Address
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingIP ? "Edit IP Address" : "Add New IP Address"}</DialogTitle>
                <DialogDescription>Fill in the IP address details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ip_address">IP Address *</Label>
                    <Input
                      id="ip_address"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      placeholder="e.g., 192.168.1.100"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "used" | "available") => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="used">Used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="device_type">Device Type</Label>
                    <Input
                      id="device_type"
                      value={formData.device_type}
                      onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                      placeholder="e.g., PC, Laptop, Server"
                    />
                  </div>
                  <div>
                    <Label htmlFor="used_by">Used By</Label>
                    <Input
                      id="used_by"
                      value={formData.used_by}
                      onChange={(e) => setFormData({ ...formData, used_by: e.target.value })}
                      placeholder="User name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="user_department">User Department</Label>
                    <Input
                      id="user_department"
                      value={formData.user_department}
                      onChange={(e) => setFormData({ ...formData, user_department: e.target.value })}
                      placeholder="Department name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit_office">Unit/Office</Label>
                    <Input
                      id="unit_office"
                      value={formData.unit_office}
                      onChange={(e) => setFormData({ ...formData, unit_office: e.target.value })}
                      placeholder="Unit or Office name"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                  <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
                    {editingIP ? "Update" : "Add"} IP Address
                  </Button>
                </DialogFooter>
              </form>
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
            searchPlaceholder="Search IP addresses..."
            filters={[
              {
                value: filterStatus,
                onChange: setFilterStatus,
                placeholder: "Filter by status",
                options: [
                  { value: "all", label: "All Status" },
                  { value: "used", label: "Used" },
                  { value: "available", label: "Available" },
                ],
              },
              {
                value: filterUnit,
                onChange: setFilterUnit,
                placeholder: "Filter by Unit/Office",
                options: [
                  { value: "all", label: "All Units/Offices" },
                  ...Array.from(new Set(ipAddresses.filter(ip => (!selectedSeries || ip.series === selectedSeries) && ip.unit_office).map(ip => ip.unit_office as string))).sort().map((u) => ({ value: u, label: u })),
                ],
              },
              {
                value: filterDept,
                onChange: setFilterDept,
                placeholder: "Filter by Department",
                options: [
                  { value: "all", label: "All Departments" },
                   ...Array.from(new Set(ipAddresses.filter(ip => (!selectedSeries || ip.series === selectedSeries) && (filterUnit === "all" || ip.unit_office === filterUnit) && ip.user_department).map(ip => ip.user_department as string))).sort().map((d) => ({ value: d, label: d })),
                ],
              },
              {
                value: filterDevice,
                onChange: setFilterDevice,
                placeholder: "Filter by Device Type",
                options: [
                  { value: "all", label: "All Device Types" },
                  ...Array.from(new Set(ipAddresses.filter(ip => (!selectedSeries || ip.series === selectedSeries) && ip.device_type).map(ip => ip.device_type as string))).sort().map((d) => ({ value: d, label: d })),
                ],
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Table View */}
      <Card className="border-primary/20">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="border border-primary/60 border-collapse [&_th]:border [&_th]:border-primary/60 [&_td]:border [&_td]:border-primary/40">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">IP Address</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Used By</TableHead>
                  <TableHead className="font-semibold">Department</TableHead>
                  <TableHead className="font-semibold">Unit/Office</TableHead>
                  <TableHead className="font-semibold">Device Type</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIPs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No IP addresses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIPs.map((ip) => (
                    <TableRow key={ip.id} className="hover:bg-muted/30">
                      <TableCell
                        className="font-bold text-primary cursor-pointer hover:underline"
                        title="Click to edit"
                        onClick={() => handleEdit(ip)}
                      >
                        {ip.ip_address}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ip.status === "used" ? "default" : "secondary"} className="flex items-center gap-1 w-fit">
                          {ip.status === "used" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {ip.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{ip.used_by || "-"}</TableCell>
                      <TableCell>{ip.user_department || "-"}</TableCell>
                      <TableCell>{ip.unit_office || "-"}</TableCell>
                      <TableCell>{ip.device_type || "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-2 border-primary/30">
                            <DropdownMenuItem onClick={() => handlePrintIP(ip)} className="text-primary">
                              <PrinterIcon className="h-4 w-4 mr-2" /> Print
                            </DropdownMenuItem>
                            <PermGate action="edit">
                              <DropdownMenuItem onClick={() => handleEdit(ip)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            </PermGate>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteIP} onOpenChange={(o) => !o && setDeleteIP(null)}>
        <AlertDialogContent className="border-2 border-destructive rounded-2xl shadow-xl bg-card">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-destructive">Delete IP Address?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {deleteIP && (
                <span className="block mt-2 rounded-lg border-2 border-destructive/40 bg-destructive/5 px-4 py-3 font-mono text-base font-semibold text-foreground">
                  {deleteIP.ip_address}
                </span>
              )}
              <span className="mt-3 block text-sm">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IPAddresses;
