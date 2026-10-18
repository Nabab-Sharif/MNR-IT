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
  Copy,
  Key
} from "lucide-react";
import dbService from "@/services/dbService";

const Profile = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    id_number: "",
    phone_number: "",
    email: "",
    department_id: "",
    position: "",
    antivirus_status: "Active",
    antivirus_start_date: "",
    antivirus_expiry: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === parseInt(selectedUserId));
      setSelectedUser(user);
    } else {
      setSelectedUser(null);
    }
  }, [selectedUserId, users]);

  const loadData = async () => {
    const usersData = await dbService.getUsers();
    const departmentsData = await dbService.getDepartments();
    const accessoriesData = await dbService.getAccessories();
    
    setUsers(usersData);
    setDepartments(departmentsData);
    setAccessories(accessoriesData);
  };

  const getUserAccessories = (userId) => {
    return accessories.filter(acc => acc.user_id === userId.toString());
  };

  const getUserDepartment = (departmentId) => {
    return departments.find(dept => dept.id === parseInt(departmentId));
  };

  const getAccessoryStats = (userId) => {
    const userAccessories = getUserAccessories(userId);
    return {
      total: userAccessories.length,
      active: userAccessories.filter(a => a.status === "active").length,
      damaged: userAccessories.filter(a => a.status === "damaged").length,
      exchanged: userAccessories.filter(a => a.status === "exchanged").length,
      mouse: userAccessories.filter(a => a.type === "mouse").length,
      keyboard: userAccessories.filter(a => a.type === "keyboard").length,
      batteries: userAccessories.filter(a => a.battery_status === "critical").length
    };
  };

  const isAntivirusExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const handlePictureCapture = () => {
    // In a real app, this would open camera
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setProfilePicture(e.target.result);
          // In a real app, save to user profile
          toast({
            title: "Profile picture updated",
            description: "Profile picture has been updated successfully.",
          });
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
  };

  const handlePictureDownload = () => {
    if (profilePicture) {
      const link = document.createElement('a');
      link.href = profilePicture;
      link.download = `${selectedUser?.name || 'user'}_profile.jpg`;
      link.click();
    }
  };

  const printProfile = () => {
    window.print();
  };

  const handleEditProfile = () => {
    if (selectedUser) {
      setEditFormData({
        name: selectedUser.name || "",
        id_number: selectedUser.id_number || "",
        phone_number: selectedUser.phone_number || "",
        email: selectedUser.email || "",
        department_id: selectedUser.department_id || "",
        position: selectedUser.position || "",
        antivirus_status: selectedUser.antivirus_status || "Active",
        antivirus_start_date: selectedUser.antivirus_start_date || "",
        antivirus_expiry: selectedUser.antivirus_expiry || "",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    if (selectedUser) {
      await dbService.updateUser(selectedUser.id, editFormData);
      await loadData();
      
      toast({
        title: "Profile updated",
        description: "User profile has been updated successfully.",
      });
      setIsEditDialogOpen(false);
    }
  };

  if (!selectedUser) {
    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-4">ইউজার প্রোফাইল</h1>
          <Card className="max-w-md mx-auto bg-white/80 backdrop-blur-sm border-sky-200">
            <CardHeader>
              <CardTitle className="text-sky-700">
                {users.length === 0 ? "কোনো ইউজার নেই" : "ইউজার সিলেক্ট করুন"}
              </CardTitle>
              <CardDescription>
                {users.length === 0 
                  ? "প্রোফাইল দেখার জন্য প্রথমে Users পেজ থেকে ইউজার যোগ করুন" 
                  : "প্রোফাইল দেখার জন্য একজন ইউজার বাছাই করুন"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-4">
                  <UserCircle className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">
                    এখনো কোনো ইউজার তৈরি করা হয়নি
                  </p>
                  <Button onClick={() => window.location.href = '/users'}>
                    Users পেজে যান
                  </Button>
                </div>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="ইউজার বাছাই করুন" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name} - {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const department = getUserDepartment(selectedUser.department_id);
  const userAccessories = getUserAccessories(selectedUser.id);
  const stats = getAccessoryStats(selectedUser.id);
  const antivirusExpired = isAntivirusExpired(selectedUser.antivirus_expiry);

  return (
    <div className="p-6 space-y-6 print:p-4 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">User Profile</h1>
          <p className="text-lg text-muted-foreground">
            Detailed user information and activity
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {user.name} - {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleEditProfile} variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
          <Button onClick={printProfile}>
            <Download className="mr-2 h-4 w-4" />
            Print Profile
          </Button>
        </div>
      </div>

      {/* Profile Header */}
      <Card className={antivirusExpired ? "border-expired" : ""}>
        <CardContent className="p-6">
          <div className="flex items-start space-x-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profilePicture} />
                <AvatarFallback className="text-xl">
                  {selectedUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 flex space-x-1 print:hidden">
                <Button size="sm" variant="outline" onClick={handlePictureCapture}>
                  <Camera className="h-3 w-3" />
                </Button>
                {profilePicture && (
                  <Button size="sm" variant="outline" onClick={handlePictureDownload}>
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedUser.name}</h2>
                  <p className="text-muted-foreground">{selectedUser.position || 'No position specified'}</p>
                </div>
                {antivirusExpired && (
                  <Badge variant="destructive" className="text-expired-foreground bg-expired">
                    Antivirus Expired
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-center space-x-2">
                  <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">ID: {selectedUser.id_number || selectedUser.id}</span>
                </div>
                <button
                  onClick={() => {
                    if (selectedUser.email) {
                      navigator.clipboard.writeText(selectedUser.email);
                      toast({ title: "Copied!", description: `Email: ${selectedUser.email}` });
                    }
                  }}
                  className="flex items-center space-x-2 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors group"
                >
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedUser.email}</span>
                  <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() => {
                    if (selectedUser.phone_number) {
                      navigator.clipboard.writeText(selectedUser.phone_number);
                      toast({ title: "Copied!", description: `Phone: ${selectedUser.phone_number}` });
                    }
                  }}
                  className="flex items-center space-x-2 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors group"
                >
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedUser.phone_number || 'No phone number'}</span>
                  {selectedUser.phone_number && <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
                <div className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{department?.name || 'No department'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => {
                    const antivirusInfo = `${selectedUser.antivirus_status || 'N/A'} - Expiry: ${selectedUser.antivirus_expiry || 'N/A'}`;
                    navigator.clipboard.writeText(antivirusInfo);
                    toast({ title: "Copied!", description: `Antivirus: ${antivirusInfo}` });
                  }}
                  className="flex items-center space-x-2 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors group"
                >
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Antivirus: {selectedUser.antivirus_status || 'Not specified'}
                    {selectedUser.antivirus_expiry && (
                      <span className={antivirusExpired ? "text-expired ml-1" : "ml-1"}>
                        (Exp: {selectedUser.antivirus_expiry})
                      </span>
                    )}
                  </span>
                  <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Total Items</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Mouse Count</p>
                <p className="text-2xl font-bold">{stats.mouse}</p>
              </div>
              <Mouse className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Keyboard Count</p>
                <p className="text-2xl font-bold">{stats.keyboard}</p>
              </div>
              <Keyboard className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Exchanges</p>
                <p className="text-2xl font-bold">{stats.exchanged}</p>
              </div>
              <Edit className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update user information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="id_number">ID Number</Label>
                <Input
                  id="id_number"
                  value={editFormData.id_number}
                  onChange={(e) => setEditFormData({...editFormData, id_number: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  value={editFormData.phone_number}
                  onChange={(e) => setEditFormData({...editFormData, phone_number: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">Department</Label>
                <Select 
                  value={editFormData.department_id} 
                  onValueChange={(value) => setEditFormData({...editFormData, department_id: value})}
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
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={editFormData.position}
                  onChange={(e) => setEditFormData({...editFormData, position: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="antivirus_status">Antivirus Status</Label>
                <Select 
                  value={editFormData.antivirus_status} 
                  onValueChange={(value) => setEditFormData({...editFormData, antivirus_status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Not Installed">Not Installed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="antivirus_start_date">Start Date</Label>
                <Input
                  id="antivirus_start_date"
                  type="date"
                  value={editFormData.antivirus_start_date}
                  onChange={(e) => setEditFormData({...editFormData, antivirus_start_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="antivirus_expiry">Expiry Date</Label>
                <Input
                  id="antivirus_expiry"
                  type="date"
                  value={editFormData.antivirus_expiry}
                  onChange={(e) => setEditFormData({...editFormData, antivirus_expiry: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Update Profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Accessories History */}
      <Card>
        <CardHeader>
          <CardTitle>Accessories History</CardTitle>
          <CardDescription>
            Complete history of issued accessories and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userAccessories.length > 0 ? (
            <div className="space-y-4">
              {userAccessories.map((accessory) => (
                <div key={accessory.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {accessory.type === 'mouse' && <Mouse className="h-4 w-4" />}
                      {accessory.type === 'keyboard' && <Keyboard className="h-4 w-4" />}
                      {accessory.type === 'headset' && <Package className="h-4 w-4" />}
                      {accessory.type === 'bag' && <Package className="h-4 w-4" />}
                      {accessory.type === 'other' && <Package className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{accessory.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {accessory.brand} {accessory.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Issued: {accessory.issue_date ? new Date(accessory.issue_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={
                        accessory.status === 'active' ? 'secondary' :
                        accessory.status === 'damaged' ? 'destructive' : 'outline'
                      }
                    >
                      {accessory.status}
                    </Badge>
                    {accessory.battery_status && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Battery: {accessory.battery_status}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No accessories issued to this user yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;