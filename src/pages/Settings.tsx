import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Trash2,
  Shield,
  Bell,
  Palette,
  Monitor,
  Check
} from "lucide-react";
import dbService from "@/services/dbService";
import excelService from "@/services/excelService";
import { useAuth } from "@/hooks/useAuth";

const themes = [
  { id: "sky", name: "Sky Blue", color: "hsl(200, 100%, 45%)" },
  { id: "ocean", name: "Ocean Blue", color: "hsl(210, 100%, 45%)" },
  { id: "emerald", name: "Emerald Green", color: "hsl(152, 76%, 36%)" },
  { id: "violet", name: "Purple Violet", color: "hsl(270, 70%, 50%)" },
  { id: "sunset", name: "Sunset Orange", color: "hsl(25, 95%, 53%)" },
  { id: "rose", name: "Rose Pink", color: "hsl(340, 82%, 52%)" },
  { id: "teal", name: "Teal Lagoon", color: "hsl(174, 72%, 40%)" },
  { id: "crimson", name: "Crimson Red", color: "hsl(348, 83%, 47%)" },
  { id: "indigo", name: "Deep Indigo", color: "hsl(243, 75%, 55%)" },
  { id: "amber", name: "Golden Amber", color: "hsl(38, 92%, 50%)" },
  { id: "lime", name: "Fresh Lime", color: "hsl(84, 72%, 44%)" },
  { id: "fuchsia", name: "Neon Fuchsia", color: "hsl(292, 84%, 55%)" },
  { id: "slate", name: "Slate Steel", color: "hsl(215, 25%, 40%)" },
  { id: "cyan", name: "Electric Cyan", color: "hsl(190, 95%, 45%)" },
  { id: "royal", name: "Royal Gold", color: "hsl(45, 90%, 48%)" },
  { id: "midnight", name: "Midnight Plum", color: "hsl(260, 55%, 30%)" },
  { id: "obsidian", name: "Obsidian Dark", color: "hsl(222, 47%, 8%)" },
  { id: "carbon", name: "Carbon Dark", color: "hsl(0, 0%, 9%)" },
  { id: "nightfall", name: "Nightfall Dark", color: "hsl(265, 40%, 10%)" },
  { id: "nord", name: "Nord", color: "linear-gradient(135deg, hsl(220, 16%, 36%), hsl(213, 32%, 52%))" },
  { id: "sepia", name: "Sepia", color: "linear-gradient(135deg, hsl(32, 35%, 55%), hsl(28, 45%, 72%))" },
  { id: "glacier", name: "Glacier", color: "linear-gradient(135deg, hsl(200, 45%, 55%), hsl(190, 55%, 75%))" },
  { id: "aurora", name: "Aurora Sky", color: "linear-gradient(135deg, hsl(220, 60%, 35%), hsl(280, 70%, 55%))" },
  { id: "cyberpunk", name: "Cyberpunk", color: "linear-gradient(135deg, hsl(310, 90%, 55%), hsl(190, 95%, 55%))" },
  { id: "mocha", name: "Mocha", color: "linear-gradient(135deg, hsl(20, 25%, 30%), hsl(25, 40%, 55%))" },
  { id: "arctic", name: "Arctic", color: "linear-gradient(135deg, hsl(200, 30%, 85%), hsl(210, 40%, 70%))" },
];

const darkVariants = [
  { id: "default", name: "Classic Dark", color: "hsl(240, 10%, 4%)" },
  { id: "midnight", name: "Midnight Blue", color: "hsl(230, 45%, 6%)" },
  { id: "ocean", name: "Ocean Night", color: "hsl(200, 55%, 6%)" },
  { id: "royal", name: "Royal Night", color: "hsl(275, 40%, 7%)" },
];

