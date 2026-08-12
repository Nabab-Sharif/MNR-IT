import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Printer as PrinterIcon, Plus, Edit, Trash2, Download, ArrowLeft, Building2, Users, Upload, MoreVertical, Link2 } from "lucide-react";
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

interface Printer {
  id: number;
  printer_name: string;
  printer_model: string;
  ip_address: string;
  unit_number: string;
  department_name: string;
  added_date: string;
  drive_link?: string;
}

const Printers = () => {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Printer | null>(null);
  const [showAllPrinters, setShowAllPrinters] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'network' | 'share' | null>(null);
  const [printerType, setPrinterType] = useState<'network' | 'share'>('network');

  // Units & Departments (hierarchical folders)
  const [unitsList, setUnitsList] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [editUnit, setEditUnit] = useState<any | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [deleteUnit, setDeleteUnit] = useState<any | null>(null);
  const [editDept, setEditDept] = useState<any | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [deleteDept, setDeleteDept] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    printer_name: "",
    printer_model: "",
    ip_address: "",
    unit_number: "",
    department_name: "",
    drive_link: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useCloudRealtime(["printers"], () => { loadData(); });

  const loadData = async () => {
    const printersData = await dbService.getPrinters();
    setPrinters(printersData || []);
    try {
      const u = await dbService.getUnits('printers');
      const d = await dbService.getDepartments('printers');
      setUnitsList(u || []);
      setDepartmentsList(d || []);
    } catch (e) { /* ignore */ }
  };

  const findUnitByName = (name: string) => unitsList.find((u: any) => (u.name || "").toLowerCase() === (name || "").toLowerCase());
  const findDeptByName = (name: string, unit: string) => departmentsList.find((d: any) => (d.name || "").toLowerCase() === (name || "").toLowerCase() && (d.unit || "").toLowerCase() === (unit || "").toLowerCase());

  const handleAddUnit = async () => {
    const name = newUnitName.trim();
    if (!name) return;
    if (unitsList.some((u: any) => (u.name || "").toLowerCase() === name.toLowerCase())) {
      toast({ title: "Duplicate", description: "Unit/Office already exists.", variant: "destructive" });
      return;
    }
    await dbService.addUnit({ name, scope: 'printers' });
    setNewUnitName("");
    setUnitDialogOpen(false);
    await loadData();
    toast({ title: "Unit/Office added", description: name });
  };

  const handleAddDepartment = async () => {
    const name = newDeptName.trim();
    if (!name || !selectedUnit) return;
    if (departmentsList.some((d: any) => (d.name || "").toLowerCase() === name.toLowerCase() && (d.unit || "").toLowerCase() === selectedUnit.toLowerCase())) {
      toast({ title: "Duplicate", description: "Department already exists in this unit.", variant: "destructive" });
      return;
    }
    await dbService.addDepartment({ name, unit: selectedUnit, scope: 'printers' });
    setNewDeptName("");
    setDeptDialogOpen(false);
    await loadData();
    toast({ title: "Department added", description: name });
  };

  const openEditUnit = (unitName: string) => {
    const u = findUnitByName(unitName) || { id: null, name: unitName };
    setEditUnit(u);
    setEditUnitName(u.name || unitName);
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
    if (newName !== oldName) {
      const affected = printers.filter(p => p.unit_number === oldName);
      for (const p of affected) {
        await dbService.updatePrinter(p.id, { ...p, unit_number: newName });
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
      await sendToRecycleBin({ entity: "Printer Unit/Office", entity_id: String(deleteUnit.id), entity_label: name, collection: "Unit", payload: deleteUnit });
      await dbService.deleteUnit(deleteUnit.id);
    }
    const affected = printers.filter(p => p.unit_number === name);
    for (const p of affected) {
      await sendToRecycleBin({ entity: "Printer", entity_id: String(p.id), entity_label: p.printer_name, collection: "Printer", payload: p });
      await dbService.deletePrinter(p.id);
    }
    setDeleteUnit(null);
    await loadData();
    toast({ title: "Unit/Office deleted", description: name });
  };

  const openEditDept = (deptName: string) => {
    const d = findDeptByName(deptName, selectedUnit || "") || { id: null, name: deptName, unit: selectedUnit };
    setEditDept(d);
    setEditDeptName(d.name || deptName);
  };

  const handleUpdateDept = async () => {
    if (!editDept) return;
    const newName = editDeptName.trim();
    if (!newName) return;
    const oldName = editDept.name;
    const unit = editDept.unit || selectedUnit || "";
    if (newName.toLowerCase() !== oldName.toLowerCase() && departmentsList.some((d: any) => (d.name || "").toLowerCase() === newName.toLowerCase() && (d.unit || "").toLowerCase() === unit.toLowerCase())) {
      toast({ title: "Duplicate", description: "Department already exists in this unit.", variant: "destructive" });
      return;
    }
    if (editDept.id != null) {
      await dbService.updateDepartment(editDept.id, { name: newName, unit });
    }
    if (newName !== oldName) {
      const affected = printers.filter(p => p.unit_number === unit && p.department_name === oldName);
      for (const p of affected) {
        await dbService.updatePrinter(p.id, { ...p, department_name: newName });
      }
    }
    setEditDept(null);
    await loadData();
    toast({ title: "Department updated", description: newName });
  };

  const confirmDeleteDept = async () => {
    if (!deleteDept) return;
    const name = deleteDept.name;
    const unit = deleteDept.unit || selectedUnit || "";
    const { sendToRecycleBin } = await import("@/lib/recycleBin");
    if (deleteDept.id != null) {
      await sendToRecycleBin({ entity: "Printer Department", entity_id: String(deleteDept.id), entity_label: name, collection: "Department", payload: deleteDept });
      await dbService.deleteDepartment(deleteDept.id);
    }
    const affected = printers.filter(p => p.unit_number === unit && p.department_name === name);
    for (const p of affected) {
      await sendToRecycleBin({ entity: "Printer", entity_id: String(p.id), entity_label: p.printer_name, collection: "Printer", payload: p });
      await dbService.deletePrinter(p.id);
    }
    setDeleteDept(null);
    await loadData();
    toast({ title: "Department deleted", description: name });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ipTrim = (formData.ip_address || '').trim();
      const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(ipTrim);
      if (ipTrim && isIp) {
        const dup = printers.some(p =>
          (p.ip_address || '').trim().toLowerCase() === ipTrim.toLowerCase() &&
          p.id !== editingPrinter?.id
        );
        if (dup) {
          toast({ title: "Duplicate", description: "IP address already exists.", variant: "destructive" });
          return;
        }
      }
      if (editingPrinter) {
        await dbService.updatePrinter(editingPrinter.id, formData);
        toast({ title: "Printer updated", description: "Printer information has been updated successfully." });
      } else {
        await dbService.addPrinter(formData);
        toast({ title: "Printer added", description: "New printer has been added successfully." });
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error("Error saving printer:", error);
      toast({ title: "Save failed", description: (error as any)?.message || "Failed to save printer.", variant: "destructive" });
    }
  };

  const handleEdit = (printer: Printer) => {
    setEditingPrinter(printer);
    setPrinterType(/^\d{1,3}(\.\d{1,3}){3}$/.test(printer.ip_address?.trim() || '') ? 'network' : 'share');
    setFormData({
      printer_name: printer.printer_name,
      printer_model: printer.printer_model,
      ip_address: printer.ip_address,
      unit_number: printer.unit_number,
      department_name: printer.department_name,
      drive_link: (printer as any).drive_link || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (printer: Printer) => setDeleteTarget(printer);

  const copyToClipboard = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast({ title: `${label} copied`, description: value });
  };

  const openDriveLink = (url?: string) => {
    if (!url) return;
    const trimmed = url.trim();
    // Heuristic: treat as direct file if URL ends with a known driver/binary extension
    const isDirectFile = /\.(exe|msi|zip|rar|7z|dmg|pkg|deb|rpm|tar|gz|iso|inf|cab)(\?.*)?$/i.test(trimmed);
    if (isDirectFile) {
      const a = document.createElement('a');
      a.href = trimmed;
      a.download = '';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(trimmed, '_blank', 'noopener,noreferrer');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { sendToRecycleBin } = await import("@/lib/recycleBin");
    await sendToRecycleBin({ entity: "Printer", entity_id: String(deleteTarget.id), entity_label: deleteTarget.printer_name, collection: "Printer", payload: deleteTarget });
    await dbService.deletePrinter(deleteTarget.id);
    await loadData();
    toast({ title: "Printer deleted", description: "Printer has been deleted successfully." });
    setDeleteTarget(null);
  };

  const resetForm = () => {
    setFormData({
      printer_name: "",
      printer_model: "",
      ip_address: "",
      unit_number: selectedUnit || "",
      department_name: selectedDepartment || "",
      drive_link: "",
    });
    setEditingPrinter(null);
    setIsDialogOpen(false);
  };

  const getPrintersByUnit = () => {
    const unitGroups: { [key: string]: Printer[] } = {};
    const q = searchTerm.toLowerCase();
    const isNetwork = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test((ip || '').trim());
    const filtered = printers.filter(p => {
      if (unitFilter !== "all" && p.unit_number !== unitFilter) return false;
      if (deptFilter !== "all" && p.department_name !== deptFilter) return false;
      if (typeFilter === 'network' && !isNetwork(p.ip_address)) return false;
      if (typeFilter === 'share' && isNetwork(p.ip_address)) return false;
      if (!q) return true;
      return (
        p.printer_name?.toLowerCase().includes(q) ||
        p.printer_model?.toLowerCase().includes(q) ||
        p.ip_address?.toLowerCase().includes(q) ||
        p.unit_number?.toLowerCase().includes(q) ||
        p.department_name?.toLowerCase().includes(q)
      );
    });
    
    filtered.forEach(printer => {
      if (printer.unit_number) {
        if (!unitGroups[printer.unit_number]) {
          unitGroups[printer.unit_number] = [];
        }
        unitGroups[printer.unit_number].push(printer);
      }
    });
    // Include units that have no printer yet
    if (!searchTerm && unitFilter === "all" && deptFilter === "all" && !typeFilter) {
      unitsList.forEach((u: any) => {
        if (u.name && !unitGroups[u.name]) unitGroups[u.name] = [];
      });
    }
    return unitGroups;
  };

  const getDepartmentsByUnit = (unitName: string) => {
    const deptGroups: { [key: string]: Printer[] } = {};
    const filtered = searchTerm
      ? printers.filter(printer =>
          printer.unit_number === unitName &&
          (printer.printer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           printer.department_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : printers.filter(printer => printer.unit_number === unitName);
    
    filtered.forEach(printer => {
      if (printer.department_name) {
        if (!deptGroups[printer.department_name]) {
          deptGroups[printer.department_name] = [];
        }
        deptGroups[printer.department_name].push(printer);
      }
    });
    // Include departments that have no printer yet
    if (!searchTerm) {
      departmentsList
        .filter((d: any) => (d.unit || "").toLowerCase() === (unitName || "").toLowerCase())
        .forEach((d: any) => { if (d.name && !deptGroups[d.name]) deptGroups[d.name] = []; });
    }
    return deptGroups;
  };

  const getFilteredPrinters = () => {
    let filtered = printers;

    if (selectedUnit) {
      filtered = filtered.filter(printer => printer.unit_number === selectedUnit);
    }

    if (selectedDepartment) {
      filtered = filtered.filter(printer => printer.department_name === selectedDepartment);
    }

    if (searchTerm) {
      filtered = filtered.filter(printer =>
        Object.values(printer).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  };

  const handleExportData = () => {
    const data = getFilteredPrinters();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `printers_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "Printers data has been exported successfully." });
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
            for (const printer of data) {
              if (printer.printer_name) {
                await dbService.addPrinter(printer);
              }
            }
            await loadData();
            toast({ title: "Data imported", description: "Printers have been imported successfully." });
          }
        } catch (error) {
          toast({ title: "Import failed", description: "Failed to import data. Please check the file format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="unit_number">Unit/Office Name *</Label>
          <Input
            id="unit_number"
            value={formData.unit_number}
            onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
            placeholder="Type unit/office name"
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
          <Label htmlFor="printer_name">Printer Name *</Label>
          <Input
            id="printer_name"
            value={formData.printer_name}
            onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="printer_model">Printer Model *</Label>
          <Input
            id="printer_model"
            value={formData.printer_model}
            onChange={(e) => setFormData({ ...formData, printer_model: e.target.value })}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label>Printer Type *</Label>
          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrinterType('network')}
              className={`flex-1 border-2 ${printerType === 'network' ? 'border-primary bg-primary/10 text-primary' : 'border-primary/30 text-muted-foreground'}`}
            >
              Network Printer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrinterType('share')}
              className={`flex-1 border-2 ${printerType === 'share' ? 'border-primary bg-primary/10 text-primary' : 'border-primary/30 text-muted-foreground'}`}
            >
              Share Printer
            </Button>
          </div>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="ip_address">
            {printerType === 'network' ? 'IP Address *' : 'Share Path / Name *'}
          </Label>
          <Input
            id="ip_address"
            type="text"
            value={formData.ip_address}
            onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            placeholder={printerType === 'network' ? '192.168.1.100' : '\\\\server\\printer or shared name'}
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="drive_link">Drive Link (Driver Download URL)</Label>
          <Input
            id="drive_link"
            type="url"
            value={formData.drive_link}
            onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })}
            placeholder="https://example.com/driver.exe or driver page URL"
          />
          <p className="text-xs text-muted-foreground mt-1">
            If the link points directly to a driver file, clicking will auto-download; otherwise the website will open.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
          {editingPrinter ? "Update" : "Add"} Printer
        </Button>
      </DialogFooter>
    </form>
  );

  const printersByUnit = getPrintersByUnit();

  const unitDeptDialogs = (
    <>
      <Dialog open={!!editUnit} onOpenChange={(o) => !o && setEditUnit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Unit/Office</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit_unit_name_p">Unit/Office Name *</Label>
              <Input id="edit_unit_name_p" value={editUnitName} onChange={(e) => setEditUnitName(e.target.value)} autoFocus />
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
            <DialogDescription>Under Unit/Office: <span className="font-semibold text-primary">{editDept?.unit || selectedUnit}</span></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit_dept_name_p">Department Name *</Label>
              <Input id="edit_dept_name_p" value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)} autoFocus />
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
              "{deleteUnit?.name}" and all its printers will be permanently removed.
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
              "{deleteDept?.name}" and all its printers will be permanently removed.
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

  // Unit view
  if (!selectedUnit) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              Printers Management
            </h1>
            <p className="text-muted-foreground mt-2">Select a unit to view printers</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => {
              const printWindow = window.open("", "_blank", "width=900,height=700");
              if (!printWindow) return;
              
              const rows = printers.map((printer: any, idx: number) => `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td><td style="border: 1px solid #ddd; padding: 8px;">${printer.printer_name}</td><td style="border: 1px solid #ddd; padding: 8px;">${printer.printer_model}</td><td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${printer.ip_address}</td><td style="border: 1px solid #ddd; padding: 8px;">${printer.unit_number}</td><td style="border: 1px solid #ddd; padding: 8px;">${printer.department_name}</td></tr>`).join('');
              
              const content = `<!DOCTYPE html><html><head><title>Printers List</title><style>@page { size: A4; margin: 8mm; } @media print { html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } } body { font-family: Arial, sans-serif; margin: 0; padding: 15px; } .header { text-align: center; margin-bottom: 20px; } .header img { height: 50px; display: block; margin: 0 auto 10px; } .header h1 { color: #0284c7; margin: 0; } .header p { color: #666; margin: 5px 0; } table { width: 100%; border-collapse: collapse; margin-top: 15px; } th { background: linear-gradient(135deg, #0284c7, #0369a1); color: white; padding: 10px; border: 1px solid #ddd; text-align: left; } td { padding: 8px; } tr:nth-child(even) { background: #f0f9ff; }</style></head><body><div class="header"><img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" /><h1>MNR Group IT</h1><p>Printers Directory</p></div><table><thead><tr><th style="width: 40px;">SL</th><th>Printer Name</th><th>Model</th><th>IP Address</th><th>Unit/Office</th><th>Department</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
              
              printWindow.document.open();
              printWindow.document.write(content);
              printWindow.document.close();
              printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
            }} className="border-primary/30 text-primary hover:bg-primary/10">
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('printer-import-file')?.click()} className="border-primary/30 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input id="printer-import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
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
                  <DialogDescription>Create a new unit/office folder</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label htmlFor="unit_name_new">Unit/Office Name *</Label>
                    <Input
                      id="unit_name_new"
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
              searchPlaceholder="Search by printer name, model, IP/share, unit, or department..."
              filters={[
                {
                  value: unitFilter,
                  onChange: (v) => { setUnitFilter(v); setDeptFilter("all"); },
                  options: [
                    { value: "all", label: "All Units/Offices" },
                    ...Array.from(new Set(printers.map(p => p.unit_number).filter(Boolean)))
                      .sort()
                      .map(u => ({ value: u, label: u })),
                  ],
                  placeholder: "Unit/Office",
                },
                {
                  value: deptFilter,
                  onChange: setDeptFilter,
                  options: [
                    { value: "all", label: "All Departments" },
                    ...Array.from(new Set(
                      printers
                        .filter(p => unitFilter === "all" || p.unit_number === unitFilter)
                        .map(p => p.department_name)
                        .filter(Boolean)
                    ))
                      .sort()
                      .map(d => ({ value: d, label: d })),
                  ],
                  placeholder: "Department",
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Stats */}
        {(() => {
          const isNetwork = (ip: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test((ip || '').trim());
          const networkCount = printers.filter(p => isNetwork(p.ip_address)).length;
          const shareCount = printers.length - networkCount;
          return (
            <div className="flex flex-wrap gap-2">
              <Card
                onClick={() => setShowAllPrinters((v) => !v)}
                className="inline-flex w-auto cursor-pointer bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary hover:bg-primary/15 transition-colors"
                title={showAllPrinters ? "Hide printer details" : "Click to view all printer details"}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <PrinterIcon className="h-5 w-5 text-primary" />
                    <p className="text-xs text-muted-foreground">Total Printers</p>
                    <p className="text-base font-bold text-primary">{printers.length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                onClick={() => setTypeFilter(t => t === 'network' ? null : 'network')}
                className={`inline-flex w-auto cursor-pointer border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 hover:bg-primary/15 transition-colors ${typeFilter === 'network' ? 'ring-2 ring-primary/50' : ''}`}
                title={typeFilter === 'network' ? 'Hide Network printers' : 'Click to view Network printers'}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <PrinterIcon className="h-5 w-5 text-primary" />
                    <p className="text-xs text-muted-foreground">Network Printers</p>
                    <p className="text-base font-bold text-primary">{networkCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card
                onClick={() => setTypeFilter(t => t === 'share' ? null : 'share')}
                className={`inline-flex w-auto cursor-pointer border-2 border-success bg-gradient-to-br from-success/10 to-success/5 hover:bg-success/15 transition-colors ${typeFilter === 'share' ? 'ring-2 ring-success/50' : ''}`}
                title={typeFilter === 'share' ? 'Hide Share printers' : 'Click to view Share printers'}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <PrinterIcon className="h-5 w-5 text-success" />
                    <p className="text-xs text-muted-foreground">Share Printers</p>
                    <p className="text-base font-bold text-success">{shareCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {(showAllPrinters || typeFilter || searchTerm || unitFilter !== "all" || deptFilter !== "all") ? (
            Object.values(printersByUnit).flat().map((printer) => (
              <Card key={printer.id} className="animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle
                        className="text-lg text-primary cursor-pointer hover:underline"
                        title="Click to copy printer name"
                        onClick={() => copyToClipboard(printer.printer_name, "Printer name")}
                      >
                        {printer.printer_name}
                      </CardTitle>
                      <CardDescription
                        className="cursor-pointer hover:underline"
                        title="Click to copy printer model"
                        onClick={() => copyToClipboard(printer.printer_model, "Printer model")}
                      >
                        {printer.printer_model}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {(printer as any).drive_link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); openDriveLink((printer as any).drive_link); }}
                          title="Open driver link"
                          className="gap-1 h-7 px-2"
                        >
                          <Link2 className="h-3 w-3" />
                          <span className="text-xs font-medium">Drive</span>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" title="Actions">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <PermGate action="edit">
                            <DropdownMenuItem onClick={() => handleEdit(printer)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          </PermGate>
                          <PermGate action="delete">
                            <DropdownMenuItem onClick={() => handleDelete(printer)} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </PermGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm"><span className="font-semibold">IP/Share:</span>{" "}
                    <span
                      className="text-primary cursor-pointer hover:underline"
                      title="Click to copy IP / Share"
                      onClick={() => copyToClipboard(printer.ip_address, "IP / Share")}
                    >{printer.ip_address}</span>
                  </div>
                  <div className="text-sm"><span className="font-semibold">Unit/Office:</span> <span className="text-success">{printer.unit_number}</span></div>
                  <div className="text-sm"><span className="font-semibold">Department:</span> <span className="text-success">{printer.department_name}</span></div>
                </CardContent>
              </Card>
            ))
          ) : (
            Object.entries(printersByUnit).map(([unitName, unitPrinters]) => {
              const deptGroups = getDepartmentsByUnit(unitName);
              return (
                <Card 
                  key={unitName} 
                  className="cursor-pointer animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-primary"
                  onClick={() => setSelectedUnit(unitName)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-primary flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          <span className="truncate">{unitName}</span>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <PrinterIcon className="h-4 w-4" />
                            {unitPrinters.length} Printers
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {Object.keys(deptGroups).length} Departments
                          </span>
                        </CardDescription>
                      </div>
                      <PermGate action="edit">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditUnit(unitName); }}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteUnit(findUnitByName(unitName) || { id: null, name: unitName }); }}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </PermGate>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-lg">{unitPrinters.length}</Badge>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {Object.keys(printersByUnit).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <PrinterIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No units/offices found</h3>
              <p className="text-muted-foreground">Add a unit/office to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Printer edit dialog (used when editing from all-printers grid) */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPrinter ? "Edit Printer" : "Add New Printer"}</DialogTitle>
              <DialogDescription>Fill in the printer details</DialogDescription>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>

        {unitDeptDialogs}
      </div>
    );
  }

  // Department view
  if (selectedUnit && !selectedDepartment) {
    const deptGroups = getDepartmentsByUnit(selectedUnit);

    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedUnit(null); setSearchTerm(""); }}
              aria-label="Back to Units"
              title="Back to Units"
              className="mb-4 border-2 border-primary text-primary bg-transparent hover:bg-primary/15 hover:text-primary hover:border-primary hover:ring-2 hover:ring-primary/40 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {selectedUnit} - Departments
            </h1>
            <p className="text-muted-foreground mt-2">Select a department to view printers</p>
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
                <DialogDescription>Under Unit/Office: <span className="font-semibold text-primary">{selectedUnit}</span></DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Unit/Office</Label>
                  <Input value={selectedUnit || ""} disabled className="bg-muted" />
                </div>
                <div>
                  <Label htmlFor="dept_name_new">Department Name *</Label>
                  <Input
                    id="dept_name_new"
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
              searchPlaceholder="Search by name, model or IP/share..."
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Object.entries(deptGroups).map(([deptName, deptPrinters]) => (
            <Card 
              key={deptName} 
              className="cursor-pointer animate-scale-in bg-gradient-to-br from-card to-card/80 border-2 border-primary"
              onClick={() => setSelectedDepartment(deptName)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Badge className="w-fit mb-2">{deptPrinters.length} Printers</Badge>
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
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDept(findDeptByName(deptName, selectedUnit || "") || { id: null, name: deptName, unit: selectedUnit }); }}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PermGate>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {Object.keys(deptGroups).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No departments found</h3>
              <p className="text-muted-foreground">Add a department to get started</p>
            </CardContent>
          </Card>
        )}
        {unitDeptDialogs}
      </div>
    );
  }

  // Printer details view
  const filteredPrinters = getFilteredPrinters();

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
            {selectedUnit} - {selectedDepartment}
          </h1>
          <p className="text-muted-foreground mt-2">{filteredPrinters.length} printers</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <PermGate action="add">
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  setFormData(prev => ({ ...prev, unit_number: selectedUnit, department_name: selectedDepartment }));
                }}
                className="bg-transparent border-2 border-primary text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Printer
              </Button>
            </DialogTrigger>
          </PermGate>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPrinter ? "Edit Printer" : "Add New Printer"}</DialogTitle>
              <DialogDescription>Fill in the printer details</DialogDescription>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search by name, model or IP/share..."
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filteredPrinters.map((printer) => (
          <Card key={printer.id} className="animate-slide-up bg-gradient-to-br from-card to-card/80 border-2 border-primary">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle
                    className="text-lg text-primary cursor-pointer hover:underline"
                    title="Click to copy printer name"
                    onClick={() => copyToClipboard(printer.printer_name, "Printer name")}
                  >
                    {printer.printer_name}
                  </CardTitle>
                  <CardDescription
                    className="cursor-pointer hover:underline"
                    title="Click to copy printer model"
                    onClick={() => copyToClipboard(printer.printer_model, "Printer model")}
                  >
                    {printer.printer_model}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  {(printer as any).drive_link && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openDriveLink((printer as any).drive_link); }}
                      title="Open driver link"
                      className="gap-1 h-7 px-2"
                    >
                      <Link2 className="h-3 w-3" />
                      <span className="text-xs font-medium">Drive</span>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" title="Actions">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <PermGate action="edit">
                        <DropdownMenuItem onClick={() => handleEdit(printer)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                      </PermGate>
                      <PermGate action="delete">
                        <DropdownMenuItem onClick={() => handleDelete(printer)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </PermGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">
                <span className="font-semibold">IP/Share:</span>{" "}
                <span
                  className="text-primary cursor-pointer hover:underline"
                  title="Click to copy IP / Share"
                  onClick={() => copyToClipboard(printer.ip_address, "IP / Share")}
                >{printer.ip_address}</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold">Department:</span>{" "}
                <span className="text-success">{printer.department_name}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPrinters.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <PrinterIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No printers found</h3>
            <p className="text-muted-foreground">Add printers to this department</p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-2 border-destructive bg-gradient-to-br from-card to-card/80 shadow-xl rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
              <Trash2 className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-destructive">Delete Printer?</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.printer_name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2">
            <AlertDialogCancel className="border-2 border-primary text-primary hover:bg-primary/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="border-2 border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Printers;
