import { useMemo } from "react";
import { Server, Monitor, Phone, Camera, Printer, ArrowUp, Cable, Activity, Cpu } from "lucide-react";

interface SwitchNode {
  id: string;
  switch_name: string;
  location: string;
  total_ports: number;
  parent_switch_id: string | null;
  parent_port_number: number | null;
  switch_type?: string;
}
interface PortLike {
  id: string;
  switch_id: string;
  port_number: number;
  status: string;
  assign_type: string | null;
  assign_name: string | null;
  device_name?: string | null;
  port_role?: string;
}

interface Props {
  currentSwitch: SwitchNode;
  switches: SwitchNode[];
  ports: PortLike[];
  selectedPortNumber?: number | null;
  onSelectPort?: (portNumber: number) => void;
}

const categorize = (name: string | null | undefined): "phone" | "cctv" | "printer" | "pc" => {
  const s = (name || "").toLowerCase();
  if (s.includes("phone") || s.includes("ip-p") || s.includes("yealink") || s.includes("polycom")) return "phone";
  if (s.includes("cctv") || s.includes("camera") || s.includes("nvr") || s.includes("dvr")) return "cctv";
  if (s.includes("printer") || s.includes("laserjet") || s.includes("mfp")) return "printer";
  return "pc";
};

const catMeta = {
  pc: { icon: Monitor, color: "#22d3ee", label: "PC" },
  phone: { icon: Phone, color: "#a78bfa", label: "Phone" },
  cctv: { icon: Camera, color: "#f472b6", label: "CCTV" },
  printer: { icon: Printer, color: "#facc15", label: "Printer" },
};

const SwitchTopologyView = ({ currentSwitch, switches, ports, selectedPortNumber, onSelectPort }: Props) => {
  const swPorts = useMemo(
    () => ports.filter((p) => p.switch_id === currentSwitch.id).sort((a, b) => a.port_number - b.port_number),
    [ports, currentSwitch.id]
  );
  const active = swPorts.filter((p) => p.status === "ACTIVE");
  const free = swPorts.filter((p) => p.status === "FREE").length;
  const issue = swPorts.filter((p) => p.status === "ISSUE").length;

  const parent = currentSwitch.parent_switch_id
    ? switches.find((s) => s.id === currentSwitch.parent_switch_id) || null
    : null;

  const children = active.filter((p) => p.assign_type === "SWITCH");
  const devices = active.filter((p) => p.assign_type !== "SWITCH");

  const counts = useMemo(() => {
    const c = { pc: 0, phone: 0, cctv: 0, printer: 0 };
    devices.forEach((p) => c[categorize(p.assign_name || p.device_name)]++);
    return c;
  }, [devices]);

  return (
    <div className="rounded-xl bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 border border-indigo-500/30 p-4 shadow-[0_0_40px_rgba(99,102,241,0.15)] relative overflow-hidden">
      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.6) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/50">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide">{currentSwitch.switch_name}</div>
            <div className="text-[10px] text-indigo-300 uppercase tracking-widest">Focused Topology</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {active.length} Active
          </span>
          <span className="px-2 py-1 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/30">{free} Free</span>
          {issue > 0 && (
            <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">{issue} Issue</span>
          )}
        </div>
      </div>

      {/* Uplink Card */}
      <div className="relative mb-4">
        {parent ? (
          <div className="flex items-center gap-3 rounded-lg bg-slate-900/60 border border-cyan-500/30 p-3">
            <ArrowUp className="w-4 h-4 text-cyan-400 animate-bounce" />
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest text-cyan-300">Uplink → Parent</div>
              <div className="text-sm font-semibold text-white">
                {parent.switch_name} <span className="text-cyan-400">· Port {currentSwitch.parent_port_number}</span>
              </div>
            </div>
            <Cable className="w-4 h-4 text-cyan-400" />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 p-3">
            <Activity className="w-4 h-4 text-amber-400" />
            <div className="text-sm font-semibold text-amber-200">Root Switch · No Uplink</div>
          </div>
        )}
      </div>

      {/* Center Switch + Radial connections */}
      <div className="relative bg-slate-950/50 rounded-lg border border-indigo-500/20 p-4 mb-4">
        {/* Category summary bar */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => {
            const meta = catMeta[k];
            const Icon = meta.icon;
            return (
              <div
                key={k}
                className="flex flex-col items-center gap-1 rounded-lg bg-slate-900/70 border border-slate-700 p-2 hover:border-current transition-colors"
                style={{ color: meta.color }}
              >
                <Icon className="w-4 h-4" />
                <div className="text-lg font-bold">{counts[k]}</div>
                <div className="text-[9px] uppercase text-slate-400">{meta.label}</div>
              </div>
            );
          })}
        </div>

        {/* Port grid map */}
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1.5">
          {swPorts.map((p) => {
            const isSel = selectedPortNumber === p.port_number;
            const isActive = p.status === "ACTIVE";
            const isUplink = p.port_role === "UPLINK";
            const cat = isActive && p.assign_type !== "SWITCH" ? categorize(p.assign_name || p.device_name) : null;
            const color = cat ? catMeta[cat].color : isUplink ? "#a855f7" : isActive ? "#10b981" : "#334155";
            return (
              <button
                key={p.id}
                onClick={() => onSelectPort?.(p.port_number)}
                title={`Port ${p.port_number} · ${p.assign_name || p.status}`}
                className={`relative aspect-square rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
                  isSel ? "scale-125 z-10 ring-2 ring-white shadow-lg" : "hover:scale-110"
                }`}
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${color}, ${color}88)`
                    : "linear-gradient(135deg, #1e293b, #0f172a)",
                  borderWidth: 1,
                  borderColor: isSel ? "#fff" : isActive ? color : "#334155",
                  color: isActive ? "#0f172a" : "#64748b",
                }}
              >
                {p.port_number}
                {isActive && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-ping"
                    style={{ background: color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Child switches list */}
      {children.length > 0 && (
        <div className="rounded-lg bg-slate-900/60 border border-purple-500/30 p-3">
          <div className="text-[10px] uppercase tracking-widest text-purple-300 mb-2 flex items-center gap-1">
            <Server className="w-3 h-3" /> Downstream Switches ({children.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-500/40 text-xs text-white"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="font-semibold">{c.assign_name}</span>
                <span className="text-purple-300 text-[10px]">P{c.port_number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwitchTopologyView;