import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PermGate from "@/components/PermGate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2,
  MapPin,
  Package,
  Monitor,
  Laptop,
  ArrowLeft,
  Filter,
  MoreVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import dbService from "@/services/dbService";
import UserAssetCard from "@/components/UserAssetCard";
import SearchFilter from "@/components/SearchFilter";

const UnitsOfficesManager = ({ 
  units, 
  departments, 
  selectedUnit, 
  selectedDepartment,
  onUnitClick, 
  onDepartmentClick, 
  onBackToUnits, 
  onBackToDepartments,
  onDataChange 
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deptSearchTerm, setDeptSearchTerm] = useState("");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showDeptFilter, setShowDeptFilter] = useState(false);
  const [unitSearchTerm, setUnitSearchTerm] = useState("");
  const [allAssets, setAllAssets] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'unit'|'department', item }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await dbService.getITAssets?.();
        if (!cancelled) setAllAssets(a || []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [units, departments]);

  const matchAsset = (a, q) => {
    if (!q) return false;
    const digits = (v) => String(v ?? "").replace(/\D/g, "");
    const isNum = /^\d+$/.test(q);
    if (isNum) {
      return digits(a.pc_no) === q || digits(a.sl_no) === q || digits(a.dp_lp_no) === q;
    }
    const fields = [a.pc_no, a.dp_lp_no, a.employee_name, a.division, a.department, a.designation, a.unit_office];
    return fields.some((v) => String(v ?? "").toLowerCase().includes(q));
  };
  
  const [unitFormData, setUnitFormData] = useState({
    name: "",
    location: ""
  });
  
  const [departmentFormData, setDepartmentFormData] = useState({
    name: "",
    description: "",
    head: "",
    location: "",
    unit: ""
  });

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingUnit) {
        const updated = await dbService.updateUnit(editingUnit.id, unitFormData);
        if (updated) {
          toast({
            title: "Success",
            description: "Unit/Office updated successfully",
          });
        }
      } else {
        const added = await dbService.addUnit(unitFormData);
        if (added) {
          toast({
            title: "Success",
            description: "Unit/Office added successfully",
          });
        }
      }
      
      await onDataChange();
      setUnitFormData({ name: "", location: "" });
      setEditingUnit(null);
      setIsUnitDialogOpen(false);
    } catch (error) {
      console.error("Error saving unit:", error);
      toast({
        title: "Error",
        description: "Failed to save unit/office",
        variant: "destructive",
      });
    }
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    
    if (editingDepartment) {
      const updated = await dbService.updateDepartment(editingDepartment.id, departmentFormData);
      if (updated) {
        toast({
          title: "Success",
          description: "Department updated successfully. All related data preserved.",
        });
      }
    } else {
      const added = await dbService.addDepartment(departmentFormData);
      if (added) {
        toast({
          title: "Success",
          description: "Department added successfully",
        });
      }
    }
    
    await onDataChange();
    resetDepartmentForm();
  };

  const handleEditUnit = (unit) => {
    setEditingUnit(unit);
    setUnitFormData({
      name: unit.name,
      location: unit.location || ""
    });
    setIsUnitDialogOpen(true);
  };

  const handleEditDepartment = (department) => {
    setEditingDepartment(department);
    setDepartmentFormData({
      name: department.name,
      description: department.description || "",
      head: department.head || "",
      location: department.location || "",
      unit: department.unit || ""
    });
    setIsDepartmentDialogOpen(true);
  };

  const handleDeleteUnit = async (unit) => {
    setDeleteTarget({ type: "unit", item: unit });
  };

  const handleDeleteDepartment = async (department) => {
    setDeleteTarget({ type: "department", item: department });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, item } = deleteTarget;
    const { sendToRecycleBin } = await import("@/lib/recycleBin");
    if (type === "unit") {
      await sendToRecycleBin({
        entity: "Unit / Office",
        entity_id: item.id,
        entity_label: item.name,
        collection: "Unit",
        payload: item,
      });
      await dbService.deleteUnit(item.id);
      toast({ title: "Success", description: "Unit/Office deleted successfully" });
    } else {
      await sendToRecycleBin({
        entity: "Department",
        entity_id: item.id,
        entity_label: item.name,
        collection: "Department",
        payload: item,
      });
      await dbService.deleteDepartment(item.id);
      toast({ title: "Success", description: "Department deleted successfully" });
    }
    setDeleteTarget(null);
    await onDataChange();
  };

  const resetUnitForm = (closeDialog = true) => {
    setUnitFormData({ name: "", location: "" });
    setEditingUnit(null);
    if (closeDialog) {
      setIsUnitDialogOpen(false);
    }
  };

  const resetDepartmentForm = () => {
    setDepartmentFormData({
      name: "",
      description: "",
      head: "",
      location: "",
      unit: ""
    });
    setEditingDepartment(null);
    setIsDepartmentDialogOpen(false);
  };

  const deleteAlertEl = (
    <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
      <AlertDialogContent className="border-2 border-destructive rounded-2xl shadow-[0_0_50px_-8px_hsl(var(--destructive)/0.7)] bg-gradient-to-br from-background via-background to-destructive/10">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 ring-2 ring-destructive/40">
            <Trash2 className="h-7 w-7 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center text-xl font-bold text-destructive">
            Delete {deleteTarget?.type === "unit" ? "Unit/Office" : "Department"}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{deleteTarget?.item?.name}</span>?
            <br />This item will be moved to the Recycle Bin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center gap-2">
          <AlertDialogCancel className="rounded-xl border-2 border-primary text-primary hover:bg-primary/10">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="rounded-xl border-2 border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // Units View
  if (!selectedUnit && !selectedDepartment) {
    const uq = unitSearchTerm.trim().toLowerCase();
    const filteredUnits = !uq ? units : units.filter((unit) => {
      if (String(unit.name ?? "").toLowerCase().includes(uq)) return true;
      if (String(unit.location ?? "").toLowerCase().includes(uq)) return true;
      const unitDepts = departments.filter((d) => d.unit === unit.name);
      if (unitDepts.some((d) => String(d.name ?? "").toLowerCase().includes(uq))) return true;
      return false;
    });
    return (
      <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-primary">Units & Offices</h2>
          <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
            <PermGate action="add" path="/departments">
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setUnitFormData({ name: "", location: "" }); setEditingUnit(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Unit/Office
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUnit ? "Edit Unit/Office" : "Add New Unit/Office"}</DialogTitle>
                <DialogDescription>
                  {editingUnit ? "Update unit/office information" : "Create a new unit/office"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUnitSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Unit/Office Name *</Label>
                  <Input
                    id="name"
                    value={unitFormData.name}
                    onChange={(e) => setUnitFormData({...unitFormData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={unitFormData.location}
                    onChange={(e) => setUnitFormData({...unitFormData, location: e.target.value})}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => resetUnitForm()}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {editingUnit ? "Update" : "Add"} Unit/Office
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <Card 
              key={unit.id} 
              className="cursor-pointer animate-slide-up bg-transparent border-2 border-primary/60"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1" onClick={() => onUnitClick(unit)}>
                    <CardTitle className="flex items-center gap-2 text-primary font-extrabold tracking-tight text-sm sm:text-lg min-w-0">
                      <span className="truncate">{unit.name}</span>
                    </CardTitle>
                    <CardDescription className="text-primary/70 font-medium text-[11px] sm:text-sm">
                      {unit.location}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()} title="Actions">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <PermGate action="edit" path="/departments">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditUnit(unit); }}>
                          <Edit className="h-3 w-3 mr-2" /> Edit
                        </DropdownMenuItem>
                      </PermGate>
                      <PermGate action="delete" path="/departments">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteUnit(unit); }}>
                          <Trash2 className="h-3 w-3 mr-2" /> Delete
                        </DropdownMenuItem>
                      </PermGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent onClick={() => onUnitClick(unit)}>
                <div className="grid grid-cols-2 gap-2 sm:gap-4 text-center">
                  <div>
                     <div className="text-lg sm:text-2xl font-bold text-primary">{unit.total_departments || 0}</div>
                    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-primary/70">Departments</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl font-bold text-primary">{unit.total_assets || 0}</div>
                    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-primary/70">Assets</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      {deleteAlertEl}
      </>
    );
  }

  // Departments View
  if (selectedUnit && !selectedDepartment) {
    let touchStartX = 0;
    const onTouchStart = (e: React.TouchEvent) => { touchStartX = e.touches[0].clientX; };
    const onTouchEnd = (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx > 80 && touchStartX < 60) onBackToUnits();
    };
    return (
      <>
      <div className="space-y-6" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={onBackToUnits}
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-primary/60 text-primary bg-primary/10 shadow-md shadow-primary/20 ring-1 ring-primary/30 hover:bg-primary/20 hover:border-primary hover:ring-2 hover:ring-primary/50 hover:scale-105 active:scale-95 transition-all duration-200"
              aria-label="Back to Units"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div>
              <h2 className="text-xs sm:text-2xl font-bold text-primary">
              {selectedUnit.name} - Departments
            </h2>
            <p className="text-[10px] sm:text-sm text-muted-foreground">{selectedUnit.location}</p>
          </div>
          </div>
          <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
            <PermGate action="add" path="/departments">
              <DialogTrigger asChild>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => {
                    setEditingDepartment(null);
                    setDepartmentFormData({
                      name: "",
                      description: "",
                      head: "",
                      location: "",
                      unit: selectedUnit.name,
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </DialogTrigger>
            </PermGate>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDepartment ? "Edit Department" : "Add New Department"}</DialogTitle>
                <DialogDescription>
                  {editingDepartment ? "Update department information" : "Create a new department"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleDepartmentSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Department Name *</Label>
                  <Input
                    id="name"
                    value={departmentFormData.name}
                    onChange={(e) => setDepartmentFormData({...departmentFormData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit/Office *</Label>
                  <Select 
                    value={departmentFormData.unit || selectedUnit.name} 
                    onValueChange={(value) => setDepartmentFormData({...departmentFormData, unit: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit/office" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map(unit => (
                        <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={departmentFormData.description}
                    onChange={(e) => setDepartmentFormData({...departmentFormData, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="head">Department Head</Label>
                    <Input
                      id="head"
                      value={departmentFormData.head}
                      onChange={(e) => setDepartmentFormData({...departmentFormData, head: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={departmentFormData.location}
                      onChange={(e) => setDepartmentFormData({...departmentFormData, location: e.target.value})}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetDepartmentForm}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {editingDepartment ? "Update" : "Add"} Department
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <SearchFilter
          searchTerm={deptSearchTerm}
          onSearchChange={setDeptSearchTerm}
          searchPlaceholder="Search by Department"
          filters={[
            {
              value: deptFilter,
              onChange: setDeptFilter,
              placeholder: "All Departments",
              options: [
                { value: "all", label: "All Departments" },
                ...selectedUnit.departments.map((d: any) => ({ value: `name:${d.name}`, label: d.name })),
                { value: "with_assets", label: "With Assets" },
                { value: "no_assets", label: "No Assets" },
                { value: "expired_av", label: "Expired Antivirus" },
              ],
            },
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {selectedUnit.departments
            .filter((department) => {
              const q = deptSearchTerm.trim().toLowerCase();
              if (q) {
                const nameHit = department.name?.toLowerCase().includes(q);
                const assetHit = allAssets.some((a) => a.division === department.name && a.unit_office === selectedUnit.name && matchAsset(a, q));
                if (!nameHit && !assetHit) return false;
              }
              const stats = departments.find((d) => d.id === department.id);
              if (deptFilter.startsWith("name:") && department.name !== deptFilter.slice(5)) return false;
              if (deptFilter === "with_assets" && !(stats?.total_assets > 0)) return false;
              if (deptFilter === "no_assets" && (stats?.total_assets || 0) > 0) return false;
              if (deptFilter === "expired_av" && !(stats?.expired_antivirus > 0)) return false;
              return true;
            })
            .map((department) => {
            const deptStats = departments.find(d => d.id === department.id);
            const q = deptSearchTerm.trim().toLowerCase();
            const hasMatch = !!q && allAssets.some((a: any) => a.division === department.name && a.unit_office === selectedUnit.name && matchAsset(a, q));
            return (
              <Card 
                key={department.id} 
                className={`cursor-pointer animate-scale-in bg-transparent border-2 ${hasMatch ? "border-yellow-500 ring-4 ring-yellow-400/50 animate-pulse" : "border-primary/60"}`}
                onClick={() => {
                  if (hasMatch) {
                    navigate(`/accessories?search=${encodeURIComponent(deptSearchTerm.trim())}`);
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                     <div className="flex-1 min-w-0" onClick={() => onDepartmentClick(deptStats)}>
                      <CardTitle className="flex items-center space-x-2 text-primary font-extrabold tracking-tight text-sm sm:text-lg min-w-0">
                        <span className="truncate">{department.name}</span>
                      </CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()} title="Actions">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <PermGate action="edit" path="/departments">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditDepartment(department); }}>
                            <Edit className="h-3 w-3 mr-2" /> Edit
                          </DropdownMenuItem>
                        </PermGate>
                        <PermGate action="delete" path="/departments">
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteDepartment(department); }}>
                            <Trash2 className="h-3 w-3 mr-2" /> Delete
                          </DropdownMenuItem>
                        </PermGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent onClick={() => onDepartmentClick(deptStats)}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{deptStats?.total_assets || 0}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary/70">Assets</div>
                  </div>
                  {deptStats?.expired_antivirus > 0 && (
                    <Badge variant="destructive" className="mt-2">
                      {deptStats.expired_antivirus} Expired Antivirus
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      {deleteAlertEl}
      </>
    );
  }

  // Assets View
  if (selectedDepartment) {
    // Deduplicate raw assets by employee name (keep full asset data
    // so UserAssetCard can render every field just like the Dashboard).
    const rawAssets = selectedDepartment.assets || [];
    const uniqueAssets = rawAssets.reduce((acc, asset) => {
      const key = (asset.employee_name || '').toLowerCase();
      if (key && !acc.find(a => (a.employee_name || '').toLowerCase() === key)) {
        acc.push(asset);
      } else if (!key) {
        acc.push(asset);
      }
      return acc;
    }, []);

    const q = assetSearchTerm.trim().toLowerCase();
    const normalize = (v: any) => String(v ?? '').toLowerCase();
    const digits = (v: any) => String(v ?? '').replace(/\D/g, '');
    const alnum = (v: any) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isNum = /^\d+$/.test(q);
    const filteredAssets = !q ? uniqueAssets : uniqueAssets.filter((a: any) => {
      const prefix = a.device_type === 'laptop' ? 'LP' : a.device_type === 'desktop' ? 'DP' : '';
      const derivedDpLp = a.dp_lp_no || (prefix ? `${prefix}-${a.pc_no || ''}` : '');
      if (isNum) {
        return (
          digits(a.pc_no) === q ||
          digits(a.sl_no) === q ||
          digits(derivedDpLp) === q
        );
      }
      const hay = [a.employee_name, a.designation, a.pc_no, a.sl_no, a.dp_lp_no, derivedDpLp, a.ip_no, a.email, a.mobile, a.device_type]
        .map(normalize).join(' ');
      const hayAlnum = [a.employee_name, a.designation, a.pc_no, a.sl_no, a.dp_lp_no, derivedDpLp, a.ip_no, a.email, a.mobile, a.device_type]
        .map(alnum).join(' ');
      return hay.includes(q) || hayAlnum.includes(alnum(q));
    });

    return (
      <div
        className="space-y-6"
        onTouchStart={(e) => { (window as any).__uomTouchX = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const sx = (window as any).__uomTouchX ?? 0;
          const dx = e.changedTouches[0].clientX - sx;
          if (dx > 80 && sx < 60) onBackToDepartments();
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={onBackToDepartments}
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-primary/60 text-primary bg-primary/10 shadow-md shadow-primary/20 ring-1 ring-primary/30 hover:bg-primary/20 hover:border-primary hover:ring-2 hover:ring-primary/50 hover:scale-105 active:scale-95 transition-all duration-200"
              aria-label="Back to Departments"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div>
              <h2 className="text-base sm:text-2xl font-bold text-primary">
              {selectedDepartment.name} - Assets
            </h2>
            <p className="text-muted-foreground">
              {filteredAssets.length} of {uniqueAssets.length} assets
            </p>
          </div>
          </div>
        </div>

        <SearchFilter
          searchTerm={assetSearchTerm}
          onSearchChange={setAssetSearchTerm}
          searchPlaceholder="Search by name, PC No, DP/LP No, SL No, IP..."
        />

        {filteredAssets.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200">
            <CardContent className="text-center py-12">
              <Monitor className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
              <p className="text-gray-500">
                {q ? 'Try a different search term' : 'Add IT assets to see data here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset, index) => (
              <UserAssetCard key={asset.id} asset={asset} index={index} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default UnitsOfficesManager;