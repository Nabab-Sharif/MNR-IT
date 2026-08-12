import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Zap } from "lucide-react";

interface PortLike {
  id: string;
  port_number: number;
  status: "FREE" | "ACTIVE" | "ISSUE" | "DISABLED";
  port_role: "ACCESS" | "UPLINK";
  assign_name?: string | null;
  device_name?: string | null;
  user_location?: string | null;
}

interface Props {
  switchName: string;
  totalPorts: number;
  ports: PortLike[];
  onPortClick: (port: PortLike) => void;
}

const statusColor = (s: PortLike["status"]) => {
  switch (s) {
    case "ACTIVE": return "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.9)] animate-pulse";
    case "ISSUE": return "bg-amber-400 shadow-[0_0_10px_2px_rgba(251,191,36,0.9)] animate-pulse";
    case "DISABLED": return "bg-red-500 shadow-[0_0_8px_1px_rgba(239,68,68,0.7)]";
    default: return "bg-slate-600";
  }
};

const SwitchFrontPanel = ({ switchName, totalPorts, ports, onPortClick }: Props) => {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [locateId, setLocateId] = useState<string | null>(null);

  const portMap = useMemo(() => {
    const m = new Map<number, PortLike>();
    ports.forEach((p) => m.set(p.port_number, p));
    return m;
  }, [ports]);

  const matches = (p: PortLike | undefined, n: number) => {
    if (statusFilter !== "ALL" && (!p || p.status !== statusFilter)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    if (String(n).includes(q)) return true;
    if (!p) return false;
    return (
      (p.assign_name || "").toLowerCase().includes(q) ||
      (p.device_name || "").toLowerCase().includes(q) ||
      (p.user_location || "").toLowerCase().includes(q)
    );
  };

  // Real switch layout: columns = totalPorts/2, top row = 1..N/2, bottom row = N/2+1..N
  const cols = Math.ceil(totalPorts / 2);
  const topRow: number[] = [];
  const botRow: number[] = [];
  for (let c = 0; c < cols; c++) {
    const t = c + 1;
    const b = c + 1 + cols;
    if (t <= totalPorts) topRow.push(t);
    if (b <= totalPorts) botRow.push(b);
  }
  // Split into groups of 6 columns with a visual gap
  const groupSize = 6;
  const colGroups: number[] = [];
  for (let i = 0; i < cols; i += groupSize) colGroups.push(Math.min(groupSize, cols - i));

  const stats = {
    active: ports.filter((p) => p.status === "ACTIVE").length,
    free: ports.filter((p) => p.status === "FREE").length,
    issue: ports.filter((p) => p.status === "ISSUE").length,
    disabled: ports.filter((p) => p.status === "DISABLED").length,
  };

  return (
    <div className="p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search port # / user / device / location..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        {["ALL", "ACTIVE", "FREE", "ISSUE", "DISABLED"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </Button>
        ))}
        <div className="flex gap-3 text-xs text-slate-300 ml-auto">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> {stats.active} Up</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> {stats.free} Free</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {stats.issue} Warn</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> {stats.disabled} Off</span>
        </div>
      </div>

      {/* Switch chassis */}
      <div className="rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-950 border border-neutral-700 p-3 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          {/* Rack ears */}
          <div className="w-3 h-16 rounded bg-neutral-700 flex flex-col items-center justify-around">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          </div>
          {/* LCD */}
          <div className="bg-black border border-emerald-900 rounded px-3 py-2 font-mono text-[10px] text-emerald-400 leading-tight min-w-[130px]">
            <div>{switchName}</div>
            <div className="text-emerald-500/70">PORTS {totalPorts}</div>
            <div className="text-emerald-500/70">STAT OK</div>
          </div>
          {/* Ports grid — real switch layout */}
          <div className="flex-1 overflow-x-auto">
            <div className="inline-block bg-gradient-to-b from-neutral-950 to-black rounded border border-neutral-800 px-2 py-2">
              {(() => {
                let colIdx = 0;
                const renderCell = (n: number, isTop: boolean) => {
                  const p = portMap.get(n);
                  const dim = query.trim() || statusFilter !== "ALL" ? !matches(p, n) : false;
                  const locating = locateId && p?.id === locateId;
                  return (
                    <div key={n} className="flex flex-col items-center gap-[2px]">
                      {isTop && (
                        <span className={`text-[9px] font-mono leading-none ${locating ? "text-cyan-300" : "text-slate-400"}`}>{n}</span>
                      )}
                      {isTop && (
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColor(p?.status || "FREE")}`} />
                      )}
                      <button
                        onClick={() => p && onPortClick(p)}
                        title={p ? `Port ${n} • ${p.status}${p.assign_name ? ` • ${p.assign_name}` : ""}` : `Port ${n}`}
                        className={`relative w-6 h-6 rounded-[3px] border bg-gradient-to-b from-neutral-800 via-neutral-950 to-black flex items-center justify-center hover:border-cyan-400 transition-all ${
                          locating ? "border-cyan-400 ring-2 ring-cyan-400 animate-pulse" : "border-neutral-700"
                        } ${dim ? "opacity-25" : ""}`}
                      >
                        {/* RJ45 jack detail */}
                        <div className="w-4 h-4 rounded-[1px] bg-black border border-neutral-800 flex flex-col items-center justify-center gap-[1px]">
                          <div className="w-3 h-[1px] bg-neutral-600" />
                          <div className="w-3 h-[1px] bg-neutral-700" />
                        </div>
                      </button>
                      {!isTop && (
                        <div className={`w-1.5 h-1.5 rounded-full ${statusColor(p?.status || "FREE")}`} />
                      )}
                      {!isTop && (
                        <span className={`text-[9px] font-mono leading-none ${locating ? "text-cyan-300" : "text-slate-400"}`}>{n}</span>
                      )}
                    </div>
                  );
                };
                return (
                  <div className="flex gap-2">
                    {colGroups.map((gLen, gi) => {
                      const start = colIdx;
                      colIdx += gLen;
                      return (
                        <div key={gi} className="flex flex-col gap-1">
                          <div className="flex gap-[3px]">
                            {topRow.slice(start, start + gLen).map((n) => renderCell(n, true))}
                          </div>
                          <div className="flex gap-[3px]">
                            {botRow.slice(start, start + gLen).map((n) => renderCell(n, false))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
          {/* SFP uplinks */}
          <div className="flex flex-col gap-1 border-l border-neutral-700 pl-3">
            <span className="text-[9px] text-cyan-400 font-mono">SFP</span>
            {[1, 2].map((i) => (
              <div key={i} className="w-10 h-5 rounded-sm border border-cyan-900 bg-black flex items-center justify-center">
                <div className={`w-1.5 h-1.5 rounded-full ${i === 1 ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.9)]" : "bg-neutral-700"}`} />
              </div>
            ))}
          </div>
          <div className="w-3 h-16 rounded bg-neutral-700 flex flex-col items-center justify-around">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> LINK / ACT</span>
          <span>Click any port to assign / edit • Hover for details</span>
        </div>
      </div>
    </div>
  );
};

export default SwitchFrontPanel;