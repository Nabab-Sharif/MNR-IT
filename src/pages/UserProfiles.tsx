import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  UserCircle, 
  Camera, 
  Download, 
  Edit,
  Shield,
  Mouse,
  Keyboard,
  Package,
  Calendar,
  Building2,
  Phone,
  Mail,
  BadgeCheck,
  Plus,
  Trash2,
  Printer,
  Bell,
  Clock,
  Monitor,
  Battery,
  MapPin,
  Users
} from "lucide-react";
import dbService from "@/services/dbService";
import { usePerm } from "@/hooks/usePerm";

const UserProfiles = () => {
  const { toast } = useToast();
  const perm = usePerm();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [userActivities, setUserActivities] = useState([]);
  const [userStats, setUserStats] = useState({});
  const [recentActivities, setRecentActivities] = useState({});
  const [newActivity, setNewActivity] = useState({
    type: "",
    details: "",
    quantity: 1
  });
  const [assets, setAssets] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [showActivitiesDialog, setShowActivitiesDialog] = useState(false);
  const [showUpdatesDialog, setShowUpdatesDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [newSchedule, setNewSchedule] = useState({
    title: "",
    description: "",
    time: "",
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()
  });
  const [editFormData, setEditFormData] = useState({
    name: "",
    designation: "",
    phone: "",
    email: "",
    id_number: "",
    department_id: "",
    antivirus_expiry: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = allEmployees.find(u => u.id.toString() === selectedUserId);
      setSelectedUser(user);
      if (user && !user.fromAsset) {
        loadUserData(user.id);
        // Populate edit form
        setEditFormData({
          name: user.name || "",
          designation: user.designation || "",
          phone: user.phone || "",
          email: user.email || "",
          id_number: user.id_number || "",
          department_id: user.department_id || "",
          antivirus_expiry: user.antivirus_expiry || ""
        });
      }
    }
  }, [selectedUserId, allEmployees]);

  const loadData = async () => {
    const usersData = await dbService.getUsers();
    const departmentsData = await dbService.getDepartments();
    const unitsData = await dbService.getUnits();
    const recentActivitiesData = await dbService.getRecentActivities();
    const assetsData = await dbService.getITAssets();
    const schedulesData = await dbService.getTomorrowSchedules();
    
    setUsers(usersData);
    setDepartments(departmentsData);
    setUnits(unitsData);
    setRecentActivities(recentActivitiesData);
    setAssets(assetsData);
    setSchedules(schedulesData);
    
    // Combine users from both users table and assets
    const employeesFromAssets = assetsData
      .filter(asset => asset.employee_name && asset.employee_name.trim() !== '')
      .map(asset => {
        const dept = departmentsData.find(d => d.name === asset.division);
        return {
          id: `asset_${asset.id}`,
          name: asset.employee_name,
          designation: asset.designation,
          phone: asset.mobile || asset.phone_no,
          email: asset.email,
          department_id: dept?.id.toString() || '1',
          antivirus_expiry: asset.antivirus_validity,
          device_type: asset.device_type,
          fromAsset: true,
          assetId: asset.id
        };
      });
    
    // Merge and remove duplicates based on name
    const userNames = new Set(usersData.map(u => u.name.trim().toLowerCase()));
    const uniqueAssetEmployees = employeesFromAssets.filter(
      emp => !userNames.has(emp.name.trim().toLowerCase())
    );
    
    const combined = [...usersData, ...uniqueAssetEmployees];
    setAllEmployees(combined);
  };

  const loadUserData = async (userId) => {
    const activities = await dbService.getUserActivities(userId);
    const stats = await dbService.getUserStats(userId);
    setUserActivities(activities);
    setUserStats(stats);
  };

  const getUserDepartment = (departmentId) => {
    return departments.find(dept => dept.id.toString() === departmentId);
  };

  const getUserUnit = (user) => {
    const dept = getUserDepartment(user.department_id);
    return units.find(unit => unit.name === dept?.unit);
  };

  const handlePictureCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setProfilePicture(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleAddActivity = async () => {
    if (selectedUserId && newActivity.type) {
      const activity = await dbService.addUserActivity(selectedUserId, newActivity);
      setUserActivities(prev => [...prev, activity]);
      await loadUserData(selectedUserId);
      setNewActivity({ type: "", details: "", quantity: 1 });
      toast({
        title: "Activity added",
        description: "User activity has been recorded successfully.",
      });
    }
  };

  const handleDeleteActivity = async (activityId) => {
    await dbService.deleteUserActivity(activityId);
    setUserActivities(prev => prev.filter(a => a.id !== activityId));
    await loadUserData(selectedUserId);
    toast({
      title: "Activity deleted",
      description: "Activity has been removed successfully.",
    });
  };

  const printProfile = () => {
    window.print();
  };

  const handleAddSchedule = async () => {
    if (newSchedule.title && newSchedule.time) {
      await dbService.addSchedule(newSchedule);
      await loadData();
      setNewSchedule({
        title: "",
        description: "",
        time: "",
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()
      });
      toast({
        title: "Schedule added",
        description: "Tomorrow's schedule has been added successfully.",
      });
    }
  };

  const handleUpdateSchedule = async () => {
    if (editingSchedule && newSchedule.title && newSchedule.time) {
      await dbService.updateSchedule(editingSchedule.id, newSchedule);
      await loadData();
      setEditingSchedule(null);
      setNewSchedule({
        title: "",
        description: "",
        time: "",
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()
      });
      toast({
        title: "Schedule updated",
        description: "Schedule has been updated successfully.",
      });
    }
  };

  const handleDeleteSchedule = async (id) => {
    await dbService.deleteSchedule(id);
    await loadData();
    toast({
      title: "Schedule deleted",
      description: "Schedule has been removed successfully.",
    });
  };

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      title: schedule.title,
      description: schedule.description || "",
      time: schedule.time,
      date: schedule.date
    });
  };

  const handleSaveProfile = async () => {
    if (selectedUser && !selectedUser.fromAsset) {
      try {
        await dbService.updateUser(selectedUser.id, {
          ...editFormData,
          profile_picture: profilePicture || selectedUser.profile_picture
        });
        
        // Update local state
        const updatedUser = {
          ...selectedUser,
          ...editFormData,
          profile_picture: profilePicture || selectedUser.profile_picture
        };
        setSelectedUser(updatedUser);
        
        // Reload data
        await loadData();
        
        setIsEditDialogOpen(false);
        toast({
          title: "Profile updated",
          description: "User profile has been updated successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update profile. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  const getFilteredUsers = () => {
    if (!selectedUnit) return allEmployees;
    return allEmployees.filter(user => {
      const dept = getUserDepartment(user.department_id);
      return dept && dept.unit === selectedUnit;
    });
  };

  // Show unit selection if no unit is selected
  if (!selectedUnit) {
    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
              Total Users
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Select a unit to view user profiles
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => {
            const unitUsers = allEmployees.filter(user => {
              const dept = getUserDepartment(user.department_id);
              return dept && dept.unit === unit.name;
            });
            
            return (
              <Card 
                key={unit.id} 
                className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 bg-white/80 backdrop-blur-sm border-sky-200 hover:border-sky-400"
                onClick={() => setSelectedUnit(unit.name)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-sky-700">
                    <MapPin className="h-5 w-5" />
                    <span>{unit.name}</span>
                  </CardTitle>
                  <CardDescription className="text-sky-600">
                    {unit.location}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-emerald-600" />
                      <span className="text-2xl font-bold text-emerald-600">{unitUsers.length}</span>
                      <span className="text-sm text-muted-foreground">Users</span>
                    </div>
                    <Button variant="outline" size="sm">
                      View Profiles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Activities Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="bg-white/80 backdrop-blur-sm border-green-200 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            onClick={() => setShowActivitiesDialog(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700">
                <Calendar className="h-5 w-5" />
                <span>Today's Activities</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{(recentActivities as any).today?.length || 0}</div>
              <p className="text-sm text-muted-foreground">New activities today</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-white/80 backdrop-blur-sm border-blue-200 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            onClick={() => setShowScheduleDialog(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-700">
                <Clock className="h-5 w-5" />
                <span>Tomorrow's Schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{schedules.length}</div>
              <p className="text-sm text-muted-foreground">Scheduled activities</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-white/80 backdrop-blur-sm border-purple-200 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            onClick={() => setShowUpdatesDialog(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-purple-700">
                <Bell className="h-5 w-5" />
                <span>Recent Updates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{(recentActivities as any).recent?.length || 0}</div>
              <p className="text-sm text-muted-foreground">Recent profile changes</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show user selection if no user is selected
  if (!selectedUser) {
    const filteredUsers = getFilteredUsers();
    
    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="outline" 
              onClick={() => setSelectedUnit("")}
              className="mb-4 border-sky-200 text-sky-700 hover:bg-sky-50"
            >
              ← Back to Units
            </Button>
            <h1 className="text-3xl font-bold text-sky-800 dark:text-sky-200">
              {selectedUnit} - User Profiles
            </h1>
            <p className="text-muted-foreground">{filteredUsers.length} users</p>
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200">
            <CardContent className="text-center py-12">
              <Monitor className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets in This Unit</h3>
              <p className="text-gray-500">
                Add new assets in the IT Assets page
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => {
            const dept = getUserDepartment(user.department_id);
            
            return (
              <Card 
                key={user.id} 
                className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 bg-white/80 backdrop-blur-sm border-sky-200 hover:border-sky-400"
                onClick={() => setSelectedUserId(user.id.toString())}
              >
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.profile_picture} />
                      <AvatarFallback className="bg-sky-100 text-sky-700">
                        {user.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sky-700">{user.name}</CardTitle>
                      <CardDescription>{user.designation || 'N/A'}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{dept?.name || 'N/A'}</span>
                  </div>

                  {user.fromAsset && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Monitor className="h-4 w-4 text-blue-600" />
                      <Badge variant="secondary" className="text-xs">
                        {user.device_type?.toUpperCase() || 'IT Asset'}
                      </Badge>
                    </div>
                  )}

                  {user.antivirus_expiry && (
                    <div className="flex items-center space-x-2 text-sm">
                      <Shield className="h-4 w-4" />
                      <span className={new Date(user.antivirus_expiry) < new Date() ? 'text-red-600 font-medium' : 'text-green-600'}>
                        Antivirus: {new Date(user.antivirus_expiry).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Individual user profile view
  return (
    <div className="p-6 space-y-6 min-h-screen print:bg-white print:shadow-none">
      {/* Print Header - Hidden on screen, shown in print */}
      <div className="print-header hidden print:block">
        <div className="flex items-center justify-between mb-4">
          <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR Group Logo" className="h-16" />
          <h1 className="text-3xl font-bold text-sky-700">MNR Group</h1>
        </div>
        <h2 className="text-xl font-semibold text-center text-gray-700 border-t-2 border-sky-500 pt-3">User Profile</h2>
      </div>

      <div className="flex items-center justify-between print:mb-8 no-print">
        <div>
          <Button 
            variant="outline" 
            onClick={() => setSelectedUserId("")}
            className="mb-4 border-sky-200 text-sky-700 hover:bg-sky-50 print:hidden"
          >
            ← Back to Users
          </Button>
          <div className="flex items-center gap-4">
            <img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" alt="MNR Group Logo" className="h-10" />
            <h1 className="text-3xl font-bold text-sky-800 dark:text-sky-200 print:text-black">
              MNR Group
            </h1>
            <span className="text-2xl font-semibold text-sky-700 dark:text-sky-300 border-l border-sky-300 pl-4">
              {selectedUser.name}
            </span>
          </div>
        </div>
        <div className="flex space-x-2 print:hidden">
          {!selectedUser?.fromAsset && perm.edit && (
            <Button 
              onClick={() => setIsEditDialogOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          )}
          <Button 
            onClick={printProfile}
            className="bg-sky-500 hover:bg-sky-600 text-white"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Profile
          </Button>
        </div>
      </div>

      <div id="user-profile-content" className="print:print-container">
        {/* Profile Header */}
        <Card className="bg-transparent border-sky-200 print:shadow-none print:border-0 print-section">
          <CardContent className="p-6">
            <div className="flex items-start space-x-6 print:flex-col print:items-center">

              <div className="flex-1 space-y-4 print:w-full">
                <div className="hidden print:block print:text-center">
                  <h2 className="text-2xl font-bold text-sky-800 print:text-black">{selectedUser.name}</h2>
                  <p className="text-lg text-muted-foreground">{selectedUser.designation || 'N/A'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-info-grid">
                  <div className="space-y-3 print-info-item">
                    <div className="flex items-center space-x-2">
                      <BadgeCheck className="h-4 w-4 text-muted-foreground print:hidden" />
                      <span className="text-sm print-info-label print:hidden">ID</span>
                      <span className="text-sm print-info-value">{selectedUser.id_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground print:hidden" />
                      <span className="text-sm print-info-label print:hidden">Phone</span>
                      <span className="text-sm print-info-value">{selectedUser.phone || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground print:hidden" />
                      <span className="text-sm print-info-label print:hidden">Email</span>
                      <span className="text-sm print-info-value">{selectedUser.email || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 print-info-item">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-muted-foreground print:hidden" />
                      <span className="text-sm print-info-label print:hidden">Department</span>
                      <span className="text-sm print-info-value">{getUserDepartment(selectedUser.department_id)?.name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground print:hidden" />
                      <span className="text-sm print-info-label print:hidden">Location</span>
                      <span className="text-sm print-info-value">{getUserUnit(selectedUser)?.location || 'N/A'}</span>
                    </div>
                    {selectedUser.antivirus_expiry && (
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 print:hidden" />
                        <span className={`text-sm ${new Date(selectedUser.antivirus_expiry) < new Date() ? 'text-red-600 font-medium' : 'text-green-600'} print-info-value`}>
                          Antivirus: {new Date(selectedUser.antivirus_expiry).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 print-section">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Mouse className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).mouse || 0}</div>
            <div className="text-xs opacity-80">Mouse</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Keyboard className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).keyboard || 0}</div>
            <div className="text-xs opacity-80">Keyboard</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).antivirus || 0}</div>
            <div className="text-xs opacity-80">Antivirus</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Battery className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).battery || 0}</div>
            <div className="text-xs opacity-80">Battery</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500 to-green-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Monitor className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).laptop_exchanges || 0}</div>
            <div className="text-xs opacity-80">Laptop</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white border-0">
          <CardContent className="p-4 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <div className="text-2xl font-bold">{(userStats as any).pc_exchanges || 0}</div>
            <div className="text-xs opacity-80">PC Exchange</div>
          </CardContent>
        </Card>
      </div>

      {/* Add Activity Section */}
      <Card className="bg-white/80 backdrop-blur-sm border-sky-200 print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-sky-700">
            <Plus className="h-5 w-5" />
            <span>Add New Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="activity-type">Activity Type</Label>
              <Select value={newActivity.type} onValueChange={(value) => setNewActivity(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mouse">Mouse</SelectItem>
                  <SelectItem value="keyboard">Keyboard</SelectItem>
                  <SelectItem value="antivirus">Antivirus</SelectItem>
                  <SelectItem value="battery">Battery</SelectItem>
                  <SelectItem value="laptop_exchange">Laptop Exchange</SelectItem>
                  <SelectItem value="pc_exchange">PC Exchange</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="activity-quantity">Quantity</Label>
              <Input
                id="activity-quantity"
                type="number"
                min="1"
                value={newActivity.quantity}
                onChange={(e) => setNewActivity(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            
            <div>
              <Label htmlFor="activity-details">Details</Label>
              <Input
                id="activity-details"
                placeholder="Additional details"
                value={newActivity.details}
                onChange={(e) => setNewActivity(prev => ({ ...prev, details: e.target.value }))}
              />
            </div>
          </div>
          
          {perm.add && <Button onClick={handleAddActivity} className="bg-sky-500 hover:bg-sky-600 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add Activity
          </Button>}
        </CardContent>
      </Card>

      {/* Activities History */}
      <Card className="bg-white/80 backdrop-blur-sm border-sky-200 print:shadow-none print:border-0 print-section">
        <CardHeader className="print:pb-2">
          <CardTitle className="flex items-center space-x-2 text-sky-700 print:text-black">
            <Calendar className="h-5 w-5" />
            <span>Activity History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userActivities.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No activities recorded</p>
            ) : (
              userActivities.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-sky-50 dark:bg-slate-800 rounded-lg print:bg-gray-50 print:border print:border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-sky-100 dark:bg-slate-700 rounded-full">
                      {activity.type === 'mouse' && <Mouse className="h-4 w-4 text-sky-600" />}
                      {activity.type === 'keyboard' && <Keyboard className="h-4 w-4 text-sky-600" />}
                      {activity.type === 'antivirus' && <Shield className="h-4 w-4 text-sky-600" />}
                      {activity.type === 'battery' && <Battery className="h-4 w-4 text-sky-600" />}
                      {(activity.type === 'laptop_exchange' || activity.type === 'pc_exchange') && <Monitor className="h-4 w-4 text-sky-600" />}
                    </div>
                    <div>
                      <div className="font-medium text-sky-800 dark:text-sky-200 print:text-black">
                        {activity.type.replace('_', ' ').toUpperCase()} 
                        {activity.quantity > 1 && ` (${activity.quantity})`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.details && `${activity.details} • `}
                        {activity.date} at {activity.time}
                      </div>
                    </div>
                  </div>
                  {perm.delete && <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="text-red-600 hover:text-red-800 print:hidden"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-blue-700">
              <Edit className="h-5 w-5" />
              <span>Edit User Profile</span>
            </DialogTitle>
            <DialogDescription>
              Update user profile information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-designation">Designation</Label>
                <Input
                  id="edit-designation"
                  value={editFormData.designation}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, designation: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-id">ID Number</Label>
                <Input
                  id="edit-id"
                  value={editFormData.id_number}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, id_number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-department">Department</Label>
                <Select 
                  value={editFormData.department_id} 
                  onValueChange={(value) => setEditFormData(prev => ({ ...prev, department_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id.toString()}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-antivirus">Antivirus Expiry Date</Label>
              <Input
                id="edit-antivirus"
                type="date"
                value={editFormData.antivirus_expiry}
                onChange={(e) => setEditFormData(prev => ({ ...prev, antivirus_expiry: e.target.value }))}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} className="bg-blue-500 hover:bg-blue-600 text-white">
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Today's Activities Dialog */}
      <Dialog open={showActivitiesDialog} onOpenChange={setShowActivitiesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-green-700">
              <Calendar className="h-5 w-5" />
              <span>Today's Activities</span>
            </DialogTitle>
            <DialogDescription>
              Activities recorded today across all users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(recentActivities as any).today?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No activities today</p>
            ) : (
              (recentActivities as any).today?.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      {activity.type === 'mouse' && <Mouse className="h-4 w-4 text-green-600" />}
                      {activity.type === 'keyboard' && <Keyboard className="h-4 w-4 text-green-600" />}
                      {activity.type === 'antivirus' && <Shield className="h-4 w-4 text-green-600" />}
                      {activity.type === 'battery' && <Battery className="h-4 w-4 text-green-600" />}
                      {(activity.type === 'laptop_exchange' || activity.type === 'pc_exchange') && <Monitor className="h-4 w-4 text-green-600" />}
                    </div>
                    <div>
                      <div className="font-medium text-green-800">
                        {activity.type.replace('_', ' ').toUpperCase()}
                        {activity.quantity > 1 && ` (${activity.quantity})`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.details && `${activity.details} • `}
                        {activity.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Updates Dialog */}
      <Dialog open={showUpdatesDialog} onOpenChange={setShowUpdatesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-purple-700">
              <Bell className="h-5 w-5" />
              <span>Recent Updates</span>
            </DialogTitle>
            <DialogDescription>
              Recent profile changes and updates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(recentActivities as any).recent?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recent updates</p>
            ) : (
              (recentActivities as any).recent?.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-full">
                      {activity.type === 'mouse' && <Mouse className="h-4 w-4 text-purple-600" />}
                      {activity.type === 'keyboard' && <Keyboard className="h-4 w-4 text-purple-600" />}
                      {activity.type === 'antivirus' && <Shield className="h-4 w-4 text-purple-600" />}
                      {activity.type === 'battery' && <Battery className="h-4 w-4 text-purple-600" />}
                      {(activity.type === 'laptop_exchange' || activity.type === 'pc_exchange') && <Monitor className="h-4 w-4 text-purple-600" />}
                    </div>
                    <div>
                      <div className="font-medium text-purple-800">
                        {activity.type.replace('_', ' ').toUpperCase()}
                        {activity.quantity > 1 && ` (${activity.quantity})`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.details && `${activity.details} • `}
                        {activity.date} at {activity.time}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tomorrow's Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-blue-700">
              <Clock className="h-5 w-5" />
              <span>Tomorrow's Schedule</span>
            </DialogTitle>
            <DialogDescription>
              Manage scheduled activities for tomorrow
            </DialogDescription>
          </DialogHeader>
          
          {/* Add/Edit Schedule Form */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="schedule-title">Title</Label>
                  <Input
                    id="schedule-title"
                    placeholder="Activity title"
                    value={newSchedule.title}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-time">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={newSchedule.time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="schedule-description">Description</Label>
                <Textarea
                  id="schedule-description"
                  placeholder="Additional details"
                  value={newSchedule.description}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="flex space-x-2">
                {editingSchedule ? (
                  <>
                    <Button onClick={handleUpdateSchedule} className="bg-blue-500 hover:bg-blue-600 text-white flex-1">
                      Update Schedule
                    </Button>
                    <Button 
                      onClick={() => {
                        setEditingSchedule(null);
                        setNewSchedule({
                          title: "",
                          description: "",
                          time: "",
                          date: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()
                        });
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  perm.add && <Button onClick={handleAddSchedule} className="bg-blue-500 hover:bg-blue-600 text-white w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Schedule
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Schedules List */}
          <div className="space-y-3">
            {schedules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No schedules for tomorrow</p>
            ) : (
              schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="font-medium text-blue-800">{schedule.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {schedule.time}
                      {schedule.description && ` • ${schedule.description}`}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {perm.edit && <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSchedule(schedule)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>}
                    {perm.delete && <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Print Footer */}
      <div className="print-footer hidden print:block">
        <p>Created by IT Team - MNR Group</p>
        <p className="text-xs mt-1">Generated on {new Date().toLocaleDateString()}</p>
      </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:text-black {
            color: black !important;
          }
          .print\\:border {
            border: 1px solid #e5e7eb !important;
          }
          .print\\:border-gray-300 {
            border-color: #d1d5db !important;
          }
          .print\\:border-gray-200 {
            border-color: #e5e7eb !important;
          }
          .print\\:bg-gray-50 {
            background-color: #f9fafb !important;
          }
          .print\\:mb-8 {
            margin-bottom: 2rem !important;
          }
          .print\\:pb-2 {
            padding-bottom: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

export default UserProfiles;