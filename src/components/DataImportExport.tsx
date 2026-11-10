import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Database, FileJson, CheckCircle, AlertCircle } from "lucide-react";
import dbService from "@/services/dbService";

interface DataImportExportProps {
  onImportComplete?: () => void;
}

const DataImportExport = ({ onImportComplete }: DataImportExportProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const data = await dbService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mnr_it_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "All data has been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
    setIsExporting(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = e.target?.result;
          if (typeof result === 'string') {
            const data = JSON.parse(result);
            setImportPreview(data);
            setImportDialog(true);
          }
        } catch (error) {
          toast({
            title: "Invalid File",
            description: "The selected file is not a valid JSON backup file.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview || isImporting) return;

    setIsImporting(true);
    try {
      const success = await dbService.importData(importPreview);
      if (success) {
        toast({
          title: "Import Successful",
          description: "All data has been imported successfully.",
        });
        onImportComplete?.();
      } else {
        throw new Error("Import failed");
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import data. Please check the file format.",
        variant: "destructive",
      });
    }
    setIsImporting(false);
    setImportDialog(false);
    setImportPreview(null);
  };

  const getDataCount = (data: any) => {
    return {
      users: data.users?.length || 0,
      departments: data.departments?.length || 0,
      assets: data.assets?.length || 0,
      units: data.units?.length || 0,
      products: data.products?.length || 0,
      printers: data.printers?.length || 0,
      ipPhones: data.ip_phones?.length || 0,
      wifiNetworks: data.wifi_networks?.length || 0,
      ipAddresses: data.ip_addresses?.length || 0,
      cctvCameras: data.cctv_cameras?.length || 0,
      nvrs: data.nvrs?.length || 0,
      cctvChecklists: data.cctv_checklists?.length || 0,
    };
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={handleExportAll}
        disabled={isExporting}
        variant="outline"
        className="border-primary/30 text-primary hover:bg-primary/10 glow-effect"
      >
        <Download className="h-4 w-4 mr-2" />
        {isExporting ? "Exporting..." : "Export All Data"}
      </Button>
      
      <Button
        onClick={() => document.getElementById('import-all-file')?.click()}
        disabled={isImporting}
        variant="outline"
        className="border-primary/30 text-primary hover:bg-primary/10 glow-effect"
      >
        <Upload className="h-4 w-4 mr-2" />
        Import Data
      </Button>
      <input
        id="import-all-file"
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog open={importDialog} onOpenChange={(o) => { if (!isImporting) setImportDialog(o); }}>
        <DialogContent className="max-w-lg border-2 border-primary/60 shadow-2xl shadow-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
          <DialogHeader className="border-b border-primary/20 pb-3">
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Database className="h-5 w-5 text-primary" />
              Import Data Preview
            </DialogTitle>
            <DialogDescription className="mt-1">
              Review the data before importing
            </DialogDescription>
          </DialogHeader>
          
          {importPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(getDataCount(importPreview)).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <span className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                ))}
              </div>
              
              {importPreview.exportDate && (
                <p className="text-xs text-muted-foreground text-center">
                  Backup created: {new Date(importPreview.exportDate).toLocaleString()}
                </p>
              )}
              
              <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
                <AlertCircle className="h-5 w-5 text-warning" />
                <p className="text-sm text-warning">This will merge with existing data</p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportConfirm} disabled={isImporting} className="bg-gradient-to-r from-primary to-primary/80">
              <CheckCircle className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : "Confirm Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataImportExport;
