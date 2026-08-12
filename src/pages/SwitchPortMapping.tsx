import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { Plus, Network, Cable, Monitor, MapPin, ChevronRight, Trash2, Link2, Unlink, ArrowUpRight, ChevronDown, Search, Printer, X, Edit, Eye, ArrowLeft } from "lucide-react";
import indexedDBService from "@/services/indexedDBService";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";
import SwitchFrontPanel from "@/components/SwitchFrontPanel";
import NetworkTopologyView from "@/components/NetworkTopologyView";
import SwitchTopologyView from "@/components/SwitchTopologyView";
import RackView from "@/components/RackView";
import RackManager, { Rack } from "@/components/RackManager";

interface Switch {
  id: string;
  switch_name: string;
  location: string;
  total_ports: number;
  parent_switch_id: string | null;
  parent_port_number: number | null;
  switch_type: 'CORE' | 'DISTRIBUTION' | 'ACCESS';
  created_at: string;
  rack_id?: string | null;
}

interface Port {
  id: string;
  switch_id: string;
  port_number: number;
  port_role: 'ACCESS' | 'UPLINK';
  status: 'FREE' | 'ACTIVE' | 'ISSUE' | 'DISABLED';
  assign_type: 'USER' | 'LOCATION' | 'SWITCH' | null;
  assign_id: string | null;
  assign_name: string | null;
  user_location: string | null;
  device_name: string | null;
  remarks: string;
  last_updated: string;
}

