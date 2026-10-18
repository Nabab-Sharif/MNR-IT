import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, Edit, Trash2, Download, ArrowLeft, Building2, Users, Upload, Printer, Calendar, AlertTriangle, CheckCircle, Server, Eye, X } from "lucide-react";
import dbService from "@/services/dbService";
import SearchFilter from "@/components/SearchFilter";
import CCTVPrintCard from "@/components/CCTVPrintCard";
import PermGate from "@/components/PermGate";

interface CCTVCamera {
  id: number;
  serial_number: string;
  camera_name: string;
  location: string;
  unit_number: string;
  department_name: string;
  status: string;
  added_date: string;
  issues: Array<{
    date: string;
    description: string;
    resolved: boolean;
  }>;
}

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
}

interface NVR {
  id: number;
  nvr_number: string;
  name: string;
  total_cameras: number;
  cameras: NVRCamera[];
  created_at: string;
}

interface CameraIssue {
  nvr_number: string;
  nvr_id: number;
  camera_id: string;
  date: string;
  issue_type: string;
  location: string;
}

const CCTVList = () => {
  const { toast } = useToast();
  const [cameras, setCameras] = useState<CCTVCamera[]>([]);
  const [nvrs, setNvrs] = useState<NVR[]>([]);
  const [checklists, setChecklists] = useState<DailyChecklist[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isIssuesViewOpen, setIsIssuesViewOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CCTVCamera | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<CCTVCamera | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    serial_number: "",
    camera_name: "",
    location: "",
    unit_number: "",
    department_name: "",
    status: "active",
  });

  const [issueFormData, setIssueFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const cctvData = await dbService.getCCTVCameras();
    const nvrsData = await dbService.getNVRs();
    const checklistsData = await dbService.getCCTVChecklists();
    setCameras(cctvData || []);
    setNvrs(nvrsData || []);
    setChecklists(checklistsData || []);
  };

  // Calculate NVR stats from checklists
  const getNVRStats = () => {
    let totalCameras = 0;
    let okCameras = 0;
    let notOkCameras = 0;
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
      if (!seenCameras.has(key)) {
        seenCameras.add(key);
        uniqueIssues.push(issue);
      }
    });

    return {
      totalNVRCameras: totalCameras,
      withIssues: uniqueIssues.length,
      issues: uniqueIssues,
    };
  };

  const nvrStats = getNVRStats();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCamera) {
        await dbService.updateCCTVCamera(editingCamera.id, formData);
        toast({ title: "Camera updated", description: "CCTV camera information has been updated successfully." });
      } else {
        await dbService.addCCTVCamera({ ...formData, issues: [] });
        toast({ title: "Camera added", description: "New CCTV camera has been added successfully." });
      }
      
      await loadData();
      resetForm();
    } catch (error) {
      console.error("Error saving camera:", error);
      toast({ title: "Error", description: "Failed to save camera.", variant: "destructive" });
    }
  };

  const handleAddIssue = async () => {
    if (!selectedCamera || !issueFormData.description) return;

    const updatedIssues = [
      ...(selectedCamera.issues || []),
      { ...issueFormData, resolved: false }
    ];

    await dbService.updateCCTVCamera(selectedCamera.id, { issues: updatedIssues });
    await loadData();
    setIsIssueDialogOpen(false);
    setIssueFormData({ date: new Date().toISOString().split("T")[0], description: "" });
    toast({ title: "Issue added", description: "Camera issue has been recorded." });
  };

  const handleResolveIssue = async (cameraId: number, issueIndex: number) => {
    const camera = cameras.find(c => c.id === cameraId);
    if (!camera) return;

    const updatedIssues = camera.issues.map((issue, idx) =>
      idx === issueIndex ? { ...issue, resolved: true } : issue
    );

    await dbService.updateCCTVCamera(cameraId, { issues: updatedIssues });
    await loadData();
    toast({ title: "Issue resolved", description: "Camera issue has been marked as resolved." });
  };

  const handleEdit = (camera: CCTVCamera) => {
    setEditingCamera(camera);
    setFormData({
      serial_number: camera.serial_number,
      camera_name: camera.camera_name,
      location: camera.location,
      unit_number: camera.unit_number,
      department_name: camera.department_name,
      status: camera.status,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this camera?")) {
      await dbService.deleteCCTVCamera(id);
      await loadData();
      toast({ title: "Camera deleted", description: "CCTV camera has been deleted successfully." });
    }
  };

  const resetForm = () => {
    setFormData({
      serial_number: "",
      camera_name: "",
      location: "",
      unit_number: selectedUnit || "",
      department_name: selectedDepartment || "",
      status: "active",
    });
    setEditingCamera(null);
    setIsDialogOpen(false);
  };

  const getCamerasByUnit = () => {
    const unitGroups: { [key: string]: CCTVCamera[] } = {};
    const filtered = searchTerm
      ? cameras.filter(camera =>
          camera.camera_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          camera.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          camera.unit_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          camera.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : cameras;
    
    filtered.forEach(camera => {
      if (camera.unit_number) {
        if (!unitGroups[camera.unit_number]) {
          unitGroups[camera.unit_number] = [];
        }
        unitGroups[camera.unit_number].push(camera);
      }
    });
    return unitGroups;
  };

  const getDepartmentsByUnit = (unitName: string) => {
    const deptGroups: { [key: string]: CCTVCamera[] } = {};
    const filtered = searchTerm
      ? cameras.filter(camera =>
          camera.unit_number === unitName &&
          (camera.camera_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           camera.department_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      : cameras.filter(camera => camera.unit_number === unitName);
    
    filtered.forEach(camera => {
      if (camera.department_name) {
        if (!deptGroups[camera.department_name]) {
          deptGroups[camera.department_name] = [];
        }
        deptGroups[camera.department_name].push(camera);
      }
    });
    return deptGroups;
  };

  const getFilteredCameras = () => {
    let filtered = cameras;

    if (selectedUnit) {
      filtered = filtered.filter(camera => camera.unit_number === selectedUnit);
    }

    if (selectedDepartment) {
      filtered = filtered.filter(camera => camera.department_name === selectedDepartment);
    }

    if (searchTerm) {
      filtered = filtered.filter(camera =>
        Object.values(camera).some(value =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    return filtered;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportData = () => {
    const data = getFilteredCameras();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cctv_cameras_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Data exported", description: "CCTV cameras data has been exported successfully." });
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
            for (const camera of data) {
              if (camera.serial_number) {
                await dbService.addCCTVCamera(camera);
              }
            }
            await loadData();
            toast({ title: "Data imported", description: "CCTV cameras have been imported successfully." });
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
            placeholder="Enter unit/office name"
            required
          />
        </div>
        <div>
          <Label htmlFor="department_name">Department Name *</Label>
          <Input
            id="department_name"
            value={formData.department_name}
            onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
            placeholder="Enter department name"
            required
          />
        </div>
        <div>
          <Label htmlFor="serial_number">Serial Number *</Label>
          <Input
            id="serial_number"
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
            placeholder="Enter serial number"
            required
          />
        </div>
        <div>
          <Label htmlFor="camera_name">Camera Name *</Label>
          <Input
            id="camera_name"
            value={formData.camera_name}
            onChange={(e) => setFormData({ ...formData, camera_name: e.target.value })}
            placeholder="Enter camera name"
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Enter camera location"
            required
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
        <Button type="submit" className="bg-gradient-to-r from-primary to-primary/80">
          {editingCamera ? "Update" : "Add"} Camera
        </Button>
      </DialogFooter>
    </form>
  );

  const camerasByUnit = getCamerasByUnit();
  const activeCameras = cameras.filter(c => c.status === 'active').length;
  const camerasWithIssues = cameras.filter(c => c.issues?.some(i => !i.resolved)).length;

  // Unit view
  if (!selectedUnit) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent animate-slide-up">
              CCTV Cameras Management
            </h1>
            <p className="text-muted-foreground mt-2">Manage and monitor all CCTV cameras</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint} className="border-primary/30 text-primary hover:bg-primary/10">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleExportData} className="border-primary/30 text-primary hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('cctv-import-file')?.click()} className="border-primary/30 text-primary hover:bg-primary/10">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input id="cctv-import-file" type="file" accept=".json" onChange={handleImportData} className="hidden" />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <PermGate action="add">
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground">
                    <Plus className="h-4 w-4 mr-2" />
                    Add CCTV Camera
                  </Button>
                </DialogTrigger>
              </PermGate>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingCamera ? "Edit Camera" : "Add New CCTV Camera"}</DialogTitle>
                  <DialogDescription>Fill in the camera details</DialogDescription>
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
              searchPlaceholder="Search cameras by name, serial, unit, or department..."
            />
          </CardContent>
        </Card>

        {/* Stats - Including NVR Checklist Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 perspective-1000 hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Camera className="h-10 w-10 text-primary" />
                <div>
                  <p className="text-muted-foreground text-sm">Total Cameras</p>
                  <p className="text-3xl font-bold text-primary">{cameras.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 perspective-1000 hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <div>
                  <p className="text-muted-foreground text-sm">Active Cameras</p>
                  <p className="text-3xl font-bold text-green-600">{activeCameras}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 perspective-1000 hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
                <div>
                  <p className="text-muted-foreground text-sm">With Issues</p>
                  <p className="text-3xl font-bold text-amber-600">{camerasWithIssues}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* NVR Stats from Checklists */}
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 perspective-1000 hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Server className="h-10 w-10 text-purple-500" />
                <div>
                  <p className="text-muted-foreground text-sm">NVR Cameras</p>
                  <p className="text-3xl font-bold text-purple-600">{nvrStats.totalNVRCameras}</p>
                  <p className="text-xs text-muted-foreground">{nvrs.length} NVRs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card 
            className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 perspective-1000 hover-lift cursor-pointer"
            onClick={() => nvrStats.withIssues > 0 && setIsIssuesViewOpen(true)}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Eye className="h-10 w-10 text-red-500" />
                <div>
                  <p className="text-muted-foreground text-sm">NVR Issues</p>
                  <p className="text-3xl font-bold text-red-600">{nvrStats.withIssues}</p>
                  <p className="text-xs text-muted-foreground">Click to view</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* NVR Issues Dialog */}
        <Dialog open={isIssuesViewOpen} onOpenChange={setIsIssuesViewOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                NVR Camera Issues ({nvrStats.withIssues})
              </DialogTitle>
              <DialogDescription>
                Cameras with NOT OK status from daily checklists
              </DialogDescription>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NVR</TableHead>
                  <TableHead>Camera ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Issue Type</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nvrStats.issues.map((issue, idx) => (
                  <TableRow key={idx}>
                    <td className="p-2 font-medium">NVR-{issue.nvr_number}</td>
                    <td className="p-2 font-bold text-primary">{issue.camera_id}</td>
                    <td className="p-2">{issue.location}</td>
                    <td className="p-2">
                      <Badge variant="destructive">{issue.issue_type}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {new Date(issue.date).toLocaleDateString('en-GB')}
                    </td>
                  </TableRow>
                ))}
                {nvrStats.issues.length === 0 && (
                  <TableRow>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      No issues found in NVR checklists
                    </td>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsIssuesViewOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Object.entries(camerasByUnit).map(([unitName, unitCameras]) => {
            const deptGroups = getDepartmentsByUnit(unitName);
            const issueCount = unitCameras.filter(c => c.issues?.some(i => !i.resolved)).length;
            return (
              <Card 
                key={unitName} 
                className="cursor-pointer perspective-1000 hover-lift glow-effect animate-slide-up bg-gradient-to-br from-card to-card/80 border-primary/20"
                onClick={() => setSelectedUnit(unitName)}
              >
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {unitName}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Camera className="h-4 w-4" />
                      {unitCameras.length} Cameras
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {Object.keys(deptGroups).length} Departments
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-lg">{unitCameras.length}</Badge>
                  {issueCount > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {issueCount} Issues
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {Object.keys(camerasByUnit).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No cameras found</h3>
              <p className="text-muted-foreground">Add your first CCTV camera to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Print Card */}
        {cameras.length > 0 && (
          <CCTVPrintCard cameras={cameras} ref={printRef} />
        )}
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
              variant="outline" 
              onClick={() => { setSelectedUnit(null); setSearchTerm(""); }}
              className="mb-4 border-primary/30 text-primary hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Units
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {selectedUnit} - Departments
            </h1>
            <p className="text-muted-foreground mt-2">Select a department to view cameras</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <PermGate action="add">
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    resetForm();
                    setFormData(prev => ({ ...prev, unit_number: selectedUnit }));
                  }}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Camera
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingCamera ? "Edit Camera" : "Add New Camera"}</DialogTitle>
                <DialogDescription>Fill in the camera details</DialogDescription>
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
              searchPlaceholder="Search cameras..."
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Object.entries(deptGroups).map(([deptName, deptCameras]) => {
            const issueCount = deptCameras.filter(c => c.issues?.some(i => !i.resolved)).length;
            return (
              <Card 
                key={deptName} 
                className="cursor-pointer perspective-1000 hover-lift glow-effect animate-scale-in bg-gradient-to-br from-card to-card/80 border-primary/20"
                onClick={() => setSelectedDepartment(deptName)}
              >
                <CardHeader>
                  <Badge className="w-fit mb-2">{deptCameras.length} Cameras</Badge>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {deptName}
                  </CardTitle>
                </CardHeader>
                {issueCount > 0 && (
                  <CardContent>
                    <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                      <AlertTriangle className="h-3 w-3" />
                      {issueCount} Issues
                    </Badge>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {Object.keys(deptGroups).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No departments found</h3>
              <p className="text-muted-foreground">Add a camera to this unit to get started</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Camera list view
  const filteredCameras = getFilteredCameras();

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Button 
            variant="outline" 
            onClick={() => { setSelectedDepartment(null); setSearchTerm(""); }}
            className="mb-4 border-primary/30 text-primary hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Departments
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {selectedUnit} - {selectedDepartment}
          </h1>
          <p className="text-muted-foreground mt-2">CCTV cameras in this department</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <PermGate action="add">
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  resetForm();
                  setFormData(prev => ({ ...prev, unit_number: selectedUnit || "", department_name: selectedDepartment || "" }));
                }}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Camera
              </Button>
            </DialogTrigger>
          </PermGate>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCamera ? "Edit Camera" : "Add New Camera"}</DialogTitle>
              <DialogDescription>Fill in the camera details</DialogDescription>
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
            searchPlaceholder="Search cameras..."
          />
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead className="text-primary font-semibold">SL</TableHead>
                <TableHead className="text-primary font-semibold">Serial Number</TableHead>
                <TableHead className="text-primary font-semibold">Camera Name</TableHead>
                <TableHead className="text-primary font-semibold">Location</TableHead>
                <TableHead className="text-primary font-semibold">Status</TableHead>
                <TableHead className="text-primary font-semibold">Issues</TableHead>
                <TableHead className="text-primary font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCameras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No cameras found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCameras.map((camera, index) => (
                  <TableRow key={camera.id} className="hover:bg-primary/5">
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-mono">{camera.serial_number}</TableCell>
                    <TableCell className="font-medium">{camera.camera_name}</TableCell>
                    <TableCell>{camera.location}</TableCell>
                    <TableCell>
                      <Badge variant={camera.status === 'active' ? 'default' : 'secondary'}>
                        {camera.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {camera.issues?.filter(i => !i.resolved).length > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          {camera.issues.filter(i => !i.resolved).length}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">OK</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCamera(camera);
                            setIsIssueDialogOpen(true);
                          }}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          title="Add Issue"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                        <PermGate action="edit">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(camera)}
                            className="border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermGate>
                        <PermGate action="delete">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(camera.id)}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Camera Issue</DialogTitle>
            <DialogDescription>
              Record an issue for {selectedCamera?.camera_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="issue_date">Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={issueFormData.date}
                onChange={(e) => setIssueFormData({ ...issueFormData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="issue_description">Issue Description</Label>
              <Textarea
                id="issue_description"
                value={issueFormData.description}
                onChange={(e) => setIssueFormData({ ...issueFormData, description: e.target.value })}
                placeholder="Describe the camera issue..."
                rows={3}
              />
            </div>

            {/* Previous Issues */}
            {selectedCamera?.issues && selectedCamera.issues.length > 0 && (
              <div>
                <Label className="mb-2 block">Previous Issues</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedCamera.issues.map((issue, index) => (
                    <div 
                      key={index} 
                      className={`p-2 rounded-md border ${issue.resolved ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{issue.date}</span>
                        {!issue.resolved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResolveIssue(selectedCamera.id, index)}
                            className="h-6 text-xs text-green-600 hover:text-green-700"
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{issue.description}</p>
                      {issue.resolved && (
                        <Badge variant="outline" className="text-green-600 mt-1">Resolved</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddIssue}>Add Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CCTVList;
