import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import PermGate from "@/components/PermGate";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Network, 
  Eye, 
  Monitor, 
  Phone, 
  Mail,
  User,
  Copy,
  ExternalLink,
  Shield,
  KeyRound,
  MessageCircle,
  Info,
  Cpu,
  HardDrive,
  Calendar,
  Building2,
  Briefcase,
  BatteryCharging,
  Package,
  Clock,
  Pencil,
} from "lucide-react";

interface UserAssetCardProps {
  asset: Record<string, any> & { id: string };
  index?: number;
  showAntivirus?: boolean;
}

/* ------------------------------------------------------------------ */
/* Global details-dialog store                                        */
/* Keeping the open state outside the card guarantees the full details */
/* view stays open even if the card list re-renders / remounts.        */
/* ------------------------------------------------------------------ */
type AccentType = { from: string; to: string; ring: string; text: string };
let currentDetails: { asset: any; accent: AccentType } | null = null;
const detailsListeners = new Set<() => void>();
const notifyDetails = () => detailsListeners.forEach((l) => l());

export function openAssetDetails(asset: any, accent: AccentType) {
  currentDetails = { asset, accent };
  notifyDetails();
}
export function closeAssetDetails() {
  currentDetails = null;
  notifyDetails();
}

export function AssetDetailsHost() {
  const [state, setState] = useState(currentDetails);
  useEffect(() => {
    const l = () => setState(currentDetails);
    detailsListeners.add(l);
    return () => { detailsListeners.delete(l); };
  }, []);
  if (!state) return null;
  return (
    <AssetDetailsDialog
      asset={state.asset}
      accent={state.accent}
      open
      onOpenChange={(v) => { if (!v) closeAssetDetails(); }}
    />
  );
}