const SwitchPortMapping = () => {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [itAssets, setItAssets] = useState<any[]>([]);
  
  const [isAddSwitchOpen, setIsAddSwitchOpen] = useState(false);
  const [isEditSwitchOpen, setIsEditSwitchOpen] = useState(false);
  const [isPortAssignOpen, setIsPortAssignOpen] = useState(false);
  const [isEditPortOpen, setIsEditPortOpen] = useState(false);
  const [isCreateChildSwitchOpen, setIsCreateChildSwitchOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletePortOpen, setIsDeletePortOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Detail view dialogs
  const [viewTotalSwitches, setViewTotalSwitches] = useState(false);
  const [viewTotalPorts, setViewTotalPorts] = useState(false);
  const [viewActivePorts, setViewActivePorts] = useState(false);
  const [viewFreePorts, setViewFreePorts] = useState(false);
  
  const [selectedSwitch, setSelectedSwitch] = useState<Switch | null>(null);
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [editingSwitch, setEditingSwitch] = useState<Switch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'switch' | 'port'; item: any } | null>(null);
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form states
  const [newSwitch, setNewSwitch] = useState({
    switch_name: '',
    location: '',
    total_ports: '',
    rack_id: '' as string | null | '',
  });
  
  const [editSwitchForm, setEditSwitchForm] = useState({
    switch_name: '',
    location: ''
  });
  
  const [portAssignment, setPortAssignment] = useState({
    assign_type: '' as 'USER' | 'LOCATION' | 'SWITCH' | '',
    assign_name: '',
    user_location: '',
    device_name: '',
    remarks: ''
  });
  
  const [childSwitchForm, setChildSwitchForm] = useState({
    switch_name: '',
    location: '',
    total_ports: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useCloudRealtime(
    ["switches_cloud", "switch_ports_cloud", "switch_locations_cloud", "switch_gates_cloud"],
    () => { loadData(); }
  );

  const loadData = async () => {
    try {
      const [switchesData, portsData, assetsData] = await Promise.all([
        indexedDBService.getAll('switches'),
        indexedDBService.getAll('switch_ports'),
        indexedDBService.getAll('it_assets')
      ]);
      
      setSwitches(switchesData || []);
      setPorts(portsData || []);
      setItAssets(assetsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Generate unique ID
  const generateId = () => (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create Switch with auto-generated ports
  const handleCreateSwitch = async () => {
    if (!newSwitch.switch_name || !newSwitch.location || !newSwitch.total_ports) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const totalPorts = parseInt(newSwitch.total_ports) || 24;
    
    const switchData: Switch = {
      id: generateId(),
      switch_name: newSwitch.switch_name,
      location: newSwitch.location,
      total_ports: totalPorts,
      parent_switch_id: null,
      parent_port_number: null,
      switch_type: 'ACCESS',
      created_at: new Date().toISOString(),
      rack_id: newSwitch.rack_id || null,
    };

    // Auto-create ports
    const newPorts: Port[] = [];
    for (let i = 1; i <= totalPorts; i++) {
      newPorts.push({
        id: generateId(),
        switch_id: switchData.id,
        port_number: i,
        port_role: 'ACCESS',
        status: 'FREE',
        assign_type: null,
        assign_id: null,
        assign_name: null,
        user_location: null,
        device_name: null,
        remarks: '',
        last_updated: new Date().toISOString()
      });
    }

    await indexedDBService.put('switches', switchData);
    for (const port of newPorts) {
      await indexedDBService.put('switch_ports', port);
    }

    toast({ title: "Success", description: `Switch "${switchData.switch_name}" created with ${totalPorts} ports` });
    setNewSwitch({ switch_name: '', location: '', total_ports: '', rack_id: '' });
    setIsAddSwitchOpen(false);
    loadData();
  };

  // Edit Switch
  const handleEditSwitch = async () => {
    if (!editingSwitch || !editSwitchForm.switch_name) {
      toast({ title: "Error", description: "Please fill switch name", variant: "destructive" });
      return;
    }

    const updatedSwitch: Switch = {
      ...editingSwitch,
      switch_name: editSwitchForm.switch_name,
      location: editSwitchForm.location
    };

    await indexedDBService.put('switches', updatedSwitch);
    toast({ title: "Success", description: `Switch "${editSwitchForm.switch_name}" updated` });
    
    setEditSwitchForm({ switch_name: '', location: '' });
    setIsEditSwitchOpen(false);
    setEditingSwitch(null);
    loadData();
  };

  // Open Edit Switch Dialog
  const openEditSwitch = (sw: Switch) => {
    setEditingSwitch(sw);
    setEditSwitchForm({
      switch_name: sw.switch_name,
      location: sw.location
    });
    setIsEditSwitchOpen(true);
  };

  // Create Child Switch from Uplink Port
  const handleCreateChildSwitch = async () => {
    if (!selectedPort || !selectedSwitch || !childSwitchForm.switch_name) {
      toast({ title: "Error", description: "Please fill switch name", variant: "destructive" });
      return;
    }

    const totalPorts = parseInt(childSwitchForm.total_ports) || 24;

    const childSwitch: Switch = {
      id: generateId(),
      switch_name: childSwitchForm.switch_name,
      location: childSwitchForm.location,
      total_ports: totalPorts,
      parent_switch_id: selectedSwitch.id,
      parent_port_number: selectedPort.port_number,
      switch_type: 'ACCESS',
      created_at: new Date().toISOString()
    };

    // Auto-create ports for child switch
    const newPorts: Port[] = [];
    for (let i = 1; i <= totalPorts; i++) {
      newPorts.push({
        id: generateId(),
        switch_id: childSwitch.id,
        port_number: i,
        port_role: 'ACCESS',
        status: 'FREE',
        assign_type: null,
        assign_id: null,
        assign_name: null,
        user_location: null,
        device_name: null,
        remarks: '',
        last_updated: new Date().toISOString()
      });
    }

    // Update parent port as UPLINK
    const updatedParentPort: Port = {
      ...selectedPort,
      port_role: 'UPLINK',
      status: 'ACTIVE',
      assign_type: 'SWITCH',
      assign_id: childSwitch.id,
      assign_name: childSwitchForm.switch_name,
      user_location: childSwitchForm.location,
      device_name: null,
      last_updated: new Date().toISOString()
    };

    await indexedDBService.put('switches', childSwitch);
    for (const port of newPorts) {
      await indexedDBService.put('switch_ports', port);
    }
    await indexedDBService.put('switch_ports', updatedParentPort);

    toast({ 
      title: "Success", 
      description: `Child switch "${childSwitch.switch_name}" created and linked to ${selectedSwitch.switch_name} Port-${selectedPort.port_number}` 
    });
    
    setChildSwitchForm({ switch_name: '', location: '', total_ports: '' });
    setIsCreateChildSwitchOpen(false);
    setSelectedPort(null);
    loadData();
  };

  // Assign Port (dynamic input - no dropdown)
  const handleAssignPort = async () => {
    if (!selectedPort || !portAssignment.assign_type || !portAssignment.assign_name) {
      toast({ title: "Error", description: "Please fill assignment type and name", variant: "destructive" });
      return;
    }

    // If SWITCH: create a real child switch entity so it can itself accept uplinks/devices
    if (portAssignment.assign_type === 'SWITCH' && selectedSwitch) {
      const totalPorts = 24;
      const childSwitch: Switch = {
        id: generateId(),
        switch_name: portAssignment.assign_name,
        location: portAssignment.user_location || selectedSwitch.location,
        total_ports: totalPorts,
        parent_switch_id: selectedSwitch.id,
        parent_port_number: selectedPort.port_number,
        switch_type: 'ACCESS',
        created_at: new Date().toISOString(),
      };
      const newPorts: Port[] = [];
      for (let i = 1; i <= totalPorts; i++) {
        newPorts.push({
          id: generateId(),
          switch_id: childSwitch.id,
          port_number: i,
          port_role: 'ACCESS',
          status: 'FREE',
          assign_type: null,
          assign_id: null,
          assign_name: null,
          user_location: null,
          device_name: null,
          remarks: '',
          last_updated: new Date().toISOString(),
        });
      }
      const updatedParentPort: Port = {
        ...selectedPort,
        port_role: 'UPLINK',
        status: 'ACTIVE',
        assign_type: 'SWITCH',
        assign_id: childSwitch.id,
        assign_name: portAssignment.assign_name,
        user_location: portAssignment.user_location || null,
        device_name: null,
        remarks: portAssignment.remarks,
        last_updated: new Date().toISOString(),
      };
      await indexedDBService.put('switches', childSwitch);
      for (const p of newPorts) await indexedDBService.put('switch_ports', p);
      await indexedDBService.put('switch_ports', updatedParentPort);
      toast({ title: "Child switch created", description: `${portAssignment.assign_name} uplinked to ${selectedSwitch.switch_name} Port-${selectedPort.port_number}` });
      setPortAssignment({ assign_type: '', assign_name: '', user_location: '', device_name: '', remarks: '' });
      setIsPortAssignOpen(false);
      setSelectedPort(null);
      loadData();
      return;
    }

    const updatedPort: Port = {
      ...selectedPort,
      port_role: portAssignment.assign_type === 'SWITCH' ? 'UPLINK' : 'ACCESS',
      status: 'ACTIVE',
      assign_type: portAssignment.assign_type,
      assign_id: null,
      assign_name: portAssignment.assign_name,
      user_location: portAssignment.user_location || null,
      device_name: portAssignment.device_name || null,
      remarks: portAssignment.remarks,
      last_updated: new Date().toISOString()
    };

    await indexedDBService.put('switch_ports', updatedPort);
    toast({ title: "Success", description: `Port ${selectedPort.port_number} assigned to ${portAssignment.assign_name}` });
    
    setPortAssignment({ assign_type: '', assign_name: '', user_location: '', device_name: '', remarks: '' });
    setIsPortAssignOpen(false);
    setSelectedPort(null);
    loadData();
  };

  // Edit Port Assignment
  const handleEditPort = async () => {
    if (!selectedPort || !portAssignment.assign_name) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const updatedPort: Port = {
      ...selectedPort,
      assign_name: portAssignment.assign_name,
      user_location: portAssignment.user_location || null,
      device_name: portAssignment.device_name || null,
      remarks: portAssignment.remarks,
      last_updated: new Date().toISOString()
    };

    await indexedDBService.put('switch_ports', updatedPort);
    toast({ title: "Success", description: `Port ${selectedPort.port_number} updated` });
    
    setPortAssignment({ assign_type: '', assign_name: '', user_location: '', device_name: '', remarks: '' });
    setIsEditPortOpen(false);
    setSelectedPort(null);
    loadData();
  };

  // Open Edit Port Dialog
  const openEditPort = (port: Port) => {
    setSelectedPort(port);
    setPortAssignment({
      assign_type: port.assign_type || '',
      assign_name: port.assign_name || '',
      user_location: port.user_location || '',
      device_name: port.device_name || '',
      remarks: port.remarks || ''
    });
    setIsEditPortOpen(true);
  };

  // Confirm Delete Dialog
  const confirmDelete = (type: 'switch' | 'port', item: any) => {
    setDeleteTarget({ type, item });
    if (type === 'switch') {
      setIsDeleteDialogOpen(true);
    } else {
      setIsDeletePortOpen(true);
    }
  };

  // Unassign Port with confirmation
  const handleConfirmUnassignPort = async () => {
    if (!deleteTarget || deleteTarget.type !== 'port') return;
    
    const port = deleteTarget.item as Port;
    const updatedPort: Port = {
      ...port,
      port_role: 'ACCESS',
      status: 'FREE',
      assign_type: null,
      assign_id: null,
      assign_name: null,
      user_location: null,
      device_name: null,
      remarks: '',
      last_updated: new Date().toISOString()
    };

    await indexedDBService.put('switch_ports', updatedPort);
    toast({ title: "Success", description: `Port ${port.port_number} unassigned` });
    setIsDeletePortOpen(false);
    setDeleteTarget(null);
    loadData();
  };

  // Delete Switch with confirmation
  const handleConfirmDeleteSwitch = async () => {
    if (!deleteTarget || deleteTarget.type !== 'switch') return;
    
    const sw = deleteTarget.item as Switch;
    
    // Check if switch has children
    const hasChildren = switches.some(s => s.parent_switch_id === sw.id);
    if (hasChildren) {
      toast({ title: "Error", description: "Cannot delete switch with connected child switches", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
      return;
    }

    // Delete all ports of this switch
    const switchPorts = ports.filter(p => p.switch_id === sw.id);
    for (const port of switchPorts) {
      await indexedDBService.delete('switch_ports', port.id);
    }

    // If this switch is connected as child, update parent port
    if (sw.parent_switch_id && sw.parent_port_number) {
      const parentPort = ports.find(p => 
        p.switch_id === sw.parent_switch_id && 
        p.port_number === sw.parent_port_number
      );
      if (parentPort) {
        await indexedDBService.put('switch_ports', {
          ...parentPort,
          port_role: 'ACCESS',
          status: 'FREE',
          assign_type: null,
          assign_id: null,
          assign_name: null,
          user_location: null,
          device_name: null,
          last_updated: new Date().toISOString()
        });
      }
    }

    await indexedDBService.delete('switches', sw.id);
    toast({ title: "Success", description: `Switch "${sw.switch_name}" deleted` });
    if (selectedSwitch?.id === sw.id) {
      setSelectedSwitch(null);
    }
    setIsDeleteDialogOpen(false);
    setDeleteTarget(null);
    loadData();
  };

  // Get root switches (no parent)
  const getRootSwitches = () => switches.filter(s => !s.parent_switch_id);

  // Get child switches
  const getChildSwitches = (parentId: string) => switches.filter(s => s.parent_switch_id === parentId);

  // Get switch ports
  const getSwitchPorts = (switchId: string) => 
    ports.filter(p => p.switch_id === switchId).sort((a, b) => a.port_number - b.port_number);

  // Toggle switch expansion
  const toggleExpand = (switchId: string) => {
    const newExpanded = new Set(expandedSwitches);
    if (newExpanded.has(switchId)) {
      newExpanded.delete(switchId);
    } else {
      newExpanded.add(switchId);
    }
    setExpandedSwitches(newExpanded);
  };

  // Get parent switch name
  const getParentSwitchName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = switches.find(s => s.id === parentId);
    return parent?.switch_name || null;
  };

  // Get port status color
  const getPortStatusColor = (status: string) => {
    switch (status) {
      case 'FREE': return 'bg-gray-100 text-gray-600 border-gray-300';
      case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'ISSUE': return 'bg-red-100 text-red-700 border-red-300';
      case 'DISABLED': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  // Get port role badge
  const getPortRoleBadge = (role: string) => {
    return role === 'UPLINK' 
      ? <Badge className="bg-purple-500 text-white text-xs">UPLINK</Badge>
      : <Badge variant="outline" className="text-xs">ACCESS</Badge>;
  };

  // Print function
  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Switch Port Mapping Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4F46E5; padding-bottom: 15px; }
          .header h1 { color: #4F46E5; margin: 0; font-size: 24px; }
          .header p { color: #666; margin: 5px 0 0; }
          .switch-card { border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
          .switch-header { background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 12px 15px; border-radius: 6px 6px 0 0; }
          .switch-header h2 { margin: 0; font-size: 16px; }
          .switch-header p { margin: 3px 0 0; font-size: 11px; opacity: 0.9; }
          .port-table { width: 100%; border-collapse: collapse; }
          .port-table th { background: #f3f4f6; padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 11px; }
          .port-table td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          .port-free { color: #6b7280; }
          .port-active { color: #059669; font-weight: 500; }
          .port-uplink { color: #7c3aed; font-weight: 600; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; }
          .badge-free { background: #f3f4f6; color: #6b7280; }
          .badge-active { background: #d1fae5; color: #059669; }
          .badge-uplink { background: #ede9fe; color: #7c3aed; }
          .summary { margin-bottom: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-item .value { font-size: 24px; font-weight: bold; color: #4F46E5; }
          .summary-item .label { font-size: 11px; color: #666; }
          .child-switch { margin-left: 20px; border-left: 3px solid #7C3AED; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Switch Port Mapping Report</h1>
          <p>Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <div class="summary">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="value">${switches.length}</div>
              <div class="label">Total Switches</div>
            </div>
            <div class="summary-item">
              <div class="value">${ports.length}</div>
              <div class="label">Total Ports</div>
            </div>
            <div class="summary-item">
              <div class="value">${ports.filter(p => p.status === 'ACTIVE').length}</div>
              <div class="label">Active Ports</div>
            </div>
            <div class="summary-item">
              <div class="value">${ports.filter(p => p.status === 'FREE').length}</div>
              <div class="label">Free Ports</div>
            </div>
          </div>
        </div>
        
        ${switches.map(sw => {
          const switchPorts = getSwitchPorts(sw.id);
          const isChild = !!sw.parent_switch_id;
          return `
            <div class="switch-card ${isChild ? 'child-switch' : ''}">
              <div class="switch-header">
                <h2>${sw.switch_name}</h2>
                <p>${sw.location} • ${sw.total_ports} Ports ${isChild ? `• Uplink from ${getParentSwitchName(sw.parent_switch_id)} (Port-${sw.parent_port_number})` : ''}</p>
              </div>
              <table class="port-table">
                <thead>
                  <tr>
                    <th style="width: 50px;">Port</th>
                    <th style="width: 70px;">Role</th>
                    <th style="width: 70px;">Status</th>
                    <th>Connected To</th>
                    <th>Location</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  ${switchPorts.map(port => `
                    <tr>
                      <td><strong>${port.port_number}</strong></td>
                      <td>
                        <span class="badge ${port.port_role === 'UPLINK' ? 'badge-uplink' : 'badge-free'}">${port.port_role}</span>
                      </td>
                      <td>
                        <span class="badge ${port.status === 'ACTIVE' ? 'badge-active' : 'badge-free'}">${port.status}</span>
                      </td>
                      <td class="${port.port_role === 'UPLINK' ? 'port-uplink' : port.status === 'ACTIVE' ? 'port-active' : 'port-free'}">
                        ${port.assign_name || '—'}
                      </td>
                      <td>${port.user_location || '—'}</td>
                      <td>${port.device_name || '—'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
        
        <div class="footer">
          <p>Created by IT Team • Switch Port Mapping System</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Filter switches by search (location/department)
  const filterSwitches = (switchList: Switch[]): Switch[] => {
    if (!searchTerm) return switchList;
    
    const searchLower = searchTerm.toLowerCase();
    
    return switchList.filter(sw => {
      const switchPorts = getSwitchPorts(sw.id);
      // Match switch name or location
      const matchesSwitch = sw.switch_name.toLowerCase().includes(searchLower) ||
        sw.location.toLowerCase().includes(searchLower);
      // Match port assignments - user name, location, device
      const matchesPort = switchPorts.some(p => 
        p.assign_name?.toLowerCase().includes(searchLower) ||
        p.user_location?.toLowerCase().includes(searchLower) ||
        p.device_name?.toLowerCase().includes(searchLower)
      );
      return matchesSwitch || matchesPort;
    });
  };

  const filteredRootSwitches = filterSwitches(getRootSwitches());

  // Get all active ports with switch info
  const getActivePortsWithSwitch = () => {
    return ports.filter(p => p.status === 'ACTIVE').map(port => {
      const sw = switches.find(s => s.id === port.switch_id);
      return { ...port, switch_name: sw?.switch_name, switch_location: sw?.location };
    });
  };

  // Get all free ports with switch info
  const getFreePortsWithSwitch = () => {
    return ports.filter(p => p.status === 'FREE').map(port => {
      const sw = switches.find(s => s.id === port.switch_id);
      return { ...port, switch_name: sw?.switch_name, switch_location: sw?.location };
    });
  };

  // Render switch card with ports
  const renderSwitchCard = (sw: Switch, level: number = 0) => {
    const children = getChildSwitches(sw.id);
    const switchPorts = getSwitchPorts(sw.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedSwitches.has(sw.id);
    const isSelected = selectedSwitch?.id === sw.id;
    const freePortsCount = switchPorts.filter(p => p.status === 'FREE').length;
    const activePortsCount = switchPorts.filter(p => p.status === 'ACTIVE').length;

    return (
      <div key={sw.id} className="mb-4" style={{ marginLeft: `${level * 24}px` }}>
        <Card 
          className={`transition-all duration-300 hover:shadow-xl cursor-pointer border-2 ${
            isSelected ? 'ring-2 ring-primary border-primary shadow-lg' : 'border-border hover:border-primary/50'
          }`}
          onClick={() => { setSelectedSwitch(sw); setIsDetailsOpen(true); }}
        >
          <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasChildren && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleExpand(sw.id); }}
                    className="p-1 hover:bg-background rounded transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>
                )}
                {!hasChildren && <div className="w-7" />}
                
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                  <Network className="w-6 h-6 text-white" />
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xl">{sw.switch_name}</span>
                    <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                      {sw.total_ports} Ports
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <MapPin className="w-3 h-3" /> {sw.location}
                    {sw.parent_switch_id && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="text-purple-600 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          {getParentSwitchName(sw.parent_switch_id)} (Port-{sw.parent_port_number})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900">{freePortsCount} Free</Badge>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950">{activePortsCount} Active</Badge>
                </div>
                
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  onClick={(e) => { e.stopPropagation(); openEditSwitch(sw); }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); confirmDelete('switch', sw); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

        </Card>

        {/* Child Switches */}
        {isExpanded && hasChildren && (
          <div className="mt-2 border-l-4 border-dashed border-purple-300 ml-4 pl-2">
            {children.map(child => renderSwitchCard(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Switch Port Mapping
          </h1>
          <p className="text-muted-foreground mt-1">Manage network switches, ports, and connections</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            onClick={handlePrint}
            className="border-indigo-300 dark:border-indigo-500 text-indigo-600 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/30 hover:text-indigo-800 dark:hover:text-white hover:border-indigo-600 dark:hover:border-indigo-300 transition-all"
          >
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button 
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            onClick={() => setIsAddSwitchOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Switch
          </Button>
        </div>
      </div>

      {/* Summary Cards - Now Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card 
          className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-0 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setViewTotalSwitches(true)}
        >
          <CardContent className="pt-4 text-center">
            <Network className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
            <p className="text-3xl font-bold text-indigo-600">{switches.length}</p>
            <p className="text-sm text-muted-foreground">Total Switches</p>
            <p className="text-xs text-indigo-500 mt-1">Click to view details</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-0 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setViewTotalPorts(true)}
        >
          <CardContent className="pt-4 text-center">
            <Cable className="w-8 h-8 mx-auto text-blue-600 mb-2" />
            <p className="text-3xl font-bold text-blue-600">{ports.length}</p>
            <p className="text-sm text-muted-foreground">Total Ports</p>
            <p className="text-xs text-blue-500 mt-1">Click to view details</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border-0 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setViewActivePorts(true)}
        >
          <CardContent className="pt-4 text-center">
            <Monitor className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
            <p className="text-3xl font-bold text-emerald-600">{ports.filter(p => p.status === 'ACTIVE').length}</p>
            <p className="text-sm text-muted-foreground">Active Ports</p>
            <p className="text-xs text-emerald-500 mt-1">Click to view details</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950 dark:to-slate-950 border-0 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setViewFreePorts(true)}
        >
          <CardContent className="pt-4 text-center">
            <div className="w-8 h-8 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-2">
              <span className="text-gray-600 font-bold text-sm">F</span>
            </div>
            <p className="text-3xl font-bold text-gray-600">{ports.filter(p => p.status === 'FREE').length}</p>
            <p className="text-sm text-muted-foreground">Free Ports</p>
            <p className="text-xs text-gray-500 mt-1">Click to view details</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Search by location, department, switch name, user..." 
              className="pl-10 text-lg h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearchTerm('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rack View */}
      <div className="mb-6">
        <RackManager
          switches={switches as any}
          onAddSwitchToRack={(r: Rack) => {
            setNewSwitch({ switch_name: '', location: r.location, total_ports: '24', rack_id: r.id });
            setIsAddSwitchOpen(true);
          }}
        />
        <RackView
          switches={switches}
          ports={ports}
          selectedId={selectedSwitch?.id || null}
          onSelect={(id) => {
            const sw = switches.find(s => s.id === id) || null;
            setSelectedSwitch(sw);
          }}
        />
      </div>

      {/* Live Topology (separate section) */}
      <div className="mb-6">
        <NetworkTopologyView
          switches={switches}
          ports={ports}
          selectedId={selectedSwitch?.id || null}
          selectedPort={selectedPort ? { switch_id: selectedPort.switch_id, assign_name: selectedPort.assign_name, device_name: selectedPort.device_name } : null}
          onSelectSwitch={(id) => {
            const sw = switches.find(s => s.id === id) || null;
            setSelectedSwitch(sw);
          }}
        />
      </div>

      {/* Switch List */}
      <div className="space-y-2">
        {filteredRootSwitches.length === 0 ? (
          <Card className="py-16">
            <CardContent className="text-center">
              <Network className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-xl text-muted-foreground">No switches found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? 'Try a different search term' : 'Click "Add Switch" to create your first switch'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRootSwitches.map(sw => renderSwitchCard(sw))
        )}
      </div>

      {/* Add Switch Dialog */}
      <Dialog open={isAddSwitchOpen} onOpenChange={setIsAddSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              Create New Switch
            </DialogTitle>
            <DialogDescription>Add a new network switch. Ports will be auto-generated.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="switch_name">Switch Name *</Label>
              <Input 
                id="switch_name" 
                placeholder="Type switch name (e.g., CORE-SW-01, SW-FLOOR-1)"
                value={newSwitch.switch_name}
                onChange={(e) => setNewSwitch({...newSwitch, switch_name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Switch Location *</Label>
              <Input 
                id="location" 
                placeholder="Type location (e.g., Server Room, Floor 1)"
                value={newSwitch.location}
                onChange={(e) => setNewSwitch({...newSwitch, location: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="total_ports">Total Ports *</Label>
              <Input 
                id="total_ports" 
                type="number"
                placeholder="Type number of ports (e.g., 24, 48)"
                value={newSwitch.total_ports}
                onChange={(e) => setNewSwitch({...newSwitch, total_ports: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSwitchOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateSwitch}
              className="bg-gradient-to-r from-indigo-500 to-purple-500"
            >
              Create Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Switch Dialog */}
      <Dialog open={isEditSwitchOpen} onOpenChange={setIsEditSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Edit Switch
            </DialogTitle>
            <DialogDescription>Update switch details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit_switch_name">Switch Name *</Label>
              <Input 
                id="edit_switch_name" 
                placeholder="Type switch name"
                value={editSwitchForm.switch_name}
                onChange={(e) => setEditSwitchForm({...editSwitchForm, switch_name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit_location">Switch Location</Label>
              <Input 
                id="edit_location" 
                placeholder="Type location"
                value={editSwitchForm.location}
                onChange={(e) => setEditSwitchForm({...editSwitchForm, location: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditSwitchOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleEditSwitch}
              className="bg-gradient-to-r from-blue-500 to-cyan-500"
            >
              Update Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[92vh] p-0 flex flex-col overflow-hidden [&>button.absolute]:hidden">
          <DialogHeader className="p-4 pb-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-b">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Network className="w-5 h-5 text-indigo-600" />
                {selectedSwitch?.switch_name}
                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white ml-2">
                  {selectedSwitch?.total_ports} Ports
                </Badge>
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500 dark:text-indigo-200 dark:hover:bg-indigo-900"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
            </div>
            <DialogDescription className="flex items-center gap-2">
              <MapPin className="w-3 h-3" /> {selectedSwitch?.location}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedSwitch && (
              <Tabs defaultValue="ports" className="w-full">
                <div className="px-4 pt-3 sticky top-0 bg-background z-10 border-b">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="ports" className="gap-2">
                      <Cable className="w-4 h-4" /> Ports
                    </TabsTrigger>
                    <TabsTrigger value="topology" className="gap-2">
                      <Network className="w-4 h-4" /> Live Topology
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="ports" className="mt-0">
                <SwitchFrontPanel
                  switchName={selectedSwitch.switch_name}
                  totalPorts={selectedSwitch.total_ports}
                  ports={getSwitchPorts(selectedSwitch.id)}
                  onPortClick={(p) => {
                    const full = getSwitchPorts(selectedSwitch.id).find(x => x.id === p.id);
                    if (!full) return;
                    setSelectedPort(full);
                    if (full.status === 'FREE') setIsPortAssignOpen(true);
                    else openEditPort(full);
                  }}
                />
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 sticky top-0">
                      <TableHead className="w-16">Port</TableHead>
                      <TableHead className="w-20">Role</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead>Connected To</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSwitchPorts(selectedSwitch.id).map(port => (
                      <TableRow key={port.id} className="hover:bg-muted/30">
                        <TableCell className="font-bold text-lg">{port.port_number}</TableCell>
                        <TableCell>{getPortRoleBadge(port.port_role)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${getPortStatusColor(port.status)}`}>{port.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {port.assign_name ? (
                            <div className="flex items-center gap-1">
                              {port.assign_type === 'SWITCH' && <Network className="w-3 h-3 text-purple-500" />}
                              {port.assign_type === 'USER' && <Monitor className="w-3 h-3 text-blue-500" />}
                              {port.assign_type === 'LOCATION' && <MapPin className="w-3 h-3 text-green-500" />}
                              <span className="font-medium">{port.assign_name}</span>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{port.user_location || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{port.device_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {port.status === 'FREE' ? (
                              <>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setSelectedPort(port); setIsPortAssignOpen(true); }}>
                                  <Link2 className="w-3 h-3 mr-1" /> Assign
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-purple-600 border-purple-300 hover:bg-purple-50" onClick={() => { setSelectedPort(port); setIsCreateChildSwitchOpen(true); }}>
                                  <Cable className="w-3 h-3 mr-1" /> Uplink
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-500 hover:text-blue-700" onClick={() => openEditPort(port)}>
                                  <Edit className="w-3 h-3 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:text-red-700" onClick={() => confirmDelete('port', port)}>
                                  <Unlink className="w-3 h-3 mr-1" /> Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </TabsContent>
                <TabsContent value="topology" className="mt-0 p-4">
                  <NetworkTopologyView
                    switches={switches}
                    ports={ports}
                    selectedId={selectedSwitch.id}
                    selectedPort={selectedPort ? { switch_id: selectedPort.switch_id, assign_name: selectedPort.assign_name, device_name: selectedPort.device_name } : null}
                    onSelectSwitch={(id) => {
                      const sw = switches.find(s => s.id === id) || null;
                      if (sw) setSelectedSwitch(sw);
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Port Assignment Dialog (re-open) */}
      <Dialog open={isPortAssignOpen} onOpenChange={setIsPortAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              Assign Port {selectedPort?.port_number}
            </DialogTitle>
            <DialogDescription>
              Assign this port to a switch, user, or location. Type the name dynamically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Assignment Type *</Label>
              <div className="flex gap-2">
                {(['SWITCH', 'USER', 'LOCATION'] as const).map(type => (
                  <Button
                    key={type}
                    variant={portAssignment.assign_type === type ? 'default' : 'outline'}
                    size="sm"
                    className={portAssignment.assign_type === type ? 'bg-indigo-600' : ''}
                    onClick={() => setPortAssignment({...portAssignment, assign_type: type})}
                  >
                    {type === 'SWITCH' && <Network className="w-4 h-4 mr-1" />}
                    {type === 'USER' && <Monitor className="w-4 h-4 mr-1" />}
                    {type === 'LOCATION' && <MapPin className="w-4 h-4 mr-1" />}
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {portAssignment.assign_type && (
              <>
                <div className="grid gap-2">
                  <Label>
                    {portAssignment.assign_type === 'SWITCH' ? 'Switch Name' : 
                     portAssignment.assign_type === 'USER' ? 'User Name' : 'Location Name'} *
                  </Label>
                  <Input 
                    placeholder={
                      portAssignment.assign_type === 'SWITCH' ? 'Type switch name (e.g., SW-FLOOR-2)' : 
                      portAssignment.assign_type === 'USER' ? 'Type user name (e.g., Rakib, HR Department)' : 
                      'Type location name (e.g., HR Room, Gate-1)'
                    }
                    value={portAssignment.assign_name}
                    onChange={(e) => setPortAssignment({...portAssignment, assign_name: e.target.value})}
                  />
                </div>

                {portAssignment.assign_type !== 'SWITCH' && (
                  <>
                    <div className="grid gap-2">
                      <Label>User/Location Room</Label>
                      <Input 
                        placeholder="Type room/area (e.g., Room 101, Ground Floor)"
                        value={portAssignment.user_location}
                        onChange={(e) => setPortAssignment({...portAssignment, user_location: e.target.value})}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Device Name</Label>
                      <Input 
                        placeholder="Type device name (e.g., PC-HR-01, Printer-01)"
                        value={portAssignment.device_name}
                        onChange={(e) => setPortAssignment({...portAssignment, device_name: e.target.value})}
                      />
                    </div>
                  </>
                )}

                <div className="grid gap-2">
                  <Label>Remarks</Label>
                  <Input 
                    placeholder="Optional notes..."
                    value={portAssignment.remarks}
                    onChange={(e) => setPortAssignment({...portAssignment, remarks: e.target.value})}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsPortAssignOpen(false);
              setPortAssignment({ assign_type: '', assign_name: '', user_location: '', device_name: '', remarks: '' });
            }}>Cancel</Button>
            <Button 
              onClick={handleAssignPort}
              className="bg-gradient-to-r from-blue-500 to-cyan-500"
              disabled={!portAssignment.assign_type || !portAssignment.assign_name}
            >
              Assign Port
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Port Assignment Dialog */}
      <Dialog open={isEditPortOpen} onOpenChange={setIsEditPortOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Edit Port {selectedPort?.port_number} Assignment
            </DialogTitle>
            <DialogDescription>
              Update port assignment details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input 
                placeholder="Type name"
                value={portAssignment.assign_name}
                onChange={(e) => setPortAssignment({...portAssignment, assign_name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>Location/Room</Label>
              <Input 
                placeholder="Type room/area"
                value={portAssignment.user_location}
                onChange={(e) => setPortAssignment({...portAssignment, user_location: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>Device Name</Label>
              <Input 
                placeholder="Type device name"
                value={portAssignment.device_name}
                onChange={(e) => setPortAssignment({...portAssignment, device_name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>Remarks</Label>
              <Input 
                placeholder="Optional notes..."
                value={portAssignment.remarks}
                onChange={(e) => setPortAssignment({...portAssignment, remarks: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditPortOpen(false);
              setPortAssignment({ assign_type: '', assign_name: '', user_location: '', device_name: '', remarks: '' });
            }}>Cancel</Button>
            <Button 
              onClick={handleEditPort}
              className="bg-gradient-to-r from-blue-500 to-cyan-500"
            >
              Update Port
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Child Switch (Uplink) Dialog */}
      <Dialog open={isCreateChildSwitchOpen} onOpenChange={setIsCreateChildSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5 text-purple-600" />
              Create Uplink Switch
            </DialogTitle>
            <DialogDescription>
              Create a child switch connected via UPLINK from {selectedSwitch?.switch_name} Port-{selectedPort?.port_number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-lg border border-purple-200">
              <p className="text-sm">
                <strong className="text-purple-700">Parent:</strong> {selectedSwitch?.switch_name}<br />
                <strong className="text-purple-700">Uplink Port:</strong> Port-{selectedPort?.port_number}
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="child_switch_name">Switch Name *</Label>
              <Input 
                id="child_switch_name" 
                placeholder="Type switch name (e.g., SW-FLOOR-1, SW-ROOM-3)"
                value={childSwitchForm.switch_name}
                onChange={(e) => setChildSwitchForm({...childSwitchForm, switch_name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="child_location">Uplink Location</Label>
              <Input 
                id="child_location" 
                placeholder="Type location (e.g., Floor 1, Room 3)"
                value={childSwitchForm.location}
                onChange={(e) => setChildSwitchForm({...childSwitchForm, location: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="child_total_ports">Total Ports</Label>
              <Input 
                id="child_total_ports" 
                type="number"
                placeholder="Type number of ports (default: 24)"
                value={childSwitchForm.total_ports}
                onChange={(e) => setChildSwitchForm({...childSwitchForm, total_ports: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateChildSwitchOpen(false);
              setChildSwitchForm({ switch_name: '', location: '', total_ports: '' });
            }}>Cancel</Button>
            <Button 
              onClick={handleCreateChildSwitch}
              className="bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              Create Uplink Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Switch Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Switch?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.item?.switch_name}"? 
              This will also delete all ports associated with this switch. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteSwitch}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Port Assignment Confirmation Dialog */}
      <AlertDialog open={isDeletePortOpen} onOpenChange={setIsDeletePortOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Unlink className="w-5 h-5" />
              Remove Port Assignment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the assignment from Port {deleteTarget?.item?.port_number}? 
              The port will become FREE and can be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmUnassignPort}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Total Switches Dialog */}
      <Dialog open={viewTotalSwitches} onOpenChange={setViewTotalSwitches}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              All Switches ({switches.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Switch Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Total Ports</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Free</TableHead>
                  <TableHead>Parent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {switches.map(sw => {
                  const swPorts = getSwitchPorts(sw.id);
                  return (
                    <TableRow key={sw.id}>
                      <TableCell className="font-medium">{sw.switch_name}</TableCell>
                      <TableCell>{sw.location}</TableCell>
                      <TableCell>{sw.total_ports}</TableCell>
                      <TableCell><Badge className="bg-emerald-100 text-emerald-700">{swPorts.filter(p => p.status === 'ACTIVE').length}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{swPorts.filter(p => p.status === 'FREE').length}</Badge></TableCell>
                      <TableCell>{getParentSwitchName(sw.parent_switch_id) || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Total Ports Dialog */}
      <Dialog open={viewTotalPorts} onOpenChange={setViewTotalPorts}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5 text-blue-600" />
              All Ports ({ports.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Switch</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Connected To</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ports.map(port => {
                  const sw = switches.find(s => s.id === port.switch_id);
                  return (
                    <TableRow key={port.id}>
                      <TableCell className="font-medium">{sw?.switch_name}</TableCell>
                      <TableCell>{port.port_number}</TableCell>
                      <TableCell>{getPortRoleBadge(port.port_role)}</TableCell>
                      <TableCell><Badge variant="outline" className={getPortStatusColor(port.status)}>{port.status}</Badge></TableCell>
                      <TableCell>{port.assign_name || '—'}</TableCell>
                      <TableCell>{port.user_location || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Active Ports Dialog */}
      <Dialog open={viewActivePorts} onOpenChange={setViewActivePorts}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-emerald-600" />
              Active Ports ({ports.filter(p => p.status === 'ACTIVE').length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Switch</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Connected To</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getActivePortsWithSwitch().map(port => (
                  <TableRow key={port.id}>
                    <TableCell className="font-medium">{port.switch_name}</TableCell>
                    <TableCell>{port.port_number}</TableCell>
                    <TableCell>{getPortRoleBadge(port.port_role)}</TableCell>
                    <TableCell>{port.assign_name || '—'}</TableCell>
                    <TableCell>{port.user_location || '—'}</TableCell>
                    <TableCell>{port.device_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View Free Ports Dialog */}
      <Dialog open={viewFreePorts} onOpenChange={setViewFreePorts}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-bold text-xs">F</span>
              </div>
              Free Ports ({ports.filter(p => p.status === 'FREE').length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Switch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Port Number</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFreePortsWithSwitch().map(port => (
                  <TableRow key={port.id}>
                    <TableCell className="font-medium">{port.switch_name}</TableCell>
                    <TableCell>{port.switch_location}</TableCell>
                    <TableCell>{port.port_number}</TableCell>
                    <TableCell>{getPortRoleBadge(port.port_role)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SwitchPortMapping;
