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
    CLOUD_TABLES.forEach((t) => { supabase.from(t as any).select("*").then(() => {}, () => {}); });
    // Also prime the in-memory getAll cache for cloud stores so pages get
    // instant data from the shared cache instead of a fresh network roundtrip.
    CLOUD_TABLES.forEach((t) => { indexedDB.getAll(t).catch(() => {}); });
  })();
}

// Note: do NOT auto-run on import. Prefetch is triggered after the user is
// authenticated so the login page loads instantly.