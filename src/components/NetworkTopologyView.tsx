import { useEffect, useMemo, useState } from "react";
import { Cloud, Shield, Server, HardDrive, Cpu, Zap, Network, Monitor, Camera, Wifi, Phone, Printer, Circle } from "lucide-react";
import indexedDBService from "@/services/indexedDBService";

interface SwitchNode {
  id: string;
  switch_name: string;
  location: string;
  total_ports: number;
  parent_switch_id: string | null;
  parent_port_number: number | null;
  switch_type?: string;
  rack_id?: string | null;
}
interface RackLike {
  id: string;
  rack_name: string;
  location: string;
  rack_type: "MAIN" | "SUB";
}
interface PortLike {
  id: string;
  switch_id: string;
  port_number: number;
  status: string;
  assign_type: string | null;
  assign_name: string | null;
  device_name?: string | null;
}
interface Props {
  switches: SwitchNode[];
  ports: PortLike[];
  onSelectSwitch?: (id: string) => void;
  selectedId?: string | null;
  selectedPort?: { switch_id: string; assign_name: string | null; device_name?: string | null } | null;
}

type Cat = "pc" | "cctv" | "wifi" | "phone" | "printer";
const categorize = (name: string | null | undefined): Cat => {
  const s = (name || "").toLowerCase();
  if (s.includes("cctv") || s.includes("camera") || s.includes("nvr") || s.includes("dvr")) return "cctv";
  if (s.includes("wifi") || s.includes("wi-fi") || s.includes(" ap") || s.includes("access point") || s.includes("ap-")) return "wifi";
  if (s.includes("phone") || s.includes("ip-p") || s.includes("yealink") || s.includes("polycom")) return "phone";
  if (s.includes("printer") || s.includes("laserjet") || s.includes("mfp")) return "printer";
  return "pc";
};

