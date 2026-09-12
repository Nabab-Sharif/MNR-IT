import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Server, Plus, Edit, Trash2, MapPin, Network } from "lucide-react";
import indexedDBService from "@/services/indexedDBService";
import { toast } from "@/components/ui/use-toast";

export interface Rack {
  id: string;
  rack_name: string;
  location: string;
  rack_type: "MAIN" | "SUB";
  notes?: string;
  created_at: string;
}

interface Props {
  switches: Array<{ id: string; switch_name: string; location: string; rack_id?: string | null }>;
  onAddSwitchToRack: (rack: Rack) => void;
}

const genId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const RackManager = ({ switches, onAddSwitchToRack }: Props) => {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rack | null>(null);
  const [deleting, setDeleting] = useState<Rack | null>(null);
  const [form, setForm] = useState({ rack_name: "", location: "", rack_type: "SUB" as "MAIN" | "SUB", notes: "" });

  const load = async () => {
    const data = await indexedDBService.getAll("racks");
    setRacks(data || []);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ rack_name: "", location: "", rack_type: "SUB", notes: "" });
    setOpen(true);
  };
  const openEdit = (r: Rack) => {
    setEditing(r);
    setForm({ rack_name: r.rack_name, location: r.location, rack_type: r.rack_type, notes: r.notes || "" });
    setOpen(true);
  };
  const save = async () => {
    if (!form.rack_name.trim() || !form.location.trim()) {
      toast({ title: "Error", description: "Rack name and location required", variant: "destructive" });
      return;
    }
    const rec: Rack = editing
      ? { ...editing, ...form }
      : { id: genId(), ...form, created_at: new Date().toISOString() };
    await indexedDBService.put("racks", rec);
    toast({ title: "Success", description: `Rack ${editing ? "updated" : "created"}` });
    setOpen(false);
    load();
  };
  const remove = async () => {
    if (!deleting) return;
    await indexedDBService.delete("racks", deleting.id);
    toast({ title: "Deleted", description: `Rack "${deleting.rack_name}" removed` });
    setDeleting(null);
    load();
  };

  const switchesInRack = (rackId: string) => switches.filter((s) => s.rack_id === rackId);

  return (
    <Card className="mb-6 border-emerald-200 dark:border-emerald-800">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold">Server Racks</h2>
            <Badge variant="outline">{racks.length}</Badge>
          </div>
          <Button size="sm" onClick={openAdd} className="bg-gradient-to-r from-emerald-500 to-teal-500">
            <Plus className="w-4 h-4 mr-1" /> Add Rack
          </Button>
        </div>

        {racks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No racks yet. Click "Add Rack" to create your Main Server Rack or floor Sub-Racks.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {racks.map((r) => {
              const rackSwitches = switchesInRack(r.id);
              return (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 ${r.rack_type === "MAIN"
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-400"
                    : "bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border-indigo-300"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{r.rack_name}</span>
                        <Badge className={r.rack_type === "MAIN" ? "bg-emerald-600" : "bg-indigo-600"}>
                          {r.rack_type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {r.location}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                        <Edit className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDeleting(r)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {rackSwitches.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rackSwitches.map((s) => (
                        <Badge key={s.id} variant="outline" className="text-[10px]">
                          <Network className="w-3 h-3 mr-1" /> {s.switch_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">{rackSwitches.length} switches</div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 border-dashed"
                    onClick={() => onAddSwitchToRack(r)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Switch to this Rack
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-600" />
              {editing ? "Edit Rack" : "Add New Rack"}
            </DialogTitle>
            <DialogDescription>Server Rack (Main or Floor Sub-Rack).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label>Rack Name *</Label>
              <Input
                placeholder="e.g., Main Server Rack, Floor-2 Rack"
                value={form.rack_name}
                onChange={(e) => setForm({ ...form, rack_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Location *</Label>
              <Input
                placeholder="e.g., Server Room, Floor 2"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Rack Type</Label>
              <div className="flex gap-2">
                {(["MAIN", "SUB"] as const).map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={form.rack_type === t ? "default" : "outline"}
                    className={form.rack_type === t ? (t === "MAIN" ? "bg-emerald-600" : "bg-indigo-600") : ""}
                    onClick={() => setForm({ ...form, rack_type: t })}
                  >
                    {t === "MAIN" ? "Main Server Rack" : "Sub Rack (Floor)"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-gradient-to-r from-emerald-500 to-teal-500">
              {editing ? "Update" : "Create"} Rack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rack?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.rack_name}" will be removed. Switches inside will remain but lose their rack link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default RackManager;
