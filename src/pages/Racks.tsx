import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Server, Network, MapPin, Plus, Link2, Unlink } from "lucide-react";
import RackManager, { Rack } from "@/components/RackManager";
import indexedDBService from "@/services/indexedDBService";
import { useCloudRealtime } from "@/hooks/useCloudRealtime";
import { toast } from "@/components/ui/use-toast";

interface Switch {
  id: string;
  switch_name: string;
  location: string;
  total_ports: number;
  rack_id?: string | null;
}

const Racks = () => {
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [assignTo, setAssignTo] = useState<Rack | null>(null);

  const load = async () => {
    const data = await indexedDBService.getAll("switches");
    setSwitches(data || []);
  };
  useEffect(() => { load(); }, []);
  useCloudRealtime(["switches_cloud"], () => { load(); });

  const assignSwitch = async (sw: Switch, rackId: string | null) => {
    const updated = { ...sw, rack_id: rackId };
    await indexedDBService.put("switches", updated);
    toast({
      title: rackId ? "Assigned" : "Unassigned",
      description: `${sw.switch_name} ${rackId ? "added to" : "removed from"} rack`,
    });
    load();
  };

  const unassigned = switches.filter((s) => !s.rack_id);
  const assignedToCurrent = assignTo ? switches.filter((s) => s.rack_id === assignTo.id) : [];

  return (
    <div className="w-full py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Server Racks
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage Main and Sub server racks. Assign switches to racks.
        </p>
      </div>

      <RackManager
        switches={switches as any}
        onAddSwitchToRack={(r) => setAssignTo(r)}
      />

      {/* Unassigned switches panel */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold">Unassigned Switches</h2>
            <Badge variant="outline">{unassigned.length}</Badge>
          </div>
          {unassigned.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              All switches are assigned to racks.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {unassigned.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border p-2 bg-muted/30">
                  <div>
                    <div className="font-medium text-sm">{s.switch_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {s.location}
                    </div>
                  </div>
                  <Badge variant="outline">{s.total_ports} ports</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={!!assignTo} onOpenChange={(o) => !o && setAssignTo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-emerald-600" />
              Assign Switches — {assignTo?.rack_name}
            </DialogTitle>
            <DialogDescription>
              Add existing switches to this rack, or remove them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">In this rack ({assignedToCurrent.length})</div>
              {assignedToCurrent.length === 0 ? (
                <div className="text-xs text-muted-foreground">No switches yet.</div>
              ) : (
                <div className="space-y-1">
                  {assignedToCurrent.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded border p-2 bg-emerald-50 dark:bg-emerald-950/40">
                      <span className="text-sm font-medium">{s.switch_name}</span>
                      <Button size="sm" variant="outline" onClick={() => assignSwitch(s, null)}>
                        <Unlink className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Available switches ({unassigned.length})</div>
              {unassigned.length === 0 ? (
                <div className="text-xs text-muted-foreground">No unassigned switches. Create one from Switch Mapping.</div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {unassigned.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <div className="text-sm font-medium">{s.switch_name}</div>
                        <div className="text-xs text-muted-foreground">{s.location}</div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-emerald-500 to-teal-500"
                        onClick={() => assignTo && assignSwitch(s, assignTo.id)}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" /> Assign
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTo(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Racks;
