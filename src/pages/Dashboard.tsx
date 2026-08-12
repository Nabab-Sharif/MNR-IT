import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Shield, 
  AlertTriangle,
  Monitor,
  TrendingUp,
  Calendar,
  MapPin,
  Printer,
  Wifi,
  Phone,
  Camera,
  Server,
  Users,
  FileText,
  Zap,
  ArrowLeft
} from "lucide-react";
import dbService from "@/services/dbService";
import UserAssetCard from "@/components/UserAssetCard";
import SearchFilter from "@/components/SearchFilter";
import { Input } from "@/components/ui/input";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    expiredAntivirus: 0,
    totalAssets: 0,
    totalLaptops: 0,
    totalDesktops: 0,
    expiredAntivirusUsers: [],
    expiredAntivirusAssets: [],
    unitStats: [],
    departmentStats: []
  });
  const [viewExpiredAntivirus, setViewExpiredAntivirus] = useState(false);
  const [viewLaptops, setViewLaptops] = useState(false);
  const [viewDesktops, setViewDesktops] = useState(false);
  const [laptopUsers, setLaptopUsers] = useState([]);
  const [desktopUsers, setDesktopUsers] = useState([]);
  const [deptSearchTerm, setDeptSearchTerm] = useState("");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [assetDeviceFilter, setAssetDeviceFilter] = useState("all");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [expiredSearch, setExpiredSearch] = useState("");
  const [expiredUnitFilter, setExpiredUnitFilter] = useState("all");
  const [expiredDeptFilter, setExpiredDeptFilter] = useState("all");
  const [desktopSearch, setDesktopSearch] = useState("");
  const [desktopUnitFilter, setDesktopUnitFilter] = useState("all");
  const [desktopDeptFilter, setDesktopDeptFilter] = useState("all");
  const [laptopSearch, setLaptopSearch] = useState("");
  const [laptopUnitFilter, setLaptopUnitFilter] = useState("all");
  const [laptopDeptFilter, setLaptopDeptFilter] = useState("all");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Start all reads together. The shared data service deduplicates the
      // underlying collection requests, avoiding the previous waterfall.
      const [users, departments, assets, expiredData, unitStats, departmentStats] = await Promise.all([
        dbService.getUsers(),
        dbService.getDepartments(),
        dbService.getITAssets(),
        dbService.getExpiredAntivirusUsers(),
        dbService.getUnitStats(),
        dbService.getDepartmentStats(),
      ]);

      setAllAssets(assets);
      setAllDepartments(departments);

      // Count laptops and desktops
      const laptops = assets.filter(asset => asset.device_type?.toLowerCase() === 'laptop');
      const desktops = assets.filter(asset => asset.device_type?.toLowerCase() === 'desktop');

      // Get all laptops and desktops with their employee data
      const laptopUsersList = laptops.map(asset => ({
        ...asset,
        user: users.find(u => u.name === asset.employee_name)
      }));
      
      const desktopUsersList = desktops.map(asset => ({
        ...asset,
        user: users.find(u => u.name === asset.employee_name)
      }));

      setLaptopUsers(laptopUsersList);
      setDesktopUsers(desktopUsersList);

      // Get unique employees from assets (who are not in users table)
      const employeesFromAssets = assets
        .filter(asset => asset.employee_name && asset.employee_name.trim() !== '')
        .map(asset => asset.employee_name.trim().toLowerCase());
      
      const uniqueEmployees = new Set([
        ...users.map(u => u.name.trim().toLowerCase()),
        ...employeesFromAssets
      ]);

      const totalUniqueUsers = uniqueEmployees.size;

      setStats({
        totalUsers: assets.length, // Total IT Users count (same as total assets)
        totalDepartments: departments.length,
        expiredAntivirus: expiredData.users.length + expiredData.assets.length,
        totalAssets: assets.length,
        totalLaptops: laptops.length,
        totalDesktops: desktops.length,
        expiredAntivirusUsers: expiredData.users,
        expiredAntivirusAssets: expiredData.assets,
        unitStats,
        departmentStats
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit);
    setSelectedDepartment(null);
  };

  const handleDepartmentClick = (department) => {
    setSelectedDepartment(department);
  };

  const handleBackToUnits = () => {
    setSelectedUnit(null);
    setSelectedDepartment(null);
  };

  const handleBackToDepartments = () => {
    setSelectedDepartment(null);
  };

  const handleAntivirusClick = () => {
    setViewExpiredAntivirus(true);
  };

  const handleBackFromAntivirus = () => {
    setViewExpiredAntivirus(false);
  };

  const handleLaptopsClick = () => {
    setViewLaptops(true);
  };

  const handleDesktopsClick = () => {
    setViewDesktops(true);
  };

  const handleBackFromLaptops = () => {
    setViewLaptops(false);
  };

  const handleBackFromDesktops = () => {
    setViewDesktops(false);
  };

  // Laptops View
  if (viewLaptops) {
    const normalizeL = (v: any) => String(v ?? '').trim() || 'Unassigned';
    const lq = laptopSearch.trim().toLowerCase();
    const laptopUnitOptions = [
      { value: 'all', label: 'All Units/Offices' },
      ...Array.from(new Set(laptopUsers.map((u: any) => normalizeL(u.unit_office)))).sort().map((v) => ({ value: v, label: v })),
    ];
    const laptopDeptOptions = [
      { value: 'all', label: 'All Departments' },
      ...Array.from(new Set(
        laptopUsers
          .filter((u: any) => laptopUnitFilter === 'all' || normalizeL(u.unit_office) === laptopUnitFilter)
          .map((u: any) => normalizeL(u.division || u.department))
      )).sort().map((v) => ({ value: v, label: v })),
    ];
    const laptopUsersFiltered = laptopUsers.filter((u: any) => {
      if (laptopUnitFilter !== 'all' && normalizeL(u.unit_office) !== laptopUnitFilter) return false;
      if (laptopDeptFilter !== 'all' && normalizeL(u.division || u.department) !== laptopDeptFilter) return false;
      if (!lq) return true;
      return [u.employee_name, u.designation, u.pc_no, u.dp_lp_no, u.ip_no, u.anydesk_id, u.ultraview_id, u.email, u.mobile, u.phone_no, u.ip_phone, u.antivirus_code, u.division, u.unit_office]
        .some((v) => String(v ?? '').toLowerCase().includes(lq));
    });
    return (
      <div id="print-container" className="dashboard-print-page p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="dashboard-print-header flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleBackFromLaptops}
              className="border border-sky-400 dark:border-sky-400 text-sky-700 dark:text-sky-200 bg-transparent hover:bg-sky-100 dark:hover:bg-sky-500/30 hover:text-sky-900 dark:hover:text-white hover:border-sky-600 dark:hover:border-sky-300 hover:ring-2 hover:ring-sky-400/50 transition-all"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              Laptop Users
            </h1>
            <p className="text-muted-foreground">
              Total: {laptopUsersFiltered.length} of {laptopUsers.length} laptop users
            </p>
          </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 dark:hover:text-purple-100 no-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        <div className="no-print">
          <SearchFilter
            searchTerm={laptopSearch}
            onSearchChange={setLaptopSearch}
            searchPlaceholder="Search by name, PC, IP, email, phone…"
            filters={[
              {
                value: laptopUnitFilter,
                onChange: (v) => { setLaptopUnitFilter(v); setLaptopDeptFilter('all'); },
                options: laptopUnitOptions,
                placeholder: 'Unit/Office',
              },
              {
                value: laptopDeptFilter,
                onChange: setLaptopDeptFilter,
                options: laptopDeptOptions,
                placeholder: 'Department',
              },
            ]}
          />
        </div>

        <div className="dashboard-print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
          {laptopUsersFiltered.map((item: any, i: number) => (
            <UserAssetCard key={item.id} asset={item} index={i} />
          ))}
        </div>

        <table className="dashboard-print-table hidden print:table w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">SL</th>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">Employee Name</th>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">Designation</th>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">Division</th>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">Laptop Configuration</th>
              <th className="border border-purple-400 bg-purple-600 text-white p-2 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {laptopUsers.map((item, i) => (
              <tr key={item.id} className="even:bg-purple-50">
                <td className="border border-purple-300 p-2 text-center">{i + 1}</td>
                <td className="border border-purple-300 p-2 font-medium">{item.employee_name}</td>
                <td className="border border-purple-300 p-2">{item.designation || '-'}</td>
                <td className="border border-purple-300 p-2">{item.division || '-'}</td>
                <td className="border border-purple-300 p-2">{item.laptop_configuration || '-'}</td>
                <td className="border border-purple-300 p-2">{item.mobile || item.phone_no || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Desktops View
  if (viewDesktops) {
    const normalizeD = (v: any) => String(v ?? '').trim() || 'Unassigned';
    const dq = desktopSearch.trim().toLowerCase();
    const desktopUnitOptions = [
      { value: 'all', label: 'All Units/Offices' },
      ...Array.from(new Set(desktopUsers.map((u: any) => normalizeD(u.unit_office)))).sort().map((v) => ({ value: v, label: v })),
    ];
    const desktopDeptOptions = [
      { value: 'all', label: 'All Departments' },
      ...Array.from(new Set(
        desktopUsers
          .filter((u: any) => desktopUnitFilter === 'all' || normalizeD(u.unit_office) === desktopUnitFilter)
          .map((u: any) => normalizeD(u.division || u.department))
      )).sort().map((v) => ({ value: v, label: v })),
    ];
    const desktopUsersFiltered = desktopUsers.filter((u: any) => {
      if (desktopUnitFilter !== 'all' && normalizeD(u.unit_office) !== desktopUnitFilter) return false;
      if (desktopDeptFilter !== 'all' && normalizeD(u.division || u.department) !== desktopDeptFilter) return false;
      if (!dq) return true;
      return [u.employee_name, u.designation, u.pc_no, u.dp_lp_no, u.ip_no, u.anydesk_id, u.ultraview_id, u.email, u.mobile, u.phone_no, u.ip_phone, u.antivirus_code, u.division, u.unit_office]
        .some((v) => String(v ?? '').toLowerCase().includes(dq));
    });
    return (
      <div id="print-container" className="dashboard-print-page p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="dashboard-print-header flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleBackFromDesktops}
              className="border border-sky-400 dark:border-sky-400 text-sky-700 dark:text-sky-200 bg-transparent hover:bg-sky-100 dark:hover:bg-sky-500/30 hover:text-sky-900 dark:hover:text-white hover:border-sky-600 dark:hover:border-sky-300 hover:ring-2 hover:ring-sky-400/50 transition-all"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              Desktop Users
            </h1>
            <p className="text-muted-foreground">
              Total: {desktopUsersFiltered.length} of {desktopUsers.length} desktop users
            </p>
          </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100 no-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        <div className="no-print">
          <SearchFilter
            searchTerm={desktopSearch}
            onSearchChange={setDesktopSearch}
            searchPlaceholder="Search by name, PC, IP, email, phone…"
            filters={[
              {
                value: desktopUnitFilter,
                onChange: (v) => { setDesktopUnitFilter(v); setDesktopDeptFilter('all'); },
                options: desktopUnitOptions,
                placeholder: 'Unit/Office',
              },
              {
                value: desktopDeptFilter,
                onChange: setDesktopDeptFilter,
                options: desktopDeptOptions,
                placeholder: 'Department',
              },
            ]}
          />
        </div>

        <div className="dashboard-print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
          {desktopUsersFiltered.map((item: any, i: number) => (
            <UserAssetCard key={item.id} asset={item} index={i} />
          ))}
        </div>

        <table className="dashboard-print-table hidden print:table w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">SL</th>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">Employee Name</th>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">Designation</th>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">Division</th>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">Desktop Configuration</th>
              <th className="border border-emerald-400 bg-emerald-600 text-white p-2 text-left">Phone</th>
            </tr>
          </thead>
          <tbody>
            {desktopUsers.map((item, i) => (
              <tr key={item.id} className="even:bg-emerald-50">
                <td className="border border-emerald-300 p-2 text-center">{i + 1}</td>
                <td className="border border-emerald-300 p-2 font-medium">{item.employee_name}</td>
                <td className="border border-emerald-300 p-2">{item.designation || '-'}</td>
                <td className="border border-emerald-300 p-2">{item.division || '-'}</td>
                <td className="border border-emerald-300 p-2">{item.desktop_configuration || '-'}</td>
                <td className="border border-emerald-300 p-2">{item.mobile || item.phone_no || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Expired Antivirus View
  if (viewExpiredAntivirus) {
    const normalize = (v: any) => String(v ?? '').trim() || 'Unassigned';
    const q = expiredSearch.trim().toLowerCase();
    const matchesSearch = (row: any) => {
      if (!q) return true;
      return [row.employee_name, row.name, row.designation, row.unit_office, row.division, row.pc_no, row.dp_lp_no, row.ip_no, row.email, row.mobile, row.phone]
        .some((v) => String(v ?? '').toLowerCase().includes(q));
    };
    const assetsFiltered = stats.expiredAntivirusAssets.filter((a: any) => {
      if (expiredUnitFilter !== 'all' && normalize(a.unit_office) !== expiredUnitFilter) return false;
      if (expiredDeptFilter !== 'all' && normalize(a.division) !== expiredDeptFilter) return false;
      return matchesSearch(a);
    });
    const usersFiltered = stats.expiredAntivirusUsers.filter((u: any) => {
      if (expiredUnitFilter !== 'all' && normalize(u.unit_office) !== expiredUnitFilter) return false;
      if (expiredDeptFilter !== 'all' && normalize(u.division || u.department) !== expiredDeptFilter) return false;
      return matchesSearch(u);
    });
    const unitOptions = Array.from(new Set([
      ...stats.expiredAntivirusAssets.map((a: any) => normalize(a.unit_office)),
      ...stats.expiredAntivirusUsers.map((u: any) => normalize(u.unit_office)),
    ])).sort();
    const deptOptions = Array.from(new Set([
      ...stats.expiredAntivirusAssets
        .filter((a: any) => expiredUnitFilter === 'all' || normalize(a.unit_office) === expiredUnitFilter)
        .map((a: any) => normalize(a.division)),
      ...stats.expiredAntivirusUsers
        .filter((u: any) => expiredUnitFilter === 'all' || normalize(u.unit_office) === expiredUnitFilter)
        .map((u: any) => normalize(u.division || u.department)),
    ])).sort();

    const groupBy = <T extends any>(rows: T[], key: (r: T) => string) => {
      const map = new Map<string, T[]>();
      rows.forEach((r) => {
        const k = key(r);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      });
      return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    };
    const assetsByUnit = groupBy(assetsFiltered, (a: any) => normalize(a.unit_office));
    const usersByUnit = groupBy(usersFiltered, (u: any) => normalize(u.unit_office));

    return (
      <div id="print-container" className="dashboard-print-page p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="dashboard-print-header flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleBackFromAntivirus}
              className="border border-sky-400 dark:border-sky-400 text-sky-700 dark:text-sky-200 bg-transparent hover:bg-sky-100 dark:hover:bg-sky-500/30 hover:text-sky-900 dark:hover:text-white hover:border-sky-600 dark:hover:border-sky-300 hover:ring-2 hover:ring-sky-400/50 transition-all"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-red-600 dark:text-red-400">
              Expired Antivirus Licenses
            </h1>
            <p className="text-muted-foreground">
              Total: {stats.expiredAntivirus} expired licenses
            </p>
          </div>
          </div>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-red-300 dark:border-red-500 text-red-700 dark:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/40 dark:hover:text-red-100 no-print"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="no-print flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-sky-200 dark:border-sky-800 rounded-xl p-3">
          <Input
            placeholder="Search by name, designation, PC, IP, email…"
            value={expiredSearch}
            onChange={(e) => setExpiredSearch(e.target.value)}
            className="md:max-w-sm"
          />
          <select
            value={expiredUnitFilter}
            onChange={(e) => setExpiredUnitFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Units/Offices</option>
            {unitOptions.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
          <select
            value={expiredDeptFilter}
            onChange={(e) => setExpiredDeptFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Departments</option>
            {deptOptions.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          {(expiredSearch || expiredUnitFilter !== 'all' || expiredDeptFilter !== 'all') && (
            <Button
              variant="ghost"
              onClick={() => { setExpiredSearch(''); setExpiredUnitFilter('all'); setExpiredDeptFilter('all'); }}
              className="text-sky-700 dark:text-sky-200"
            >
              Clear
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            Showing {usersFiltered.length + assetsFiltered.length} of {stats.expiredAntivirus}
          </div>
        </div>

        {/* Expired Assets */}
        {assetsFiltered.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4 text-sky-800 dark:text-sky-200">Expired IT Assets</h2>

            {/* Print-only header */}
            <div className="hidden print:block mb-4">
              <div style={{ borderBottom: '3px solid #dc2626', paddingBottom: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16pt', fontWeight: 800, color: '#0f172a' }}>MNR Group — IT Department</div>
                    <div style={{ fontSize: '11pt', color: '#dc2626', fontWeight: 700 }}>Expired Antivirus Licenses Report</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '9pt', color: '#475569' }}>
                    <div>Date: {new Date().toLocaleDateString()}</div>
                    <div>Total Expired: <strong style={{ color: '#dc2626' }}>{assetsFiltered.length}</strong></div>
                  </div>
                </div>
              </div>
            </div>

            {assetsByUnit.map(([unit, unitAssets]) => {
              const byDept = groupBy(unitAssets, (a: any) => normalize(a.division));
              return (
              <div key={`a-${unit}`} className="mb-6">
                {unit !== 'Unassigned' && (
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-sky-600" />
                    <h3 className="text-lg font-semibold text-sky-700 dark:text-sky-300">{unit}</h3>
                    <Badge variant="secondary">{unitAssets.length}</Badge>
                  </div>
                )}
                {byDept.map(([dept, deptAssets]) => (
                  <div key={`a-${unit}-${dept}`} className="mb-4">
                    {dept !== 'Unassigned' && (
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 pl-6">{dept}</h4>
                    )}
                    <div className="dashboard-print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 print:hidden">
                      {deptAssets.map((asset: any, i: number) => (
                <div key={asset.id} className="relative">
                  <UserAssetCard
                    asset={{
                      ...asset,
                      antivirus_code: asset.antivirus_code || asset.antivirus_key,
                      antivirus_validity: asset.antivirus_validity,
                    }}
                    index={i}
                  />
                  {asset.antivirus_validity && (
                    <div className="mt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                      Antivirus Expired: {new Date(asset.antivirus_validity).toLocaleDateString()}
                    </div>
                  )}
                </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );})}
            <table
              className="dashboard-print-table hidden print:table"
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', marginTop: 8 }}
            >
              <thead>
                <tr>
                  {['SL', 'Unit / Office', 'Department', 'Employee', 'Designation', 'Device', 'PC / DP-LP', 'IP Address', 'Expired On'].map((h) => (
                    <th
                      key={h}
                      style={{
                        border: '1px solid #dc2626',
                        background: '#dc2626',
                        color: '#fff',
                        padding: '6px 8px',
                        textAlign: 'left',
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assetsFiltered.map((asset: any, i: number) => {
                  const prefix = asset.device_type === 'laptop' ? 'LP' : asset.device_type === 'desktop' ? 'DP' : '';
                  const dpLp = asset.dp_lp_no || (prefix && asset.pc_no ? `${prefix}-${asset.pc_no}` : '-');
                  const rowBg = i % 2 === 0 ? '#ffffff' : '#fef2f2';
                  return (
                    <tr key={asset.id} style={{ background: rowBg, pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px' }}>{asset.unit_office || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px' }}>{asset.division || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', fontWeight: 600 }}>{asset.employee_name || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px' }}>{asset.designation || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', textTransform: 'uppercase' }}>{asset.device_type || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', fontFamily: 'monospace' }}>{dpLp}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', fontFamily: 'monospace' }}>{asset.ip_no || '-'}</td>
                      <td style={{ border: '1px solid #fca5a5', padding: '5px 8px', color: '#b91c1c', fontWeight: 700 }}>
                        {asset.antivirus_validity ? new Date(asset.antivirus_validity).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Print-only footer */}
            <div className="hidden print:block" style={{ marginTop: 16, paddingTop: 8, borderTop: '2px solid #cbd5e1', fontSize: '8pt', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
              <span>Generated by MNR Group IT Department</span>
              <span>Printed on {new Date().toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Dashboard View
  if (!selectedUnit && !selectedDepartment) {
    const q = globalSearchTerm.trim().toLowerCase();
    const digitsOnly = (v: any) => String(v ?? '').replace(/\D/g, '');
    const isNum = /^\d+$/.test(q);
    const assetMatches = q ? allAssets.filter((a: any) => {
      const prefix = a.device_type === 'laptop' ? 'LP' : a.device_type === 'desktop' ? 'DP' : '';
      const dpLp = a.dp_lp_no || (prefix ? `${prefix}-${a.pc_no || ''}` : '');
      if (isNum) {
        return digitsOnly(a.pc_no) === q || digitsOnly(dpLp) === q || digitsOnly(a.sl_no) === q;
      }
      const fields = [a.employee_name, a.pc_no, a.dp_lp_no, dpLp, a.designation, a.division, a.unit_office]
        .map((v) => String(v ?? '').toLowerCase());
      const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${esc}`, 'i');
      return fields.some((f) => re.test(f));
    }) : [];
    const escQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reQ = new RegExp(`\\b${escQ}`, 'i');
    const unitMatches = q ? stats.unitStats.filter((u: any) => {
      const uName = String(u.name || '').toLowerCase();
      if (reQ.test(uName)) return true;
      return allDepartments.some((d: any) =>
        String(d.unit || '').toLowerCase() === uName &&
        reQ.test(String(d.name || ''))
      );
    }) : [];
    const unitsToShow = q ? unitMatches : stats.unitStats;

    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        {/* Unit/Office Cards */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <h2 className="text-2xl font-bold text-sky-800 dark:text-sky-200 whitespace-nowrap">Units & Offices</h2>
            <SearchFilter
              searchTerm={globalSearchTerm}
              onSearchChange={setGlobalSearchTerm}
              searchPlaceholder="Search PC No, DP/LP No, department, user..."
            />
          </div>

          {q && assetMatches.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-sky-700 dark:text-sky-300 mb-3">
                Matching Users ({assetMatches.length})
              </h3>
              {(() => {
                const groups = new Map<string, { unit: string; dept: string; items: any[] }>();
                assetMatches.forEach((a: any) => {
                  const unit = a.unit_office || 'Unassigned Unit';
                  const dept = a.division || 'Unassigned Department';
                  const key = `${unit}||${dept}`;
                  if (!groups.has(key)) groups.set(key, { unit, dept, items: [] });
                  groups.get(key)!.items.push(a);
                });
                const list = Array.from(groups.values());
                return (
                  <div className="space-y-4">
                    {list.map((g, gi) => (
                      <div key={gi} className="mb-1">
                    <div className="inline-flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-sky-100/70 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 w-auto max-w-full">
                      <Building2 className="h-4 w-4 text-sky-700 dark:text-sky-300 flex-shrink-0" />
                      <span className="text-sm font-bold text-sky-800 dark:text-sky-200">{g.unit}</span>
                      <span className="text-sky-400">/</span>
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{g.dept}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {g.items.map((asset: any, i: number) => (
                        <UserAssetCard key={asset.id} asset={asset} index={i} />
                      ))}
                    </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {q && unitsToShow.length === 0 && assetMatches.length === 0 && (
            <div className="text-center text-muted-foreground py-8">No results found for "{globalSearchTerm}"</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(q ? [] : unitsToShow).map((unit) => (
              <Card 
                key={unit.id} 
                className="cursor-pointer animate-scale-in bg-transparent border border-sky-400"
                onClick={() => handleUnitClick(unit)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sky-700 text-xs sm:text-lg min-w-0">
                    <img
                      src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png"
                      alt="MNR Group Logo"
                      className="w-8 h-8 sm:w-12 sm:h-12 flex-shrink-0 rounded-full object-contain bg-white p-1 border border-sky-300 shadow-sm"
                    />
                    <span className="truncate">{unit.name}</span>
                  </CardTitle>
                  <CardDescription className="text-sky-600">
                    {unit.location}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-sky-600">{unit.total_departments}</div>
                      <div className="text-xs text-muted-foreground">Departments</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{unit.total_assets}</div>
                      <div className="text-xs text-muted-foreground">Assets</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* IT Assets Overview - Improved 3D Cards */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-primary">IT Assets Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Assets Card */}
            <Card 
              className="relative overflow-hidden cursor-pointer border-2 border-primary/40 bg-transparent shadow-lg hover:shadow-2xl hover:border-primary hover:shadow-primary/30 transition-all duration-500 group"
              onClick={() => navigate('/accessories')}
            >
              <div className="relative p-5 text-foreground">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-primary">{stats.totalAssets}</div>
                    <div className="text-xs font-semibold text-muted-foreground">Total</div>
                  </div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">IT Assets</h3>
                <p className="text-xs font-medium text-muted-foreground mt-1">All registered devices</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>Click to manage</span>
                </div>
              </div>
            </Card>

            {/* Laptops Card */}
            <Card 
              className="relative overflow-hidden cursor-pointer border-2 border-primary/40 bg-transparent shadow-lg hover:shadow-2xl hover:border-primary hover:shadow-primary/30 transition-all duration-500 group"
              onClick={handleLaptopsClick}
            >
              <div className="relative p-5 text-foreground">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-primary">{stats.totalLaptops}</div>
                    <div className="text-xs font-semibold text-muted-foreground">Laptops</div>
                  </div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">Laptop Devices</h3>
                <p className="text-xs font-medium text-muted-foreground mt-1">Portable computers</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>View all laptops</span>
                </div>
              </div>
            </Card>

            {/* Desktops Card */}
            <Card 
              className="relative overflow-hidden cursor-pointer border-2 border-primary/40 bg-transparent shadow-lg hover:shadow-2xl hover:border-primary hover:shadow-primary/30 transition-all duration-500 group"
              onClick={handleDesktopsClick}
            >
              <div className="relative p-5 text-foreground">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-black text-primary">{stats.totalDesktops}</div>
                    <div className="text-xs font-semibold text-muted-foreground">Desktops</div>
                  </div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">Desktop Computers</h3>
                <p className="text-xs font-medium text-muted-foreground mt-1">Workstations</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>View all desktops</span>
                </div>
              </div>
            </Card>

            {/* Antivirus Card */}
            <Card 
              className={`relative overflow-hidden cursor-pointer border-2 bg-transparent shadow-lg hover:shadow-2xl transition-all duration-500 group ${stats.expiredAntivirus > 0 ? 'border-destructive/50 hover:border-destructive hover:shadow-destructive/30' : 'border-primary/40 hover:border-primary hover:shadow-primary/30'}`}
              onClick={handleAntivirusClick}
            >
              <div className="relative p-5 text-foreground">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${stats.expiredAntivirus > 0 ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-primary/10 border-primary/30 text-primary'}`}>
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-black ${stats.expiredAntivirus > 0 ? 'text-destructive' : 'text-primary'}`}>{stats.expiredAntivirus}</div>
                    <div className="text-xs font-semibold text-muted-foreground">Expired</div>
                  </div>
                </div>
                <h3 className="text-lg font-bold tracking-tight">Antivirus Status</h3>
                <p className="text-xs font-medium text-muted-foreground mt-1">{stats.expiredAntivirus > 0 ? 'Action required' : 'All protected'}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${stats.expiredAntivirus > 0 ? 'bg-destructive' : 'bg-primary'} animate-pulse`} />
                  <span>{stats.expiredAntivirus > 0 ? 'View expired' : 'All updated'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

      </div>
    );
  }

  // Department View - Show department cards for the selected unit
  if (selectedUnit && !selectedDepartment) {
    // Get departments with their stats
    const unitDepartments = selectedUnit.departments.map((department) => {
      const deptStats = stats.departmentStats.find(d => d.id === department.id);
      return {
        ...department,
        total_assets: deptStats?.total_assets || 0,
        assets: deptStats?.assets || []
      };
    });

    const filteredDepartments = unitDepartments.filter((d) => {
      const q = deptSearchTerm.trim().toLowerCase();
      if (!q) return true;
      return (
        d.name?.toLowerCase().includes(q) ||
        d.head?.toLowerCase?.().includes(q) ||
        d.location?.toLowerCase?.().includes(q)
      );
    });

    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleBackToUnits}
              className="border border-sky-400 dark:border-sky-400 text-sky-700 dark:text-sky-200 bg-transparent hover:bg-sky-100 dark:hover:bg-sky-500/30 hover:text-sky-900 dark:hover:text-white hover:border-sky-600 dark:hover:border-sky-300 hover:ring-2 hover:ring-sky-400/50 transition-all"
              aria-label="Back to Units"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xs sm:text-3xl font-bold text-sky-800 dark:text-sky-200">
              {selectedUnit.name} - Departments
            </h1>
            <p className="text-[10px] sm:text-sm text-muted-foreground">{selectedUnit.location} • {unitDepartments.length} departments</p>
          </div>
          </div>
        </div>

        <SearchFilter
          searchTerm={deptSearchTerm}
          onSearchChange={setDeptSearchTerm}
          searchPlaceholder="Search departments by name, head, or location..."
        />

        {filteredDepartments.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200">
            <CardContent className="text-center py-12">
              <Building2 className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
              <p className="text-gray-500">{deptSearchTerm ? 'Try a different search term' : 'Add departments to this unit'}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDepartments.map((department, index) => (
              <Card 
                key={department.id} 
                className="cursor-pointer relative overflow-hidden border border-indigo-400 hover:border-indigo-500 bg-transparent shadow-lg hover:shadow-2xl transition-all duration-500 group"
                style={{ 
                  transform: 'perspective(1000px) rotateY(-2deg) rotateX(2deg)',
                  transformStyle: 'preserve-3d',
                  animationDelay: `${index * 0.1}s`
                }}
                onClick={() => handleDepartmentClick({
                  ...department,
                  total_assets: department.total_assets,
                  assets: department.assets
                })}
              >
                <div className="relative p-5 text-indigo-700 dark:text-indigo-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      <Building2 className="h-7 w-7" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black">{department.total_assets}</div>
                      <div className="text-xs opacity-70">Assets</div>
                    </div>
                  </div>
                  <h3 className="text-[11px] sm:text-lg font-bold truncate">{department.name}</h3>
                  <p className="text-xs opacity-60 mt-1">Click to view assets</p>
                  <div className="mt-3 flex items-center gap-2 text-xs opacity-70">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span>{department.total_assets} IT users</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // User List View - same card design as above
  if (selectedDepartment) {
    const filteredAssets = (selectedDepartment.assets || []).filter((a: any) => {
      const q = assetSearchTerm.trim().toLowerCase();
      const matchesSearch = !q || [
        a.employee_name,
        a.designation,
        a.division,
        a.phone_no,
        a.mobile,
        a.device_type,
      ].some((v: any) => v?.toString().toLowerCase().includes(q));
      const matchesDevice =
        assetDeviceFilter === "all" ||
        (a.device_type || "").toLowerCase() === assetDeviceFilter;
      return matchesSearch && matchesDevice;
    });

    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Button 
              variant="ghost"
              size="icon"
              onClick={handleBackToDepartments}
              className="border border-sky-400 dark:border-sky-400 text-sky-700 dark:text-sky-200 bg-transparent hover:bg-sky-100 dark:hover:bg-sky-500/30 hover:text-sky-900 dark:hover:text-white hover:border-sky-600 dark:hover:border-sky-300 hover:ring-2 hover:ring-sky-400/50 transition-all"
              aria-label="Back to Departments"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-sky-800 dark:text-sky-200">
              {selectedDepartment.name} - Assets
            </h1>
            <p className="text-muted-foreground">
              {filteredAssets.length} of {selectedDepartment.total_assets} assets
            </p>
          </div>
          </div>
        </div>

        <SearchFilter
          searchTerm={assetSearchTerm}
          onSearchChange={setAssetSearchTerm}
          searchPlaceholder="Search by name, designation, phone, division..."
          filters={[
            {
              value: assetDeviceFilter,
              onChange: setAssetDeviceFilter,
              placeholder: "Device Type",
              options: [
                { value: "all", label: "All Devices" },
                { value: "laptop", label: "Laptop" },
                { value: "desktop", label: "Desktop" },
              ],
            },
          ]}
        />

        {filteredAssets.length === 0 ? (
          <Card className="bg-transparent border border-amber-300 dark:border-amber-700">
            <CardContent className="text-center py-12">
              <Monitor className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No assets found</h3>
              <p className="text-muted-foreground">
                {assetSearchTerm || assetDeviceFilter !== "all" ? 'Try different search or filter' : 'Add IT assets to see data here'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset: any, index: number) => (
              <UserAssetCard key={asset.id} asset={asset} index={index} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default Dashboard;