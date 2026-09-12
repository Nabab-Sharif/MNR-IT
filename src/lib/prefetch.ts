// Warms up common data sources in the background so navigation between
// pages feels instant instead of showing a loading state on every visit.
import indexedDB from "@/services/indexedDBService";
import { supabase } from "@/integrations/supabase/client";

const LOCAL_STORES = [
  "units", "departments", "it_assets", "accessories", "products",
  "ip_phones", "nvrs", "cctv_cameras", "cctv_checklists",
];
const CLOUD_TABLES = [
  "ip_addresses", "printers", "wifi_networks",
  "sticker_buyers", "sticker_transactions",
];

let started = false;
export function prefetchAll() {
  if (started) return;
  started = true;
  // Fire and forget – warms browser/IDB/HTTP caches so subsequent
  // page components load their data from a hot cache.
  (async () => {
    try { await indexedDB.initDB(); } catch { /* noop */ }
    LOCAL_STORES.forEach((s) => { indexedDB.getAll(s).catch(() => {}); });
    // Cloud rows go through dbService so they land in the Redux cache and the
    // localStorage snapshot — pages then render them without a network wait.
    const { default: dbService } = await import("@/services/dbService");
    const cloudLoaders: Record<string, () => Promise<any>> = {
      ip_addresses: () => dbService.getIPAddresses(),
      printers: () => dbService.getPrinters(),
      wifi_networks: () => dbService.getWifiNetworks(),
    };
    CLOUD_TABLES.forEach((t) => {
      const fn = cloudLoaders[t];
      if (fn) fn().catch(() => {});
      else supabase.from(t as any).select("*").then(() => {}, () => {});
    });
  })();
}

// Note: do NOT auto-run on import. Prefetch is triggered after the user is
// authenticated so the login page loads instantly.