const Settings = () => {
  const { toast } = useToast();
  const { access } = useAuth();
  const [settings, setSettings] = useState({
    companyName: "MNR Group",
    systemName: "MNR IT Management System",
    antivirusWarningDays: 30,
    batteryWarningLevel: "low",
    autoBackup: true,
    emailNotifications: true,
    darkMode: false,
    companyAddress: "",
    adminEmail: "",
    backupFrequency: "daily",
    theme: "sky",
    darkVariant: "default",
  });

  useEffect(() => {
    loadSettings();
    // Load CCTV checklist excel settings from localStorage
    const savedExcelSettings = localStorage.getItem('cctv_excel_settings');
    if (savedExcelSettings) {
      // Dispatch event to notify CCTV checklist page about saved settings
      window.dispatchEvent(new CustomEvent('excel-settings-loaded', { detail: JSON.parse(savedExcelSettings) }));
    }
  }, []);

  useEffect(() => {
    // Apply theme to document
    if (settings.theme === "sky") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", settings.theme);
    }
    
    // Apply dark mode
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-dark-variant", settings.darkVariant || "default");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.removeAttribute("data-dark-variant");
    }
  }, [settings.theme, settings.darkMode, settings.darkVariant]);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('mnr_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings({ ...settings, ...parsed });
      
      // Apply saved theme immediately
      if (parsed.theme && parsed.theme !== "sky") {
        document.documentElement.setAttribute("data-theme", parsed.theme);
      }
      if (parsed.darkMode) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-dark-variant", parsed.darkVariant || "default");
      }
    }
  };

  const saveSettings = () => {
    localStorage.setItem('mnr_settings', JSON.stringify(settings));
    toast({
      title: "Settings saved",
      description: "Your settings have been saved successfully.",
    });
  };

  const handleThemeChange = (themeId: string) => {
    const next = { ...settings, theme: themeId };
    setSettings(next);
    localStorage.setItem('mnr_settings', JSON.stringify(next));
    toast({ title: "Theme saved", description: `Applied ${themeId} theme.` });
  };

  const handleDarkModeChange = (checked: boolean) => {
    const next = { ...settings, darkMode: checked };
    setSettings(next);
    localStorage.setItem('mnr_settings', JSON.stringify(next));
  };

  const exportAllData = async () => {
    const data = await dbService.exportData();
    
    const allData = {
      ...data,
      settings,
      exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `mnr_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Data exported",
      description: "All system data has been exported successfully.",
    });
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string);
          
          await dbService.importData(importedData);
          
          if (importedData.settings) {
            setSettings({ ...settings, ...importedData.settings });
            localStorage.setItem('mnr_settings', JSON.stringify(importedData.settings));
          }
          
          toast({
            title: "Data imported",
            description: "System data has been imported successfully. Refresh the page to see changes.",
          });
        } catch (error) {
          toast({
            title: "Import failed",
            description: "Failed to import data. Please check the file format.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const clearAllData = async () => {
    if (!confirm("Are you sure you want to clear ALL data? This action cannot be undone.")) return;
    if (!confirm("This will permanently delete all saved records. Are you absolutely sure?")) return;

    try {
      await dbService.clearAllData();

      toast({
        title: "Data cleared",
        description: "All data has been cleared. Reloading…",
        variant: "destructive",
      });

      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateSampleData = async () => {
    // Add sample departments
    const sampleDepts = [
      { name: "IT Department", description: "Information Technology", head: "John Smith", location: "Building A" },
      { name: "HR Department", description: "Human Resources", head: "Jane Doe", location: "Building B" },
      { name: "Finance", description: "Finance & Accounting", head: "Mike Johnson", location: "Building A" }
    ];

    for (const dept of sampleDepts) {
      await dbService.addDepartment(dept);
    }

    // Add sample users
    const sampleUsers = [
      { 
        name: "Alice Johnson", 
        email: "alice@mnr.com", 
        department_id: "1",
        position: "Software Developer",
        id_number: "EMP001",
        phone_number: "+1234567890",
        antivirus_status: "Active",
        antivirus_expiry: "2024-12-31"
      },
      { 
        name: "Bob Smith", 
        email: "bob@mnr.com", 
        department_id: "2",
        position: "HR Manager",
        id_number: "EMP002", 
        phone_number: "+1234567891",
        antivirus_status: "Expired",
        antivirus_expiry: "2024-01-15"
      }
    ];

    for (const user of sampleUsers) {
      await dbService.addUser(user);
    }

    // Add sample accessories
    const sampleAccessories = [
      {
        user_id: "1",
        type: "mouse",
        brand: "Logitech",
        model: "MX Master 3",
        status: "active",
        battery_status: "good",
        issue_date: "2024-01-15"
      },
      {
        user_id: "1", 
        type: "keyboard",
        brand: "Dell",
        model: "KB216",
        status: "active",
        battery_status: "n/a",
        issue_date: "2024-01-15"
      }
    ];

    for (const acc of sampleAccessories) {
      await dbService.addAccessory(acc);
    }

    toast({
      title: "Sample data generated",
      description: "Sample users, departments, and accessories have been added.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Settings</h1>
          <p className="text-muted-foreground">
            Configure system settings and preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <SettingsIcon className="h-5 w-5" />
              <span>General Settings</span>
            </CardTitle>
            <CardDescription>
              Basic system configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings({...settings, companyName: e.target.value})}
              />
            </div>
            
            <div>
              <Label htmlFor="systemName">System Name</Label>
              <Input
                id="systemName"
                value={settings.systemName}
                onChange={(e) => setSettings({...settings, systemName: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={settings.adminEmail}
                onChange={(e) => setSettings({...settings, adminEmail: e.target.value})}
                placeholder="admin@company.com"
              />
            </div>

            <div>
              <Label htmlFor="companyAddress">Company Address</Label>
              <Textarea
                id="companyAddress"
                value={settings.companyAddress}
                onChange={(e) => setSettings({...settings, companyAddress: e.target.value})}
                placeholder="Enter company address..."
              />
            </div>

            <Button onClick={saveSettings} className="w-full bg-gradient-to-r from-primary to-primary/80">
              Save General Settings
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <Bell className="h-5 w-5" />
              <span>Notifications</span>
            </CardTitle>
            <CardDescription>
              Configure alerts and warnings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="antivirusWarning">Antivirus Warning (days before expiry)</Label>
              <Input
                id="antivirusWarning"
                type="number"
                value={settings.antivirusWarningDays}
                onChange={(e) => setSettings({...settings, antivirusWarningDays: parseInt(e.target.value)})}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email alerts for important events
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => setSettings({...settings, emailNotifications: checked})}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Backup</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically backup data daily
                </p>
              </div>
              <Switch
                checked={settings.autoBackup}
                onCheckedChange={(checked) => setSettings({...settings, autoBackup: checked})}
              />
            </div>

            <Button onClick={saveSettings} className="w-full bg-gradient-to-r from-primary to-primary/80">
              Save Notification Settings
            </Button>
          </CardContent>
        </Card>

        {/* Data Management — Super Admin only */}
        {access?.is_super_admin && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <Database className="h-5 w-5" />
              <span>Data Management</span>
            </CardTitle>
            <CardDescription>
              Backup, restore, and manage your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={exportAllData} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export All Data
            </Button>

            <div>
              <Label htmlFor="importData">Import Data</Label>
              <Input
                id="importData"
                type="file"
                accept=".json"
                onChange={importData}
                className="mt-2"
              />
            </div>

            <Button onClick={generateSampleData} className="w-full" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Generate Sample Data
            </Button>

            <Button onClick={clearAllData} className="w-full" variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Appearance - Theme Selection */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <Palette className="h-5 w-5" />
              <span>Appearance</span>
            </CardTitle>
            <CardDescription>
              Choose your preferred color theme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable dark theme
                </p>
              </div>
              <Switch
                checked={settings.darkMode}
                onCheckedChange={handleDarkModeChange}
              />
            </div>

            {settings.darkMode && (
              <div>
                <Label className="mb-3 block">Dark Style</Label>
                <div className="grid grid-cols-2 gap-3">
                  {darkVariants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        const next = { ...settings, darkVariant: v.id };
                        setSettings(next);
                        localStorage.setItem('mnr_settings', JSON.stringify(next));
                      }}
                      className={`relative p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                        (settings.darkVariant || "default") === v.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="h-10 w-full rounded-md mb-2" style={{ background: v.color }} />
                      <p className="text-xs font-medium text-center">{v.name}</p>
                      {(settings.darkVariant || "default") === v.id && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="mb-3 block">Color Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`relative p-3 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                      settings.theme === theme.id 
                        ? "border-primary ring-2 ring-primary/30" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div 
                      className="h-8 w-full rounded-md mb-2"
                      style={{ background: theme.color }}
                    />
                    <p className="text-xs font-medium text-center">{theme.name}</p>
                    {settings.theme === theme.id && (
                      <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={saveSettings} className="w-full bg-gradient-to-r from-primary to-primary/80">
              Save Appearance Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-primary">
            <Monitor className="h-5 w-5" />
            <span>System Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium">Version</p>
              <p className="text-muted-foreground">1.0.0</p>
            </div>
            <div>
              <p className="font-medium">Last Backup</p>
              <p className="text-muted-foreground">Never</p>
            </div>
            <div>
              <p className="font-medium">Data Storage</p>
              <p className="text-muted-foreground">IndexedDB</p>
            </div>
            <div>
              <p className="font-medium">PWA Status</p>
              <p className="text-muted-foreground text-green-600">Enabled</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;