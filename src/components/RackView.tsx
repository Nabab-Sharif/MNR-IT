import { Server, Network } from "lucide-react";

interface SwitchNode {
  id: string;
  switch_name: string;
  location: string;
  total_ports: number;
  switch_type?: string;
}
interface PortLike { switch_id: string; status: string; }

interface Props {
  switches: SwitchNode[];
  ports: PortLike[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const RackView = ({ switches, ports, selectedId, onSelect }: Props) => {
  const totalUnits = 42;
  // Assign each switch a rack unit slot from top
  const slots: (SwitchNode | null)[] = Array(totalUnits).fill(null);
  switches.slice(0, totalUnits).forEach((s, i) => { slots[i] = s; });

  return (
    <div className="rounded-lg bg-gradient-to-b from-neutral-900 to-black border border-neutral-700 p-3 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-slate-100">Rack View</span>
        <span className="text-[10px] text-slate-500 ml-auto">42U</span>
      </div>
      <div className="border-2 border-neutral-800 rounded bg-neutral-950 p-1 max-h-[500px] overflow-y-auto">
        {slots.map((sw, idx) => {
          const unit = totalUnits - idx;
          if (!sw) {
            return (
              <div key={idx} className="flex items-center h-6 border-b border-neutral-900/60">
                <span className="w-8 text-[9px] text-neutral-600 font-mono text-center">{unit}</span>
                <div className="flex-1 h-4 mx-1 rounded-sm bg-gradient-to-r from-neutral-900 to-neutral-950 border border-neutral-900" />
              </div>
            );
          }
          const swPorts = ports.filter((p) => p.switch_id === sw.id);
          const active = swPorts.filter((p) => p.status === "ACTIVE").length;
          const isSel = selectedId === sw.id;
          return (
            <div key={idx} className="flex items-center h-6 border-b border-neutral-900/60">
              <span className="w-8 text-[9px] text-neutral-500 font-mono text-center">{unit}</span>
              <button
                onClick={() => onSelect?.(sw.id)}
                className={`flex-1 h-5 mx-1 rounded-sm flex items-center gap-2 px-2 border transition-all ${
                  isSel
                    ? "bg-gradient-to-r from-cyan-950 to-slate-800 border-cyan-400 ring-1 ring-cyan-400/50"
                    : "bg-gradient-to-r from-neutral-800 to-neutral-900 border-neutral-700 hover:border-cyan-500"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active > 0 ? "bg-emerald-400 animate-pulse" : "bg-neutral-600"}`} />
                <Network className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                <span className="text-[10px] font-mono text-slate-100 truncate flex-1 text-left">{sw.switch_name}</span>
                <span className="text-[9px] text-slate-400 shrink-0">{active}/{sw.total_ports}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RackView;