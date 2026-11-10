import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Phone, Plus, Edit, Trash2, Download, ArrowLeft, Building2, Users, ChevronRight, Upload, Printer, ExternalLink } from "lucide-react";
import dbService from "@/services/dbService";
import SearchFilter from "@/components/SearchFilter";
import IPPhonePrintCard from "@/components/IPPhonePrintCard";
import PermGate from "@/components/PermGate";

interface IPPhone {
  id: number;
  sl_no: number;
  extension_number: string;
  ip_address: string;
  user_name: string;
  designation: string;
  department_name: string;
  office_name: string;
  phone_model: string;
  status: string;
  added_date: string;
}

const IPPhoneList = () => {
  const { toast } = useToast();
  const [ipPhones, setIpPhones] = useState<IPPhone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<IPPhone | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [formData, setFormData] = useState({
    extension_number: "",
    ip_address: "",
    user_name: "",
    designation: "",
    department_name: "",
    office_name: "",
    phone_model: "",
    status: "active",
  });

  // Print color theme options
  const [printTheme, setPrintTheme] = useState(() => {
    const saved = localStorage.getItem('ipphone_print_theme');
    return saved || 'blue';
  });
  
  const printThemes = {
    blue: { primary: '#0066cc', secondary: '#cce5ff', text: '#0066cc' },
    green: { primary: '#059669', secondary: '#d1fae5', text: '#047857' },
    purple: { primary: '#7c3aed', secondary: '#ede9fe', text: '#6d28d9' },
    orange: { primary: '#ea580c', secondary: '#ffedd5', text: '#c2410c' },
    red: { primary: '#dc2626', secondary: '#fee2e2', text: '#b91c1c' },
    teal: { primary: '#0d9488', secondary: '#ccfbf1', text: '#0f766e' },
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const phonesData = await dbService.getIPPhones();
    setIpPhones(phonesData || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPhone) {
        await dbService.updateIPPhone(editingPhone.id, formData);
        toast({ title: "IP Phone updated", description: "IP Phone has been updated successfully." });
      } else {
        await dbService.addIPPhone(formData);
        toast({ title: "IP Phone added", description: "New IP Phone has been added successfully." });
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error("Error saving IP Phone:", error);
      toast({ title: "Error", description: "Failed to save IP Phone.", variant: "destructive" });
    }
  };

  const handleEdit = (phone: IPPhone) => {
    setEditingPhone(phone);
    setFormData({
      extension_number: phone.extension_number || "",
      ip_address: phone.ip_address || "",
      user_name: phone.user_name,
      designation: phone.designation,
      department_name: phone.department_name,
      office_name: phone.office_name,
      phone_model: phone.phone_model || "",
      status: phone.status || "active",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this IP Phone?")) {
      await dbService.deleteIPPhone(id);
      await loadData();
      toast({ title: "IP Phone deleted", description: "IP Phone has been deleted successfully." });
    }
  };

  const resetForm = () => {
    setFormData({
      extension_number: "",
      ip_address: "",
      user_name: "",
      designation: "",
      department_name: selectedDepartment || "",
      office_name: selectedOffice || "",
      phone_model: "",
      status: "active",
    });
    setEditingPhone(null);
    setIsDialogOpen(false);
  };

  const getPhonesByOffice = () => {
    const officeGroups: { [key: string]: IPPhone[] } = {};
    const filtered = searchTerm
      ? ipPhones.filter(phone =>
          phone.extension_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.office_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : ipPhones;
    
    filtered.forEach((phone) => {
      if (phone.office_name) {
        if (!officeGroups[phone.office_name]) {
          officeGroups[phone.office_name] = [];
        }
        officeGroups[phone.office_name].push(phone);
      }
    });
    return officeGroups;
  };

  const getDepartmentsByOffice = (officeName: string) => {
    const officePhones = ipPhones.filter((phone) => phone.office_name === officeName);
    const filtered = searchTerm
      ? officePhones.filter(phone =>
          phone.extension_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : officePhones;
    
    const deptGroups: { [key: string]: IPPhone[] } = {};
    filtered.forEach((phone) => {
      if (phone.department_name) {
        if (!deptGroups[phone.department_name]) {
          deptGroups[phone.department_name] = [];
        }
        deptGroups[phone.department_name].push(phone);
      }
    });
    return deptGroups;
  };

  const getFilteredPhones = () => {
    let filtered = ipPhones;

    if (selectedOffice) {
      filtered = filtered.filter((phone) => phone.office_name === selectedOffice);
    }

    if (selectedDepartment) {
      filtered = filtered.filter((phone) => phone.department_name === selectedDepartment);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (phone) =>
          phone.extension_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.department_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          phone.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((phone) => phone.status === filterStatus);
    }

    return filtered;
  };

  const handleExportData = () => {
    const data = getFilteredPhones();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ip_phones_${selectedOffice || "all"}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "IP Phones data has been exported successfully." });
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
            for (const phone of data) {
              if (phone.extension_number && phone.user_name) {
                await dbService.addIPPhone(phone);
              }
            }
            await loadData();
            toast({ title: "Data imported", description: "IP Phones have been imported successfully." });
          }
        } catch (error) {
          toast({ title: "Import failed", description: "Failed to import data. Please check the file format.", variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePrint = () => {
    // Save theme preference
    localStorage.setItem('ipphone_print_theme', printTheme);
    
    const theme = printThemes[printTheme as keyof typeof printThemes];
    
    // Open a new window for printing IP Phone list
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    // Group phones by office
    const phonesToPrint = getFilteredPhones();
    const groupedByOffice: { [key: string]: typeof phonesToPrint } = {};
    
    phonesToPrint.forEach(phone => {
      const office = phone.office_name || 'Unknown Office';
      if (!groupedByOffice[office]) {
        groupedByOffice[office] = [];
      }
      groupedByOffice[office].push(phone);
    });

    const officeEntries = Object.entries(groupedByOffice);
    const officesPerPage = 5;
    const pages: [string, typeof phonesToPrint][][] = [];
    
    for (let i = 0; i < officeEntries.length; i += officesPerPage) {
      pages.push(officeEntries.slice(i, i + officesPerPage) as [string, typeof phonesToPrint][]);
    }

    const pagesHtml = pages.map((pageOffices, pageIndex) => {
      const officesHtml = pageOffices.map(([office, phones]) => {
      const rowsHtml = phones.map((phone, index) => `
          <tr>
            <td style="border: 1px solid #ccc; padding: 1px 2px; text-align: center; font-size: 7px; font-weight: bold; color: ${theme.text};">${index + 1}</td>
            <td style="border: 1px solid #ccc; padding: 1px 2px; font-weight: bold; color: ${theme.text}; font-size: 7px;">${phone.extension_number}</td>
            <td style="border: 1px solid #ccc; padding: 1px 2px; font-size: 6.5px; line-height: 1.2; word-break: break-word;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="font-weight: 500;">${phone.user_name}</div>
                ${phone.department_name ? `<div style="font-size: 5.5px; color: ${theme.text}; font-weight: bold; text-align: right;">${phone.department_name}</div>` : ''}
              </div>
              ${phone.designation ? `<div style="font-size: 5.5px; color: #666;">${phone.designation}</div>` : ''}
            </td>
          </tr>
        `).join('');

        return `
          <div style="page-break-inside: avoid;">
            <div style="background-color: ${theme.primary}; color: white; padding: 3px 4px; font-size: 8px; font-weight: bold; border-radius: 2px 2px 0 0; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${office}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 7px; table-layout: fixed;">
              <thead>
                <tr style="background-color: ${theme.secondary};">
                  <th style="border: 1px solid #999; padding: 2px; width: 18px; font-size: 6px; font-weight: bold;">SL</th>
                  <th style="border: 1px solid #999; padding: 2px; width: 28px; font-size: 6px; font-weight: bold;">Ext.</th>
                  <th style="border: 1px solid #999; padding: 2px; font-size: 6px; font-weight: bold;">User / Dept</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      }).join('');

      return `
        <div style="width: 210mm; min-height: 297mm; padding: 3mm 2mm; box-sizing: border-box; page-break-after: ${pageIndex < pages.length - 1 ? 'always' : 'auto'};">
          <div style="text-align: center; margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 2px solid ${theme.primary};">
            <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR Group Logo" style="height: 45px; width: auto; display: block; margin: 0 auto 6px auto;" />
            <h1 style="font-size: 16px; font-weight: bold; color: ${theme.primary}; margin: 0;">MNR Group IT</h1>
            <p style="font-size: 11px; color: #444; margin: 2px 0;">IP Phone Extension Directory</p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5mm; font-size: 7px;">
            ${officesHtml}
          </div>
        </div>
      `;
    }).join('');

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>IP Phone Extension List</title>
          <style>
            @page { size: A4; margin: 0; }
            @media print {
              html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; }
          </style>
        </head>
        <body>${pagesHtml}</body>
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

  const phonesByOffice = getPhonesByOffice();

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="office_name">Office Name *</Label>
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
          <Label htmlFor="extension_number">Extension Number *</Label>
          <Input
            id="extension_number"
            value={formData.extension_number}
            onChange={(e) => setFormData({ ...formData, extension_number: e.target.value })}
            placeholder="e.g., 1001"
            required
          />
        </div>
        <div>
          <Label htmlFor="ip_address">IP Address</Label>
          <Input
            id="ip_address"
            value={formData.ip_address}
            onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            placeholder="e.g., 192.168.1.100"
          />
        </div>
        <div>
          <Label htmlFor="user_name">User Name *</Label>
          <Input
            id="user_name"
            value={formData.user_name}
            onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            value={formData.designation}
            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="phone_model">Phone Model</Label>
          <Input
            id="phone_model"
            value={formData.phone_model}
            onChange={(e) => setFormData({ ...formData, phone_model: e.target.value })}
            placeholder="e.g., Cisco 7841"
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
          {editingPhone ? "Update" : "Add"} IP Phone
        </Button>
      </DialogFooter>
    </form>
  );

  // Level 1: Office Selection
  if (!selectedOffice) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              IP Phone Lists
            </h1>
            <p className="text-muted-foreground mt-2">Select an office to view IP phones</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Print Theme Selector */}
            <Select value={printTheme} onValueChange={setPrintTheme}>
              <SelectTrigger className="w-32 border-primary/30">
                <SelectValue placeholder="Theme" />
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
            <Button variant="outline" onClick={handlePrint} className="border-primary/30 text-primary hover:bg-primary/10 no-print">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('phone-import-file')?.click()} className="border-primary/30 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input id="phone-import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
            <Button asChild className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-2 border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50 ring-2 ring-primary/40 animate-pulse-slow font-bold"><a href="https://mnriplist.netlify.app" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />IP App</a></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <PermGate action="add">
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
                    <Plus className="h-4 w-4 mr-2" />
                    Add IP Phone
                  </Button>
                </DialogTrigger>
              </PermGate>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingPhone ? "Edit IP Phone" : "Add New IP Phone"}</DialogTitle>
                  <DialogDescription>Fill in the IP phone details</DialogDescription>
                </DialogHeader>
                {renderForm()}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* IP Phone Print Card - Hidden until print */}
        <div id="ip-phone-print-content" className="hidden print:block">
          <IPPhonePrintCard phones={ipPhones} />
        </div>

        {/* Search Filter */}
        <Card className="border-primary/20 no-print">
          <CardContent className="p-4">
            <SearchFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search IP phones by extension, user, office, or department..."
              filters={[
                {
                  value: filterStatus,
                  onChange: setFilterStatus,
                  placeholder: "Filter by status",
                  options: [
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "maintenance", label: "Maintenance" },
                  ],
                },
              ]}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Object.entries(phonesByOffice).map(([officeName, officePhones]) => {
            const deptGroups = getDepartmentsByOffice(officeName);
            const displayPhones = officePhones.slice(0, 3);
            const hasMore = officePhones.length > 3;

            return (
              <Card
                key={officeName}
                className="cursor-pointer animate-slide-up bg-transparent border-2 border-primary hover:border-primary/70 transition-colors"
                onClick={() => setSelectedOffice(officeName)}
              >
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="text-primary flex items-center gap-2 text-sm sm:text-lg">
                    <Building2 className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    <span className="truncate">{officeName}</span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-3 text-[11px] sm:text-sm">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
                      {officePhones.length} Ext
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                      {Object.keys(deptGroups).length} Dept
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 p-3 sm:p-4 pt-0">
                  {displayPhones.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-1.5 sm:p-2">
                      <div>
                        <span className="font-bold text-primary text-xs sm:text-base">{phone.extension_number}</span>
                        <span className="text-[11px] sm:text-sm text-muted-foreground ml-2">{phone.user_name}</span>
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="text-center text-sm text-primary font-medium">
                      +{officePhones.length - 3} more
                    </div>
                  )}
                  <div className="flex items-center justify-end text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {Object.keys(phonesByOffice).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No IP phones found</h3>
              <p className="text-muted-foreground">Add your first IP phone to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Level 2: Department Selection
  if (!selectedDepartment) {
    const deptGroups = getDepartmentsByOffice(selectedOffice);

    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => { setSelectedOffice(null); setSearchTerm(""); }}
              className="mb-4 border-2 border-primary text-primary hover:bg-primary/10 shadow-md shadow-primary/20"
              title="Back to Offices"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {selectedOffice} - Departments
            </h1>
            <p className="text-muted-foreground mt-2">Select a department to view extensions</p>
          </div>
          <Button asChild className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-2 border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50 ring-2 ring-primary/40 animate-pulse-slow font-bold"><a href="https://mnriplist.netlify.app" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />IP App</a></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <PermGate action="add">
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setFormData((prev) => ({ ...prev, office_name: selectedOffice }));
                  }}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add IP Phone
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPhone ? "Edit IP Phone" : "Add New IP Phone"}</DialogTitle>
                <DialogDescription>Fill in the IP phone details</DialogDescription>
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
              searchPlaceholder="Search IP phones..."
              filters={[
                {
                  value: filterStatus,
                  onChange: setFilterStatus,
                  placeholder: "Filter by status",
                  options: [
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "maintenance", label: "Maintenance" },
                  ],
                },
              ]}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Object.entries(deptGroups).map(([deptName, deptPhones]) => {
            const displayPhones = deptPhones.slice(0, 3);
            const hasMore = deptPhones.length > 3;

            return (
              <Card
                key={deptName}
                className="cursor-pointer perspective-1000 hover-lift glow-effect animate-scale-in border-primary/20"
                onClick={() => setSelectedDepartment(deptName)}
              >
                <CardHeader className="p-3 sm:p-4">
                  <Badge className="w-fit mb-2 text-[10px] sm:text-xs">{deptPhones.length} Ext</Badge>
                  <CardTitle className="text-primary text-sm sm:text-lg truncate">{deptName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-3 sm:p-4 pt-0">
                  {displayPhones.map((phone) => (
                    <div key={phone.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-1.5 sm:p-2">
                      <div>
                        <span className="font-bold text-primary text-xs sm:text-base">{phone.extension_number}</span>
                        <span className="text-[11px] sm:text-sm text-muted-foreground ml-2">{phone.user_name}</span>
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="text-center text-sm text-primary font-medium">
                      +{deptPhones.length - 3} more
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {Object.keys(deptGroups).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No departments found</h3>
              <p className="text-muted-foreground">Add IP phones to create departments</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Level 3: Phone Details
  const filteredPhones = getFilteredPhones();

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { setSelectedDepartment(null); setSearchTerm(""); }}
            className="mb-4 border-2 border-primary text-primary hover:bg-primary/10 shadow-md shadow-primary/20"
            title="Back to Departments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {selectedOffice} - {selectedDepartment}
          </h1>
          <p className="text-muted-foreground mt-2">{filteredPhones.length} extensions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handlePrint} className="border-primary/30 text-primary hover:bg-primary/10">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button asChild className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground border-2 border-primary shadow-lg shadow-primary/30 hover:shadow-primary/50 ring-2 ring-primary/40 animate-pulse-slow font-bold"><a href="https://mnriplist.netlify.app" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />IP App</a></Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <PermGate action="add">
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setFormData((prev) => ({ ...prev, office_name: selectedOffice, department_name: selectedDepartment }));
                  }}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add IP Phone
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPhone ? "Edit IP Phone" : "Add New IP Phone"}</DialogTitle>
                <DialogDescription>Fill in the IP phone details</DialogDescription>
              </DialogHeader>
              {renderForm()}
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
            searchPlaceholder="Search extensions, users, or IP..."
            filters={[
              {
                value: filterStatus,
                onChange: setFilterStatus,
                placeholder: "Filter by status",
                options: [
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "maintenance", label: "Maintenance" },
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">SL</TableHead>
                  <TableHead className="font-semibold">Extension</TableHead>
                  <TableHead className="font-semibold">IP Address</TableHead>
                  <TableHead className="font-semibold">User Name</TableHead>
                  <TableHead className="font-semibold">Designation</TableHead>
                  <TableHead className="font-semibold">Phone Model</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPhones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No IP phones found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPhones.map((phone, index) => (
                    <TableRow key={phone.id} className="hover:bg-muted/30">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-bold text-primary">{phone.extension_number}</TableCell>
                      <TableCell className="text-primary">{phone.ip_address || "-"}</TableCell>
                      <TableCell>{phone.user_name}</TableCell>
                      <TableCell>{phone.designation || "-"}</TableCell>
                      <TableCell>{phone.phone_model || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={phone.status === "active" ? "default" : phone.status === "inactive" ? "secondary" : "outline"}
                        >
                          {phone.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <PermGate action="edit">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(phone)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </PermGate>
                          <PermGate action="delete">
                            <Button size="sm" variant="outline" onClick={() => handleDelete(phone.id)} className="text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </PermGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IPPhoneList;