const UserAssetCard = ({ asset, index = 0 }: UserAssetCardProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied!", description: `${label}: ${value}` });
  };

  const handleCopyAndOpen = (type: string, value: string) => {
    navigator.clipboard.writeText(value);
    
    switch (type) {
      case 'ip':
        window.open(`tightvnc://${value}`, '_blank');
        toast({ title: "IP Copied", description: `${value} - TightVNC opening...` });
        break;
      case 'anydesk':
        window.open(`anydesk:${value}`, '_blank');
        toast({ title: "AnyDesk", description: `ID ${value} copied & opening...` });
        break;
      case 'ultraview':
        window.open(`ultraviewer://connect?id=${value}`, '_blank');
        toast({ title: "Ultraview", description: `ID ${value} copied & opening...` });
        break;
      default:
        toast({ title: "Copied", description: value });
    }
  };

  // Palette accents per card (used for the top ribbon + avatar ring)
  const accents = [
    { from: 'from-sky-400', to: 'to-indigo-500', ring: 'ring-sky-400/40', text: 'text-sky-600 dark:text-sky-300', border: 'border-sky-400/70 dark:border-sky-500/60', hoverBorder: 'hover:border-sky-500', hoverShadow: 'hover:shadow-sky-400/30' },
    { from: 'from-violet-400', to: 'to-fuchsia-500', ring: 'ring-violet-400/40', text: 'text-violet-600 dark:text-violet-300', border: 'border-violet-400/70 dark:border-violet-500/60', hoverBorder: 'hover:border-violet-500', hoverShadow: 'hover:shadow-violet-400/30' },
    { from: 'from-emerald-400', to: 'to-teal-500', ring: 'ring-emerald-400/40', text: 'text-emerald-600 dark:text-emerald-300', border: 'border-emerald-400/70 dark:border-emerald-500/60', hoverBorder: 'hover:border-emerald-500', hoverShadow: 'hover:shadow-emerald-400/30' },
    { from: 'from-amber-400', to: 'to-orange-500', ring: 'ring-amber-400/40', text: 'text-amber-600 dark:text-amber-300', border: 'border-amber-400/70 dark:border-amber-500/60', hoverBorder: 'hover:border-amber-500', hoverShadow: 'hover:shadow-amber-400/30' },
    { from: 'from-rose-400', to: 'to-pink-500', ring: 'ring-rose-400/40', text: 'text-rose-600 dark:text-rose-300', border: 'border-rose-400/70 dark:border-rose-500/60', hoverBorder: 'hover:border-rose-500', hoverShadow: 'hover:shadow-rose-400/30' },
    { from: 'from-cyan-400', to: 'to-blue-500', ring: 'ring-cyan-400/40', text: 'text-cyan-600 dark:text-cyan-300', border: 'border-cyan-400/70 dark:border-cyan-500/60', hoverBorder: 'hover:border-cyan-500', hoverShadow: 'hover:shadow-cyan-400/30' },
  ];
  const accent = accents[index % accents.length];
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
  // Open the full profile page instead of a dialog
  const openDetails = () =>
    navigate(`/accessories?profile=${encodeURIComponent(asset.id)}&from=${encodeURIComponent(here)}`);

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(); } }}
      className={`group relative rounded-[22px] border-2 ${accent.border} bg-transparent animate-scale-in cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Ambient outer halo removed */}
    <Card
      className="relative overflow-hidden rounded-[21px] border-0 bg-transparent"
    >
      {/* Dotted grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '14px 14px' }}
      />
      {/* Corner glow blobs removed */}


      <div className="relative p-5 text-foreground">
        {/* PC No / DP-LP No - top right */}
        {(asset.pc_no || asset.dp_lp_no) && (
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1 z-10">
            {asset.pc_no && (
              <div className="px-2 py-1 rounded-md border border-border/70 bg-background/70 backdrop-blur text-right shadow-sm">
                <p className="text-[9px] leading-none text-muted-foreground uppercase tracking-widest font-semibold">PC No</p>
                <p className="font-mono text-xs font-semibold tracking-tight">{asset.pc_no}</p>
              </div>
            )}
            {asset.dp_lp_no && (
              <div className="px-2 py-1 rounded-md border border-border/70 bg-background/70 backdrop-blur text-right shadow-sm">
                <p className="text-[9px] leading-none text-muted-foreground uppercase tracking-widest font-semibold">
                  {asset.device_type?.toLowerCase() === 'laptop' ? 'LP No' : 'DP No'}
                </p>
                <p className="font-mono text-xs font-semibold tracking-tight">{asset.dp_lp_no}</p>
              </div>
            )}
          </div>
        )}

        {/* Header - Avatar & Name */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`relative rounded-2xl p-[2px] bg-gradient-to-br ${accent.from} ${accent.to} shadow-lg group-hover:scale-105 transition-transform duration-300`}>
            <Avatar className="w-14 h-14 rounded-[14px] ring-2 ring-background">
              <AvatarImage src={asset.photo} alt={asset.employee_name} />
              <AvatarFallback className={`bg-background text-lg font-bold rounded-[14px] ${accent.text}`}>
                {asset.employee_name?.charAt(0)?.toUpperCase() || <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight tracking-tight truncate">
              {asset.employee_name || 'Unknown User'}
            </h3>
            <p className="text-[13px] text-muted-foreground truncate">{asset.designation || 'N/A'}</p>
            {asset.division && (
              <Badge variant="secondary" className="mt-1.5 text-[10px] rounded-full px-2 font-medium">
                {asset.division}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Actions - IP, AnyDesk, Ultraview */}
        <div className="space-y-2 mb-4">
          {/* IP Address - Primary Action */}
          {asset.ip_no && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyAndOpen('ip', asset.ip_no!); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/70 bg-background/40 hover:bg-background/80 hover:border-emerald-400/60 hover:shadow-sm transition-all duration-300 group/btn"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400/20 to-teal-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-400/30">
                  <Network className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">IP Address</p>
                  <p className="font-mono font-semibold text-sm tracking-tight">{asset.ip_no}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover/btn:opacity-100 transition-opacity text-muted-foreground">
                <Copy className="h-3.5 w-3.5" />
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </button>
          )}

          {/* Remote Access Tools Row */}
          <div className="flex gap-2">
            {/* AnyDesk */}
            {asset.anydesk_id && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyAndOpen('anydesk', asset.anydesk_id!); }}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/70 bg-background/40 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400/60 text-red-600 dark:text-red-400 transition-all duration-300"
              >
                <Monitor className="h-4 w-4 flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">AnyDesk</p>
                  <p className="font-mono text-xs font-semibold truncate">{asset.anydesk_id}</p>
                </div>
              </button>
            )}

            {/* Ultraview */}
            {asset.ultraview_id && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyAndOpen('ultraview', asset.ultraview_id!); }}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-border/70 bg-background/40 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-400/60 text-purple-600 dark:text-purple-400 transition-all duration-300"
              >
                <Eye className="h-4 w-4 flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Ultraview</p>
                  <p className="font-mono text-xs font-semibold truncate">{asset.ultraview_id}</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Contact Info - Click to copy, then action */}
        <div className="flex flex-wrap gap-1.5">
          {(asset.mobile || asset.phone_no) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const phone = asset.mobile || asset.phone_no;
                handleCopy(phone!, 'Phone');
                setTimeout(() => {
                  window.location.href = `tel:${phone}`;
                }, 300);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all border border-border/70 bg-background/40 hover:bg-background/80 hover:border-primary/50 group/phone"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{asset.mobile || asset.phone_no}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy((asset.mobile || asset.phone_no)!, 'Phone');
                }}
                className="inline-flex opacity-0 group-hover/phone:opacity-100 transition-opacity text-muted-foreground"
              >
                <Copy className="h-3 w-3" />
              </span>
              <span
                role="button"
                tabIndex={0}
                title="Open in WhatsApp"
                onClick={(e) => {
                  e.stopPropagation();
                  const raw = (asset.mobile || asset.phone_no)!;
                  let digits = raw.replace(/\D/g, '');
                  if (digits.startsWith('0')) digits = '88' + digits.slice(1);
                  else if (!digits.startsWith('88')) digits = '88' + digits;
                  window.open(`https://wa.me/${digits}`, '_blank');
                }}
                className="inline-flex items-center justify-center h-5 w-5 ml-0.5 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 hover:from-green-500 hover:to-emerald-700 text-white shadow-sm ring-1 ring-emerald-400/40"
              >
                <MessageCircle className="h-3 w-3" />
              </span>
            </button>
          )}

          {asset.email && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(asset.email!, 'Email');
                setTimeout(() => {
                  const emailUrl = asset.email?.includes('gmail') 
                    ? `https://mail.google.com/mail/?view=cm&to=${asset.email}` 
                    : `mailto:${asset.email}`;
                  window.open(emailUrl, '_blank');
                }, 300);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all border border-border/70 bg-background/40 hover:bg-background/80 hover:border-primary/50 max-w-full group/email"
            >
              <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{asset.email}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(asset.email!, 'Email');
                }}
                className="inline-flex opacity-0 group-hover/email:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground"
              >
                <Copy className="h-3 w-3" />
              </span>
            </button>
          )}

          {asset.email_password && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(asset.email_password!, 'Email Password');
              }}
              title="Click to copy email password"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all border border-border/70 bg-background/40 hover:bg-background/80 hover:border-primary/50 text-primary max-w-full group/emailpw"
            >
              <KeyRound className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-mono truncate">{asset.email_password}</span>
              <Copy className="h-3 w-3 opacity-0 group-hover/emailpw:opacity-100 transition-opacity flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Antivirus Key - click to copy */}
        {asset.antivirus_code && (
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(asset.antivirus_code!, 'Antivirus Key'); }}
            className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/70 bg-gradient-to-r from-emerald-400/5 to-teal-500/5 hover:from-emerald-400/15 hover:to-teal-500/15 hover:border-emerald-400/60 text-emerald-700 dark:text-emerald-300 transition-all group/av"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 ring-1 ring-emerald-400/30">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-widest">Antivirus Key</p>
                <p className="font-mono text-xs font-semibold truncate">{asset.antivirus_code}</p>
              </div>
            </div>
            <Copy className="h-3.5 w-3.5 opacity-0 group-hover/av:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        )}
      </div>
    </Card>
    </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Full asset details dialog                                          */
