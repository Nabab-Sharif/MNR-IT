// Maps IndexedDB store names / Supabase table names to human-readable entity labels
// used in the Live Activity notification feed.
export const ENTITY_LABELS: Record<string, string> = {
  users: "User",
  departments: "Department",
  accessories: "Accessory",
  it_assets: "IT Asset",
  units: "Unit / Office",
  products: "Product",
  user_activities: "User Activity",
  schedules: "Schedule",
  printers: "Printer",
  ip_phones: "IP Phone",
  wifi_networks: "WiFi Network",
  ip_addresses: "IP Address",
  cctv_cameras: "CCTV Camera",
  cctv_nvrs: "CCTV NVR",
  cctv_checklists: "CCTV Checklist",
  buyers: "Sticker Buyer",
  sticker_buyers: "Sticker Buyer",
  buyer_transactions: "Sticker Transaction",
  sticker_transactions: "Sticker Transaction",
};

export function entityLabel(store: string): string {
  return ENTITY_LABELS[store] || store;
}