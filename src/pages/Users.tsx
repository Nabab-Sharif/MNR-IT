import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Download,
  Upload,
  Search,
  Printer as PrinterIcon
} from "lucide-react";
import dbService from "@/services/dbService";
import excelService from "@/services/excelService";

const Users = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    id_number: "",
    phone_number: "",
    email: "",
    department_id: "",
    position: "",
    antivirus_status: "Active",
    antivirus_start_date: "",
    antivirus_expiry: "",
    mouse_battery: "Good",
    profile_picture: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const usersData = await dbService.getUsers();
    const departmentsData = await dbService.getDepartments();
    
    setUsers(usersData);
    setDepartments(departmentsData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingUser) {
      await dbService.updateUser(editingUser.id, formData);
      toast({
        title: "User updated",
        description: "User information has been updated successfully.",
      });
    } else {
      await dbService.addUser(formData);
      toast({
        title: "User added",
        description: "New user has been added successfully.",
      });
    }
    
    await loadData();
    resetForm();
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      id_number: user.id_number || "",
      phone_number: user.phone_number || "",
      email: user.email,
      department_id: user.department_id,
      position: user.position || "",
      antivirus_status: user.antivirus_status || "Active",
      antivirus_start_date: user.antivirus_start_date || "",
      antivirus_expiry: user.antivirus_expiry || "",
      mouse_battery: user.mouse_battery || "Good",
      profile_picture: user.profile_picture || null
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (user) => {
    if (confirm(`Are you sure you want to delete ${user.name}?`)) {
      await dbService.deleteUser(user.id);
      await loadData();
      toast({
        title: "User deleted",
        description: "User has been removed from the system.",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      id_number: "",
      phone_number: "",
      email: "",
      department_id: "",
      position: "",
      antivirus_status: "Active",
      antivirus_start_date: "",
      antivirus_expiry: "",
      mouse_battery: "Good",
      profile_picture: null
    });
    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const exportUsers = () => {
    const csvContent = excelService.exportUsers(users, departments);
    excelService.downloadCSV(csvContent, 'mnr_users.csv');
    toast({
      title: "Export successful",
      description: "Users data has been exported to CSV.",
    });
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedUsers = excelService.importUsers(event.target.result);
          for (const userData of importedUsers) {
            if (userData.name && userData.email) {
              await dbService.addUser(userData);
            }
          }
          await loadData();
          toast({
            title: "Import successful",
            description: `${importedUsers.length} users imported successfully.`,
          });
        } catch (error) {
          toast({
            title: "Import failed",
            description: "Please check your CSV format and try again.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAntivirusExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and profile information
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => {
            const printWindow = window.open("", "_blank", "width=900,height=700");
            if (!printWindow) return;
            
            const rows = filteredUsers.map((user: any) => {
              const department = departments.find((d: any) => d.id === parseInt(user.department_id));
              return `<tr><td style="border: 1px solid #ddd; padding: 8px;">${user.name}</td><td style="border: 1px solid #ddd; padding: 8px;">${user.email}</td><td style="border: 1px solid #ddd; padding: 8px;">${department?.name || 'N/A'}</td><td style="border: 1px solid #ddd; padding: 8px;">${user.position || 'N/A'}</td><td style="border: 1px solid #ddd; padding: 8px;">${user.antivirus_status || 'N/A'}</td><td style="border: 1px solid #ddd; padding: 8px;">${user.antivirus_expiry || 'N/A'}</td></tr>`;
            }).join('');
            
            const content = `<!DOCTYPE html><html><head><title>Users List</title><style>@page { size: A4 landscape; margin: 10mm; } body { font-family: Arial, sans-serif; } .header { text-align: center; margin-bottom: 20px; } .header img { height: 50px; } .header h1 { color: #0284c7; } table { width: 100%; border-collapse: collapse; } th { background: #0284c7; color: white; padding: 10px; border: 1px solid #ddd; } td { padding: 8px; }</style></head><body><div class="header"><img src="/pictures/20eb7d56-b963-4a41-9830-eead460b0120.png" /><h1>MNR Group - Users List</h1></div><table><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Position</th><th>Antivirus</th><th>Expiry</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
            
            printWindow.document.open();
            printWindow.document.write(content);
            printWindow.document.close();
            printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
          }}>
            <PrinterIcon className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={exportUsers}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <label htmlFor="import-users">
            <Button variant="outline" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </span>
            </Button>
            <input
              id="import-users"
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Edit User" : "Add New User"}
                </DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update user information" : "Create a new user account"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="id_number">ID Number</Label>
                    <Input
                      id="id_number"
                      value={formData.id_number}
                      onChange={(e) => setFormData({...formData, id_number: e.target.value})}
                      placeholder="Employee ID"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Select 
                      value={formData.department_id} 
                      onValueChange={(value) => setFormData({...formData, department_id: value})}
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
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="antivirus_status">Antivirus Status</Label>
                    <Select 
                      value={formData.antivirus_status} 
                      onValueChange={(value) => setFormData({...formData, antivirus_status: value})}
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
                      value={formData.antivirus_start_date}
                      onChange={(e) => setFormData({...formData, antivirus_start_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="antivirus_expiry">Expiry Date</Label>
                    <Input
                      id="antivirus_expiry"
                      type="date"
                      value={formData.antivirus_expiry}
                      onChange={(e) => setFormData({...formData, antivirus_expiry: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mouse_battery">Mouse Battery Status</Label>
                    <Select 
                      value={formData.mouse_battery} 
                      onValueChange={(value) => setFormData({...formData, mouse_battery: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                        <SelectItem value="N/A">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="profile_picture">Profile Picture</Label>
                    <Input
                      id="profile_picture"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            setFormData({...formData, profile_picture: e.target?.result as string});
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? "Update" : "Add"} User
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Total: {users.length} users
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Antivirus</TableHead>
                <TableHead>Mouse Battery</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const department = departments.find(d => d.id === parseInt(user.department_id));
                const antivirusExpired = isAntivirusExpired(user.antivirus_expiry);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{department?.name || 'N/A'}</TableCell>
                    <TableCell>{user.position || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant={antivirusExpired ? "destructive" : "secondary"}
                          className={antivirusExpired ? "text-expired-foreground bg-expired" : ""}
                        >
                          <Shield className="mr-1 h-3 w-3" />
                          {user.antivirus_status || 'N/A'}
                        </Badge>
                        {antivirusExpired && (
                          <span className="text-xs text-expired">
                            Expired: {user.antivirus_expiry}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.mouse_battery === 'Critical' ? "destructive" : "secondary"}
                      >
                        {user.mouse_battery || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Users;