/* ------------------------------------------------------------------ */

function Field({ icon: Icon, label, value, mono }: { icon?: any; label: string; value?: any; mono?: boolean }) {
  const v = value === 0 || value === false ? String(value) : (value || '');
  if (!v && v !== '0') return null;
  return (
    <div className="group/f flex items-start gap-2.5 rounded-xl border border-border/50 bg-gradient-to-br from-background/60 to-background/20 hover:from-background hover:to-background/60 hover:border-primary/40 hover:shadow-sm px-3 py-2 transition-all">
      {Icon && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 ring-1 ring-primary/20">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</p>
        <p className={`text-sm break-words font-medium ${mono ? 'font-mono' : ''}`}>{v}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : [children];
  const hasContent = arr.some((c) => c);
  if (!hasContent) return null;
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/20">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/80">{title}</h4>
        <div className="flex-1 h-px bg-gradient-to-r from-border/70 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function AssetDetailsDialog({
  asset,
  open,
  onOpenChange,
  accent,
}: {
  asset: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accent: { from: string; to: string; ring: string; text: string };
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const purchase = asset.purchase_date ? new Date(asset.purchase_date) : null;
  const usageYears = purchase
    ? Math.max(0, ((Date.now() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 365.25))).toFixed(1)
    : '';

  // Battery indicator only if numeric
  const batteryRaw = asset.battery_health ?? asset.battery ?? '';
  const batteryNum = typeof batteryRaw === 'number'
    ? batteryRaw
    : (typeof batteryRaw === 'string' && /^\d+/.test(batteryRaw) ? parseInt(batteryRaw, 10) : null);

  const accessories: any[] = Array.isArray(asset.accessories)
    ? asset.accessories
    : Array.isArray(asset.accessory_history) ? asset.accessory_history : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] p-0 overflow-hidden rounded-2xl border-2 border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)] [&>button.absolute]:opacity-100 [&>button.absolute]:bg-primary [&>button.absolute]:text-primary-foreground [&>button.absolute]:rounded-full [&>button.absolute]:p-1.5 [&>button.absolute]:ring-2 [&>button.absolute]:ring-primary/40 [&>button.absolute]:shadow-lg [&>button.absolute]:hover:scale-110 [&>button.absolute]:transition-transform">
        {/* Header (transparent, bordered) */}
        <div className="relative bg-transparent px-4 sm:px-6 pt-6 pb-5 border-b-2 border-primary/40">
          <DialogHeader className="relative">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-left">
              <div className={`relative rounded-2xl p-[3px] bg-gradient-to-br ${accent.from} ${accent.to} shadow-lg`}>
                <Avatar className="w-16 h-16 rounded-[14px] ring-2 ring-background">
                  <AvatarImage src={asset.photo || asset.picture} alt={asset.employee_name} />
                  <AvatarFallback className="rounded-[14px] bg-muted text-foreground font-bold text-xl">
                    {asset.employee_name?.charAt(0)?.toUpperCase() || <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground truncate">
                  {asset.employee_name || 'Unknown User'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground truncate">
                  {[asset.designation, asset.division].filter(Boolean).join(' • ') || 'IT Asset'}
                </DialogDescription>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {asset.device_type && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-primary/30">
                      <Monitor className="h-3 w-3" /> {asset.device_type}
                    </span>
                  )}
                  {asset.pc_no && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-mono font-semibold ring-1 ring-primary/30">
                      PC {asset.pc_no}
                    </span>
                  )}
                  {asset.ip_no && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-mono font-semibold ring-1 ring-primary/30">
                      <Network className="h-3 w-3" /> {asset.ip_no}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap gap-2">
            <PermGate action="edit" path="/accessories">
              <Button
                size="sm"
                className="w-full sm:w-auto gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  const from = encodeURIComponent(location.pathname + location.search);
                  navigate(`/accessories?edit=${encodeURIComponent(asset.id)}&from=${from}`);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Asset
              </Button>
            </PermGate>
          </div>
        </div>

        {/* Card floating over gradient */}
        <div className="relative mx-3 sm:mx-4 mt-3 rounded-2xl bg-background border border-border/60">

        <ScrollArea className="max-h-[70vh]">
          <div className="p-4 sm:p-5 space-y-4">
            <Section title="Employee" icon={User}>
              <Field icon={User} label="Name" value={asset.employee_name} />
              <Field icon={Briefcase} label="Designation" value={asset.designation} />
              <Field icon={Building2} label="Unit / Office" value={asset.unit_office || asset.unit} />
              <Field icon={Building2} label="Department" value={asset.division || asset.department} />
              <Field icon={Phone} label="Mobile" value={asset.mobile} />
              <Field icon={Phone} label="Phone" value={asset.phone_no} />
              <Field icon={Phone} label="IP Phone" value={asset.ip_phone} />
              <Field icon={Mail} label="Email" value={asset.email} />
              <Field icon={KeyRound} label="Email Password" value={asset.email_password} mono />
            </Section>

            <Section title="Device" icon={Monitor}>
              <Field icon={Monitor} label="Device Type" value={asset.device_type} />
              <Field icon={HardDrive} label="PC No" value={asset.pc_no} mono />
              <Field icon={HardDrive} label="DP / LP No" value={asset.dp_lp_no} mono />
              <Field icon={HardDrive} label="Serial No" value={asset.sl_no || asset.serial_no} mono />
              <Field icon={Cpu} label="Processor" value={asset.processor} />
              <Field icon={Cpu} label="RAM" value={asset.ram} />
              <Field icon={HardDrive} label="Storage" value={asset.storage || asset.hdd || asset.ssd} />
              <Field icon={Monitor} label="Windows / OS" value={asset.windows_version || asset.os} />
              <Field icon={Cpu} label="Specification" value={asset.specification} />
              <Field icon={HardDrive} label="MAC Address" value={asset.mac_address} mono />
            </Section>

            <Section title="Network & Remote" icon={Network}>
              <Field icon={Network} label="IP Address" value={asset.ip_no} mono />
              <Field icon={Monitor} label="AnyDesk ID" value={asset.anydesk_id} mono />
              <Field icon={Eye} label="Ultraviewer ID" value={asset.ultraview_id} mono />
            </Section>

            <Section title="Security & Antivirus" icon={Shield}>
              <Field icon={Shield} label="Antivirus Code" value={asset.antivirus_code} mono />
              <Field icon={Calendar} label="Antivirus Validity" value={asset.antivirus_validity} />
            </Section>

            {(batteryNum !== null || asset.battery_health || asset.battery) && (
              <Section title="Battery Health" icon={BatteryCharging}>
                {batteryNum !== null ? (
                  <div className="sm:col-span-2 rounded-xl border border-border/60 bg-gradient-to-br from-background to-background/40 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        <BatteryCharging className="h-3.5 w-3.5" /> Battery
                      </div>
                      <span className={`text-base font-bold ${batteryNum > 70 ? 'text-emerald-600' : batteryNum > 30 ? 'text-amber-600' : 'text-rose-600'}`}>{batteryNum}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          batteryNum > 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : batteryNum > 30 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'
                        }`}
                        style={{ width: `${Math.min(100, batteryNum)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <Field icon={BatteryCharging} label="Battery" value={asset.battery_health || asset.battery} />
                )}
              </Section>
            )}

            <Section title="Usage & Purchase" icon={Calendar}>
              <Field icon={Calendar} label="Purchase Date" value={purchase ? purchase.toLocaleDateString() : ''} />
              <Field icon={Clock} label="Usage" value={usageYears ? `${usageYears} years` : asset.usage_years} />
              <Field icon={Calendar} label="Warranty" value={asset.warranty || asset.warranty_expiry} />
              <Field icon={HardDrive} label="Printer" value={asset.printer} />
              <Field icon={HardDrive} label="Scanner" value={asset.scanner} />
              <Field icon={HardDrive} label="UPS" value={asset.ups} />
            </Section>

            {accessories.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-4 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/20">
                    <Package className="h-4 w-4" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-[0.15em] text-foreground/80">Accessory History</h4>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/70 to-transparent" />
                </div>
                <div className="space-y-1.5">
                  {accessories.map((a: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-border/50 bg-background/60 hover:border-primary/40 hover:bg-background transition-colors px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="truncate font-medium">
                          {a.name || a.title || a.item || a.type || 'Accessory'}
                        </span>
                        {a.serial_no && (
                          <span className="text-xs font-mono text-muted-foreground truncate">
                            {a.serial_no}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {a.date || a.assigned_date || a.given_date || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {asset.remarks && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Remarks</p>
                <p className="text-sm whitespace-pre-wrap">{asset.remarks}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        </div>
        <div className="h-4" />
      </DialogContent>
    </Dialog>
  );
}

export default UserAssetCard;
