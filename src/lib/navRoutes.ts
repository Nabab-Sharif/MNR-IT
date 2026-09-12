import {
  Home, Building2, Monitor, Package, Printer, Phone, Wifi, Network,
  Camera, ClipboardCheck, Settings, Cable, Sticker, Scissors, Shield,
  Trophy, DoorOpen, MessageSquareWarning, Warehouse, Server,
  type LucideIcon,
} from "lucide-react";

export type NavRoute = { path: string; label: string; icon: LucideIcon; external?: boolean };

export const NAV_ROUTES: NavRoute[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/departments", label: "Units/Offices", icon: Building2 },
  { path: "/accessories", label: "IT Assets", icon: Monitor },
  { path: "/wifi-list", label: "WiFi List", icon: Wifi },
  { path: "/printers", label: "Printers", icon: Printer },
  { path: "/ip-addresses", label: "IP Address", icon: Network },
  { path: "/sticker-printer", label: "Sticker Printer", icon: Sticker },
  { path: "/sticker-printer/crop", label: "Crop", icon: Scissors },
  { path: "/ip-phones", label: "IP Phones", icon: Phone },
  { path: "/cctv-checklist", label: "CCTV Check List", icon: ClipboardCheck },
  { path: "https://mnritasset.netlify.app", label: "Product Tracking", icon: Package, external: true },
  { path: "https://mnrambt.netlify.app", label: "Badminton", icon: Trophy, external: true },
  { path: "https://mnrep.netlify.app", label: "Gate Entry/Pass", icon: DoorOpen, external: true },
  { path: "https://mnrcomplaint.netlify.app", label: "Complaint", icon: MessageSquareWarning, external: true },
  { path: "https://mnrwh.netlify.app", label: "Warehouse", icon: Warehouse, external: true },
  { path: "/super-admin", label: "Super Admin", icon: Shield },
];