// Stylized 3D rack tower rendered in SVG. Used for both MAIN and LOCAL racks.
const RackTower = ({ x, y, w, h, big = false }: { x: number; y: number; w: number; h: number; big?: boolean }) => {
  const units = big ? 14 : 9;
  const unitH = (h - 24) / units;
  return (
    <g>
      {/* base platform with underglow */}
      <ellipse cx={x + w / 2} cy={y + h + 10} rx={w / 2 + 14} ry={10} fill="#0ea5e9" opacity="0.35" filter="url(#glow)" />
      <rect x={x - 8} y={y + h - 4} width={w + 16} height={12} rx={3} fill="#0f172a" stroke="#1e293b" />
      {/* rack body */}
      <rect x={x} y={y} width={w} height={h - 4} rx={4} fill="#0b1220" stroke="#1f2937" />
      {/* top */}
      <rect x={x - 4} y={y - 6} width={w + 8} height={8} rx={2} fill="#111827" stroke="#1f2937" />
      {/* rack units */}
      {Array.from({ length: units }).map((_, i) => {
        const uy = y + 6 + i * unitH;
        // random-ish LED colors (deterministic by index)
        const leds = Array.from({ length: big ? 8 : 5 }).map((__, j) => {
          const c = ["#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#10b981", "#22d3ee"][(i * 7 + j * 3) % 6];
          return { c, cx: x + 6 + j * ((w - 12) / (big ? 8 : 5)) };
        });
        return (
          <g key={i}>
            <rect x={x + 3} y={uy} width={w - 6} height={unitH - 3} rx={1.5} fill="#020617" stroke="#111827" />
            {leds.map((l, k) => (
              <circle key={k} cx={l.cx + 2} cy={uy + unitH / 2 - 1} r={1.4} fill={l.c}>
                <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1 + (k % 3) * 0.4}s`} repeatCount="indefinite" />
              </circle>
            ))}
            {/* small screen strip on the middle unit of big rack */}
            {big && i === Math.floor(units / 2) && (
              <rect x={x + w / 2 - 14} y={uy + 2} width={28} height={unitH - 7} rx={1} fill="#052e3a" stroke="#22d3ee" strokeOpacity={0.6} />
            )}
          </g>
        );
      })}
    </g>
  );
};

const NetworkTopologyView = ({ switches, ports, onSelectSwitch, selectedId }: Props) => {
  const [racks, setRacks] = useState<RackLike[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const d = await indexedDBService.getAll("racks");
        if (!cancelled) setRacks((d as RackLike[]) || []);
      } catch { /* store may not exist */ }
    };
    load();
    const id = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Group switches into local racks. Prefer rack_id; fallback: group non-core switches by location.
  const core = useMemo(() => switches.find((s) => !s.parent_switch_id) || null, [switches]);
  const mainRack = useMemo(() => racks.find((r) => r.rack_type === "MAIN") || null, [racks]);
  const subRacks = useMemo(() => racks.filter((r) => r.rack_type !== "MAIN"), [racks]);

  type LocalGroup = { id: string; label: string; switchIds: string[]; parentId: string | null; depth: number };
  const localGroups = useMemo<LocalGroup[]>(() => {
    // Start with configured SUB racks
    const groups: LocalGroup[] = subRacks.map((r) => ({
      id: `rack:${r.id}`,
      label: r.rack_name,
      switchIds: switches.filter((s) => s.rack_id === r.id).map((s) => s.id),
      parentId: null,
      depth: 1,
    }));
    // Add fallback groups for switches without a rack_id (skip core)
    const orphan = switches.filter((s) => !s.rack_id && s.id !== core?.id);
    const byLoc = new Map<string, string[]>();
    orphan.forEach((s) => {
      const key = (s.location || "Unassigned").trim();
      const arr = byLoc.get(key) || [];
      arr.push(s.id);
      byLoc.set(key, arr);
    });
    let idx = groups.length + 1;
    byLoc.forEach((ids, loc) => {
      groups.push({ id: `loc:${loc}`, label: `Local Rack ${String(idx).padStart(2, "0")}`, switchIds: ids, parentId: null, depth: 1 });
      idx++;
    });

    // Build switch -> group map (main rack switches map to "MAIN")
    const MAIN_ID = "MAIN";
    const swToGroup = new Map<string, string>();
    switches.forEach((s) => {
      if (s.id === core?.id || (mainRack && s.rack_id === mainRack.id)) {
        swToGroup.set(s.id, MAIN_ID);
      }
    });
    groups.forEach((g) => g.switchIds.forEach((sid) => swToGroup.set(sid, g.id)));

    // Determine each group's parent group by inspecting uplinks that cross group boundaries.
    groups.forEach((g) => {
      for (const sid of g.switchIds) {
        const sw = switches.find((x) => x.id === sid);
        if (!sw?.parent_switch_id) continue;
        const parentGroup = swToGroup.get(sw.parent_switch_id);
        if (parentGroup && parentGroup !== g.id) {
          g.parentId = parentGroup;
          break;
        }
      }
    });

    // Compute depth via walk (MAIN = depth 0). Cycle-safe with a guard.
    const depthOf = (id: string, guard = 0): number => {
      if (id === MAIN_ID) return 0;
      if (guard > 20) return 1;
      const g = groups.find((x) => x.id === id);
      if (!g || !g.parentId) return 1;
      return depthOf(g.parentId, guard + 1) + 1;
    };
    groups.forEach((g) => { g.depth = depthOf(g.id); });
    return groups;
  }, [subRacks, switches, core]);

  // Per-group device counts derived from ports on the group's switches.
  const groupCounts = useMemo(() => {
    const m = new Map<string, Record<Cat, number>>();
    localGroups.forEach((g) => {
      const c: Record<Cat, number> = { pc: 0, cctv: 0, wifi: 0, phone: 0, printer: 0 };
      const ids = new Set(g.switchIds);
      ports.forEach((p) => {
        if (!ids.has(p.switch_id)) return;
        if (p.status !== "ACTIVE" || p.assign_type === "SWITCH") return;
        c[categorize(p.assign_name || p.device_name)]++;
      });
      m.set(g.id, c);
    });
    return m;
  }, [localGroups, ports]);

  // Global totals for the bottom stats bar.
  const totals = useMemo(() => {
    const t = { racks: localGroups.length + (mainRack ? 1 : (core ? 1 : 0)), devices: 0, cctv: 0, wifi: 0, phone: 0 };
    ports.forEach((p) => {
      if (p.status !== "ACTIVE" || p.assign_type === "SWITCH") return;
      t.devices++;
      const cat = categorize(p.assign_name || p.device_name);
      if (cat === "cctv") t.cctv++;
      else if (cat === "wifi") t.wifi++;
      else if (cat === "phone") t.phone++;
    });
    return t;
  }, [ports, localGroups, mainRack, core]);

  // Layout constants — matches the reference: header, centered core chain,
  // MAIN rack in the middle, local racks flanking left/right, bottom edge row.
  const W = 1400;
  const H = 900;
  const cx = W / 2;                 // horizontal center
  const headerH = 46;               // top title bar
  const coreTop = headerH + 30;     // internet icon top
  const mainRackW = 220;
  const mainRackH = 260;
  const mainTop = 330;              // main rack top y
  const mainCx = cx;
  const mainBaseY = mainTop + mainRackH;
  const localW = 150;               // width of local rack tower
  const localH = 150;
  const cardH = 130;                // connected devices card
  const flankY = 300;               // local rack top y (aligned with main)
  const edgeY = 640;                // bottom row rack tops
  const edgeW = 110;
  const edgeH = 110;

  // Split local groups: depth 1 flanks the main rack (up to 3 per side).
  // Any additional depth-1 groups + all deeper groups fall into the bottom "edge" row.
  const depth1 = localGroups.filter((g) => g.depth === 1);
  const deeper = localGroups.filter((g) => g.depth > 1);
  const flankLeft = depth1.slice(0, 3);
  const flankRight = depth1.slice(3, 6);
  const edgeRacks = [...depth1.slice(6), ...deeper];
  const edgeShown = edgeRacks.slice(0, 10);
  const edgeOverflow = edgeRacks.length > 10;

  type Pos = { x: number; y: number };
  const positions = new Map<string, Pos>();

  // Flank layout: three slots on each side of the main rack.
  const flankGapX = 40;
  const leftEndX = mainCx - mainRackW / 2 - flankGapX - localW; // rightmost left flank x
  const rightStartX = mainCx + mainRackW / 2 + flankGapX;
  const flankStep = localW + 40;
  flankLeft.forEach((g, i) => {
    // fill from closest-to-main outward
    positions.set(g.id, { x: leftEndX - i * flankStep, y: flankY });
  });
  flankRight.forEach((g, i) => {
    positions.set(g.id, { x: rightStartX + i * flankStep, y: flankY });
  });

  // Bottom edge row.
  const edgeSlots = edgeShown.length + (edgeOverflow ? 1 : 0);
  const edgeSpread = Math.min(1200, Math.max(edgeSlots, 1) * (edgeW + 20));
  const edgeStartX = (W - edgeSpread) / 2;
  const edgeStep = edgeSlots > 1 ? (edgeSpread - edgeW) / (edgeSlots - 1) : 0;
  edgeShown.forEach((g, i) => {
    positions.set(g.id, { x: edgeStartX + i * edgeStep, y: edgeY });
  });
  const edgeOverflowPos = edgeOverflow
    ? { x: edgeStartX + edgeShown.length * edgeStep, y: edgeY }
    : null;

  const flankGroups = [...flankLeft, ...flankRight];

  const getParentAnchor = (parentId: string | null | undefined) => {
    if (!parentId || parentId === "MAIN") return { cx: mainCx, cy: mainBaseY };
    const pp = positions.get(parentId);
    if (!pp) return { cx: mainCx, cy: mainBaseY };
    return { cx: pp.x + localW / 2, cy: pp.y + localH + cardH + 20 };
  };

  const catMeta: Record<Cat, { label: string; Icon: typeof Monitor }> = {
    pc: { label: "PC / LAPTOP", Icon: Monitor },
    cctv: { label: "CCTV CAMERA", Icon: Camera },
    wifi: { label: "WI-FI AP", Icon: Wifi },
    phone: { label: "IP PHONE", Icon: Phone },
    printer: { label: "PRINTER", Icon: Printer },
  };

  return (
    <div className="rounded-2xl bg-[#05070d] border border-cyan-500/20 p-3 sm:p-4 relative overflow-hidden shadow-[0_0_60px_rgba(14,165,233,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-widest text-cyan-100">LIVE NETWORK TOPOLOGY</span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 ml-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
        </div>
        <div className="text-[10px] text-slate-500 tracking-widest">DATA CENTER · REAL-TIME</div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.12),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(2,132,199,0.08),transparent_60%)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[900px]" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="fiber" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="softglow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0e2233" strokeWidth="0.5" />
            </pattern>
            <linearGradient id="mainGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* backdrop grid */}
          <rect x="0" y="0" width={W} height={H} fill="url(#grid)" opacity="0.5" />

          {/* TOP HEADER BAR */}
          <g>
            <rect x="20" y="14" width={W - 40} height={headerH} rx="10" fill="#06111f" stroke="#0e7490" />
            <rect x="20" y="14" width={W - 40} height={headerH} rx="10" fill="url(#fiber)" opacity="0.06" />
            <circle cx="52" cy={14 + headerH / 2} r="14" fill="#0b1220" stroke="#22d3ee" />
            <text x="52" y={14 + headerH / 2 + 4} textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="800" letterSpacing="1">MNR</text>
            <text x="80" y={14 + headerH / 2 + 5} fill="#e0f2fe" fontSize="16" fontWeight="800" letterSpacing="4">MNR GROUP GLOBAL IT</text>
            <text x={cx} y={14 + headerH / 2 + 5} textAnchor="middle" fill="#67e8f9" fontSize="14" fontWeight="700" letterSpacing="6">LIVE NETWORK TOPOLOGY</text>
            <text x={W - 40} y={14 + headerH / 2 + 5} textAnchor="end" fill="#94a3b8" fontSize="12" fontWeight="600" letterSpacing="4">DATA CENTER · REAL-TIME</text>
          </g>

          {/* Centered top chain: Internet → Firewall/Router → Core Switch Stack */}
          {(() => {
            const iconCx = cx;
            const inetY = coreTop;
            const fwY = inetY + 70;
            const coreY = fwY + 80;
            return (
              <g>
                <foreignObject x={iconCx - 26} y={inetY} width="52" height="52">
                  {/* @ts-ignore */}
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: "#22d3ee", filter: "drop-shadow(0 0 10px rgba(34,211,238,0.8))" }}>
                    <Cloud size={52} />
                  </div>
                </foreignObject>
                <text x={iconCx + 40} y={inetY + 28} fill="#e0f2fe" fontSize="12" fontWeight="700" letterSpacing="3">INTERNET</text>
                <line x1={iconCx} y1={inetY + 52} x2={iconCx} y2={fwY} stroke="url(#fiber)" strokeWidth="2.4" filter="url(#glow)" />
                {/* Firewall/Router */}
                <g>
                  <rect x={iconCx - 40} y={fwY} width="80" height="52" rx="6" fill="#0b1220" stroke="#1e3a5f" />
                  {Array.from({ length: 4 }).map((_, r) =>
                    Array.from({ length: 6 }).map((__, c) => (
                      <rect key={`${r}-${c}`} x={iconCx - 34 + c * 12} y={fwY + 4 + r * 11} width="10" height="9" rx="1" fill="#111827" stroke="#1f2937" />
                    ))
                  )}
                  <foreignObject x={iconCx - 12} y={fwY + 14} width="24" height="24">
                    {/* @ts-ignore */}
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: "#22d3ee", filter: "drop-shadow(0 0 6px rgba(34,211,238,0.9))" }}>
                      <Shield size={24} />
                    </div>
                  </foreignObject>
                  <text x={iconCx + 52} y={fwY + 30} fill="#cbd5e1" fontSize="12" fontWeight="700" letterSpacing="3">FIREWALL / ROUTER</text>
                </g>
                <line x1={iconCx} y1={fwY + 52} x2={iconCx} y2={coreY} stroke="url(#fiber)" strokeWidth="2.4" filter="url(#glow)" />
                {/* Core Switch Stack */}
                <g>
                  <rect x={iconCx - 60} y={coreY} width="120" height="46" rx="5" fill="#0b1220" stroke="#1e3a5f" />
                  {Array.from({ length: 10 }).map((_, i) => (
                    <g key={i}>
                      <rect x={iconCx - 54 + i * 11} y={coreY + 10} width="8" height="10" rx="1" fill="#052e3a" stroke="#22d3ee" strokeOpacity="0.6" />
                      <circle cx={iconCx - 50 + i * 11} cy={coreY + 30} r="1.5" fill={i % 2 === 0 ? "#10b981" : "#22d3ee"}>
                        <animate attributeName="opacity" values="0.3;1;0.3" dur={`${1 + (i % 3) * 0.3}s`} repeatCount="indefinite" />
                      </circle>
                    </g>
                  ))}
                  <foreignObject x={iconCx - 8} y={coreY + 10} width="16" height="24">
                    {/* @ts-ignore */}
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: "#22d3ee" }}>
                      <Network size={16} />
                    </div>
                  </foreignObject>
                  <text x={iconCx + 72} y={coreY + 30} fill="#cbd5e1" fontSize="12" fontWeight="700" letterSpacing="3">CORE SWITCH STACK</text>
                </g>
                {/* Fiber core link labels (left + right) */}
                <text x={iconCx - 200} y={coreY + 6} textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="700" letterSpacing="3" opacity="0.9">FIBER / CORE LINK</text>
                <text x={iconCx + 200} y={coreY + 6} textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="700" letterSpacing="3" opacity="0.9">FIBER / CORE LINK</text>
                {/* Trunk down to MAIN rack */}
                <line x1={iconCx} y1={coreY + 46} x2={iconCx} y2={mainTop} stroke="url(#fiber)" strokeWidth="3" filter="url(#glow)" />
              </g>
            );
          })()}

          {/* MAIN SERVER RACK — centered, highlighted */}
          {/* green glow halo */}
          <rect
            x={mainCx - mainRackW / 2 - 22}
            y={mainTop - 14}
            width={mainRackW + 44}
            height={mainRackH + 28}
            rx="18"
            fill="url(#mainGlow)"
            stroke="#10b981"
            strokeWidth="1.6"
            filter="url(#glow)"
            opacity="0.9"
          />
          <RackTower x={mainCx - mainRackW / 2} y={mainTop} w={mainRackW} h={mainRackH} big />
          <text x={mainCx} y={mainBaseY + 40} textAnchor="middle" fill="#a7f3d0" fontSize="18" fontWeight="800" letterSpacing="5">MAIN SERVER RACK</text>
          <text x={mainCx} y={mainBaseY + 58} textAnchor="middle" fill="#64748b" fontSize="10" letterSpacing="4">
            {mainRack ? `${mainRack.rack_name.toUpperCase()} · ${mainRack.location.toUpperCase()}` : "MAIN SERVER · 1ST FLOOR"}
          </text>

          {/* Fiber links from parent rack (main or another local rack) to each child rack */}
          {[...flankGroups, ...edgeShown].map((g, i) => {
            const p = positions.get(g.id)!;
            const { cx: x1, cy: y1 } = getParentAnchor(g.parentId);
            const x2 = p.x + localW / 2;
            const y2 = p.y - 4;
            const my = (y1 + y2) / 2;
            const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
            return (
              <g key={`link-${g.id}`}>
                <path d={d} stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="6" fill="none" filter="url(#softglow)" />
                <path d={d} stroke="url(#fiber)" strokeWidth="2.4" fill="none" />
                <circle r="3.2" fill="#e0f7ff">
                  <animateMotion dur={`${2 + (i % 3) * 0.7}s`} repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })}

          {/* Flanking local racks (with device cards) */}
          {flankGroups.map((g) => {
            const p = positions.get(g.id)!;
            const counts = groupCounts.get(g.id) || { pc: 0, cctv: 0, wifi: 0, phone: 0, printer: 0 };
            const isSel = g.switchIds.includes(selectedId || "");
            return (
              <g key={g.id} className="cursor-pointer" onClick={() => g.switchIds[0] && onSelectSwitch?.(g.switchIds[0])}>
                <text x={p.x + localW / 2} y={p.y - 12} textAnchor="middle" fill={isSel ? "#f0f9ff" : "#cbd5e1"} fontSize="12" fontWeight="700" letterSpacing="3">
                  {g.label.toUpperCase()}
                </text>
                <RackTower x={p.x + 15} y={p.y} w={localW - 30} h={localH} />
                {/* connected devices card */}
                <g transform={`translate(${p.x - 8}, ${p.y + localH + 20})`}>
                  <rect width={localW + 16} height={cardH} rx="10" fill="#0a1120" stroke={isSel ? "#22d3ee" : "#1e3a5f"} strokeWidth={isSel ? 1.6 : 1} />
                  <text x={(localW + 16) / 2} y="18" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700" letterSpacing="3">CONNECTED DEVICES</text>
                  <line x1="10" y1="24" x2={localW + 6} y2="24" stroke="#1e293b" />
                  {(Object.keys(catMeta) as Cat[]).map((k, ri) => {
                    const Meta = catMeta[k];
                    const yy = 40 + ri * 18;
                    return (
                      <g key={k}>
                        <foreignObject x="10" y={yy - 12} width="16" height="16">
                          {/* @ts-ignore */}
                          <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: "#94a3b8" }}>
                            <Meta.Icon size={13} />
                          </div>
                        </foreignObject>
                        <text x="32" y={yy} fill="#cbd5e1" fontSize="10" letterSpacing="1">{Meta.label}</text>
                        <text x={localW + 4} y={yy} textAnchor="end" fill="#e2e8f0" fontSize="11" fontWeight="700" fontFamily="ui-monospace, monospace">
                          {String(counts[k]).padStart(2, "0")}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}

          {/* Bottom edge row — smaller racks */}
          {edgeShown.map((g) => {
            const p = positions.get(g.id)!;
            const isSel = g.switchIds.includes(selectedId || "");
            return (
              <g key={`edge-${g.id}`} className="cursor-pointer" onClick={() => g.switchIds[0] && onSelectSwitch?.(g.switchIds[0])}>
                <RackTower x={p.x + 10} y={p.y} w={edgeW - 20} h={edgeH} />
                <text x={p.x + edgeW / 2} y={p.y + edgeH + 18} textAnchor="middle" fill={isSel ? "#67e8f9" : "#cbd5e1"} fontSize="10" fontWeight="700" letterSpacing="2">
                  {g.label.length > 14 ? g.label.slice(0, 12) + "…" : g.label}
                </text>
              </g>
            );
          })}
          {edgeOverflowPos && (
            <g>
              <RackTower x={edgeOverflowPos.x + 10} y={edgeOverflowPos.y} w={edgeW - 20} h={edgeH} />
              <text x={edgeOverflowPos.x - 4} y={edgeOverflowPos.y + edgeH / 2} fill="#22d3ee" fontSize="22" fontWeight="800">···</text>
              <text x={edgeOverflowPos.x + edgeW / 2} y={edgeOverflowPos.y + edgeH + 18} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="700" letterSpacing="2">LOCAL RACK N</text>
            </g>
          )}

          {/* Bottom stats bar */}
          <g transform={`translate(60, ${H - 80})`}>
            <rect width={W - 120} height="60" rx="12" fill="#0a1120" stroke="#1e3a5f" />
            <text x="20" y="18" fill="#22d3ee" fontSize="9" fontWeight="700" letterSpacing="3">NETWORK HEALTH &amp; STATUS BAR</text>
            {[
              { L: "TOTAL RACKS", V: String(totals.racks).padStart(2, "0"), I: Server },
              { L: "TOTAL DEVICES", V: String(totals.devices).padStart(3, "0"), I: Monitor },
              { L: "TOTAL CCTV", V: String(totals.cctv).padStart(3, "0"), I: Camera },
              { L: "TOTAL WI-FI AP", V: String(totals.wifi).padStart(2, "0"), I: Wifi },
              { L: "TOTAL IP PHONE", V: String(totals.phone).padStart(2, "0"), I: Phone },
              { L: "NETWORK STATUS", V: "ONLINE", I: Circle },
            ].map((s, i, arr) => {
              const cw = (W - 120) / arr.length;
              const x = i * cw;
              const isStatus = s.L === "NETWORK STATUS";
              return (
                <g key={i} transform={`translate(${x}, 0)`}>
                  {i > 0 && <line x1="0" y1="12" x2="0" y2="48" stroke="#1e293b" />}
                  <foreignObject x="20" y="14" width="30" height="30">
                    {/* @ts-ignore */}
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ color: isStatus ? "#10b981" : "#22d3ee" }}>
                      <s.I size={24} />
                    </div>
                  </foreignObject>
                  <text x="60" y="26" fill="#64748b" fontSize="10" letterSpacing="2">{s.L}</text>
                  <text x="60" y="46" fill={isStatus ? "#10b981" : "#e0f2fe"} fontSize="16" fontWeight="800" fontFamily="ui-monospace, monospace" letterSpacing="2">{s.V}</text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

export default NetworkTopologyView;