// Registry mapping each route to the data source(s) available for
// per-page Export / Import JSON.
export type DataSource = {
  kind: "local" | "cloud";     // local = IndexedDB, cloud = Supabase table
  store: string;               // IndexedDB store name or Supabase table
  label: string;               // Human label for the source
};

export type PageData = { title: string; sources: DataSource[] };

export const PAGE_DATA: Record<string, PageData> = {
  "/": {
    title: "Units / Offices",
    sources: [{ kind: "local", store: "units", label: "Units / Offices" }],
  },
  "/departments": {
    title: "Departments",
    sources: [{ kind: "local", store: "departments", label: "Departments" }],
  },
  "/user-profiles": {
    title: "IT Assets",
    sources: [{ kind: "local", store: "it_assets", label: "IT Assets" }],
  },
  "/accessories": {
    title: "Accessories",
    sources: [{ kind: "local", store: "accessories", label: "Accessories" }],
  },
  "/products": {
    title: "Products",
    sources: [{ kind: "local", store: "products", label: "Products" }],
  },
  "/ip-addresses": {
    title: "IP Addresses",
    sources: [{ kind: "cloud", store: "ip_addresses", label: "IP Addresses" }],
  },
  "/printers": {
    title: "Printers",
    sources: [{ kind: "cloud", store: "printers", label: "Printers" }],
  },
  "/wifi-list": {
    title: "WiFi List",
    sources: [{ kind: "cloud", store: "wifi_networks", label: "WiFi Networks" }],
  },
  "/ip-phones": {
    title: "IP Phones",
    sources: [{ kind: "local", store: "ip_phones", label: "IP Phones" }],
  },
  "/cctv-list": {
    title: "CCTV List",
    sources: [
      { kind: "local", store: "nvrs", label: "NVRs (with cameras)" },
      { kind: "local", store: "cctv_cameras", label: "Standalone Cameras" },
    ],
  },
  "/cctv-checklist": {
    title: "CCTV Checklist",
    sources: [{ kind: "local", store: "cctv_checklists", label: "Daily Checklists" }],
  },
  "/switch-mapping": {
    title: "Switch Mapping",
    sources: [
      { kind: "local", store: "switches", label: "Switches" },
      { kind: "local", store: "switch_ports", label: "Ports" },
      { kind: "local", store: "switch_locations", label: "Locations" },
      { kind: "local", store: "switch_gates", label: "Gates" },
    ],
  },
  "/sticker-printer": {
    title: "Sticker Printer",
    sources: [
      { kind: "cloud", store: "sticker_buyers", label: "Buyers" },
      { kind: "cloud", store: "sticker_transactions", label: "Transactions" },
    ],
  },
};

export const ALL_SOURCES: DataSource[] = Object.values(PAGE_DATA)
  .flatMap((p) => p.sources)
  .filter((s, i, arr) => arr.findIndex((x) => x.store === s.store && x.kind === s.kind) === i);

export function pageDataForRoute(pathname: string): PageData | null {
  if (PAGE_DATA[pathname]) return PAGE_DATA[pathname];
  const key = Object.keys(PAGE_DATA).find((k) => k !== "/" && pathname.startsWith(k));
  return key ? PAGE_DATA[key] : null;
}