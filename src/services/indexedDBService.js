// IndexedDB Service for MNR IT Management System
// Provides persistent storage with better capacity than localStorage
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { entityLabel } from "@/lib/entityLabels";

// In-memory getAll cache — makes navigation instant by returning last-known
// data immediately and refreshing in the background (stale-while-revalidate).
const _getAllCache = new Map();     // storeName -> array
const _getAllInflight = new Map();  // storeName -> Promise
export function invalidateGetAll(storeName) {
  if (storeName) {
    _getAllCache.delete(storeName);
    try { localStorage.removeItem("mnr_snap_" + storeName); } catch {}
  } else {
    _getAllCache.clear();
  }
}

// Persistent snapshot cache (localStorage) so a hard refresh renders the
// last-known cloud data instantly while fresh rows load in the background.
const SNAP_PREFIX = "mnr_snap_";
const MAX_SNAP_BYTES = 1.5 * 1024 * 1024;
function saveSnapshot(storeName, rows) {
  try {
    const json = JSON.stringify(rows);
    if (json.length > MAX_SNAP_BYTES) return;
    localStorage.setItem(SNAP_PREFIX + storeName, json);
  } catch { /* quota — ignore */ }
}
function primeSnapshots() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SNAP_PREFIX)) continue;
      const rows = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(rows)) _getAllCache.set(key.slice(SNAP_PREFIX.length), rows);
    }
  } catch { /* ignore */ }
}
primeSnapshots();

// Synchronous read of every cached collection — used to hydrate the Redux
// store before first paint so pages render with data instantly.
export function readSnapshots() {
  const out = {};
  _getAllCache.forEach((rows, storeName) => { out[storeName] = rows; });
  return out;
}

// Fire-and-forget notification logging for the super admin live feed.
function fireLog(storeName, action, record) {
  try {
    let act = action;
    let entity = entityLabel(storeName);
    let entity_id = (record && (record.id || record.name)) || null;
    let description = null;

    // Sticker roll/pcs receive & issue transactions live in one store — split by type.
    if (storeName === "buyer_transactions" || storeName === "sticker_transactions") {
      const t = record && record.type;
      if (t && t.endsWith("_issue")) act = "issue";
      else if (t && t.endsWith("_receive")) act = "receive";
      const qty = record && (record.roll || record.pcs);
      const unit = record && record.roll ? "roll" : record && record.pcs ? "pcs" : "";
      const kind = t ? t.replace(/_(issue|receive)$/, "") : "sticker";
      description = `${kind} ${act}${qty ? ` — ${qty} ${unit}` : ""}`;
      entity = "Sticker";
    }

    logActivity({ action: act, entity, entity_id: entity_id ? String(entity_id) : null, description });
  } catch { /* never break UX */ }
}

// Stores that live in Supabase (cloud) instead of IndexedDB.
// Maps local storeName -> supabase table name.
const CLOUD_STORES = {
  buyers: "sticker_buyers",
  buyer_transactions: "sticker_transactions",
  units: "units_cloud",
  departments: "departments_cloud",
  it_assets: "it_assets_cloud",
  accessories: "accessories_cloud",
  switches: "switches_cloud",
  switch_ports: "switch_ports_cloud",
  switch_locations: "switch_locations_cloud",
  switch_gates: "switch_gates_cloud",
};

const isCloud = (storeName) => Object.prototype.hasOwnProperty.call(CLOUD_STORES, storeName);
const cloudTable = (storeName) => CLOUD_STORES[storeName];

// Tables that store payload in a single `data` jsonb column (flexible-schema stores).
const JSONB_STORES = new Set([
  "units", "departments", "it_assets", "accessories",
  "switches", "switch_ports", "switch_locations", "switch_gates",
]);
const isJsonb = (storeName) => JSONB_STORES.has(storeName);
const flattenRow = (r) => ({ id: r.id, created_at: r.created_at, updated_at: r.updated_at, ...(r.data || {}) });
const splitRow = (data) => {
  const { id, created_at: _c, updated_at: _u, ...rest } = data || {};
  return { id, payload: stripEmpty(rest) };
};

function stripEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === "" || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

class IndexedDBService {
  constructor() {
    this.dbName = 'mnr_it_management';
    this.version = 9;
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('departments')) {
          db.createObjectStore('departments', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('accessories')) {
          db.createObjectStore('accessories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('it_assets')) {
          db.createObjectStore('it_assets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('units')) {
          db.createObjectStore('units', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('products')) {
          db.createObjectStore('products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('user_activities')) {
          db.createObjectStore('user_activities', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('schedules')) {
          db.createObjectStore('schedules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('printers')) {
          db.createObjectStore('printers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ip_phones')) {
          db.createObjectStore('ip_phones', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('wifi_networks')) {
          db.createObjectStore('wifi_networks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ip_addresses')) {
          db.createObjectStore('ip_addresses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cctv_cameras')) {
          db.createObjectStore('cctv_cameras', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('nvrs')) {
          db.createObjectStore('nvrs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cctv_checklists')) {
          db.createObjectStore('cctv_checklists', { keyPath: 'id' });
        }
        // Switch Port Mapping stores
        if (!db.objectStoreNames.contains('switches')) {
          db.createObjectStore('switches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('switch_ports')) {
          db.createObjectStore('switch_ports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('switch_locations')) {
          db.createObjectStore('switch_locations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('switch_gates')) {
          db.createObjectStore('switch_gates', { keyPath: 'id' });
        }
        // Server Racks (Main + Sub floor racks)
        if (!db.objectStoreNames.contains('racks')) {
          db.createObjectStore('racks', { keyPath: 'id' });
        }
        // Sticker Printer - Buyers
        if (!db.objectStoreNames.contains('buyers')) {
          db.createObjectStore('buyers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('buyer_transactions')) {
          db.createObjectStore('buyer_transactions', { keyPath: 'id' });
        }
        // Crop tool - persistent PDF/image batches
        if (!db.objectStoreNames.contains('crop_batches')) {
          db.createObjectStore('crop_batches', { keyPath: 'id' });
        }
      };
    });
  }

  async ensureDB() {
    if (!this.db) {
      await this.initDB();
    }
    return this.db;
  }

  close() {
    try {
      if (this.db) {
        this.db.close();
      }
    } finally {
      this.db = null;
    }
  }

  async deleteDatabase() {
    // Close any open connection before deleting
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        // If another tab holds the connection, deletion will be blocked
        reject(new Error('Database deletion blocked: please close other tabs using this app and try again.'));
      };
    });
  }

  async getAll(storeName) {
    const fetchFresh = async () => {
      if (isCloud(storeName)) {
        const { data, error } = await supabase.from(cloudTable(storeName)).select("*").order("created_at", { ascending: true });
        if (error) throw error;
        const rows = (data || []).map(r => isJsonb(storeName) ? flattenRow(r) : r);
        saveSnapshot(storeName, rows);
        return rows;
      }
      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    };

    // Stale-while-revalidate: return cached copy immediately, refresh in background.
    if (_getAllCache.has(storeName)) {
      if (!_getAllInflight.has(storeName)) {
        const p = fetchFresh()
          .then((fresh) => {
            _getAllCache.set(storeName, fresh);
            // Send the fresh rows with the event. Consumers can update their
            // state directly instead of calling getAll() again and creating a
            // refresh -> event -> refresh loop.
            try { window.dispatchEvent(new CustomEvent("mnr-data-refreshed", { detail: { storeName, rows: fresh } })); } catch {}
            return fresh;
          })
          .catch(() => _getAllCache.get(storeName))
          .finally(() => _getAllInflight.delete(storeName));
        _getAllInflight.set(storeName, p);
      }
      return _getAllCache.get(storeName);
    }

    // First call — dedupe concurrent fetches.
    if (_getAllInflight.has(storeName)) return _getAllInflight.get(storeName);
    const p = fetchFresh()
      .then((fresh) => { _getAllCache.set(storeName, fresh); return fresh; })
      .finally(() => _getAllInflight.delete(storeName));
    _getAllInflight.set(storeName, p);
    return p;
  }

  async get(storeName, id) {
    if (isCloud(storeName)) {
      const { data, error } = await supabase.from(cloudTable(storeName)).select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return undefined;
      return isJsonb(storeName) ? flattenRow(data) : data;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async add(storeName, data) {
    invalidateGetAll(storeName);
    if (isCloud(storeName)) {
      if (isJsonb(storeName)) {
        const { id, payload } = splitRow(data);
        const row = id ? { id, data: payload } : { data: payload };
        const { data: inserted, error } = await supabase.from(cloudTable(storeName)).insert(row).select().single();
        if (error) throw error;
        const out = flattenRow(inserted);
        fireLog(storeName, "add", out);
        return out;
      }
      const { id: _drop, created_at: _c, updated_at: _u, ...rest } = data || {};
      const payload = stripEmpty(rest);
      const { data: inserted, error } = await supabase.from(cloudTable(storeName)).insert(payload).select().single();
      if (error) throw error;
      fireLog(storeName, "add", inserted);
      return inserted;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => { fireLog(storeName, "add", data); resolve(data); };
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    invalidateGetAll(storeName);
    if (isCloud(storeName)) {
      if (isJsonb(storeName)) {
        const { id, payload } = splitRow(data);
        if (!id) throw new Error("put requires id for cloud store " + storeName);
        // Upsert so client-generated ids (existing local records) work on first save.
        const { data: updated, error } = await supabase
          .from(cloudTable(storeName))
          .upsert({ id, data: payload }, { onConflict: "id" })
          .select().single();
        if (error) throw error;
        const out = flattenRow(updated);
        fireLog(storeName, "edit", out);
        return out;
      }
      const { id, created_at: _c, updated_at: _u, ...rest } = data || {};
      if (!id) throw new Error("put requires id for cloud store " + storeName);
      const payload = stripEmpty(rest);
      const { data: updated, error } = await supabase.from(cloudTable(storeName)).update(payload).eq("id", id).select().single();
      if (error) throw error;
      fireLog(storeName, "edit", updated);
      return updated;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => { fireLog(storeName, "edit", data); resolve(data); };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, id) {
    invalidateGetAll(storeName);
    if (isCloud(storeName)) {
      const { error } = await supabase.from(cloudTable(storeName)).delete().eq("id", id);
      if (error) throw error;
      fireLog(storeName, "delete", { id });
      return true;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => { fireLog(storeName, "delete", { id }); resolve(true); };
      request.onerror = () => reject(request.error);
    });
  }

  async bulkDelete(storeName, ids) {
    invalidateGetAll(storeName);
    const cleanIds = (ids || []).filter((id) => id !== undefined && id !== null);
    if (cleanIds.length === 0) return true;
    if (isCloud(storeName)) {
      const { error } = await supabase.from(cloudTable(storeName)).delete().in("id", cleanIds);
      if (error) throw error;
      return true;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      cleanIds.forEach((id) => store.delete(id));
    });
  }

  async clear(storeName) {
    invalidateGetAll(storeName);
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async bulkPut(storeName, items) {
    invalidateGetAll(storeName);
    if (isCloud(storeName)) {
      for (const it of items) {
        try { await this.put(storeName, it); } catch { try { await this.add(storeName, it); } catch {} }
      }
      return true;
    }
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      let completed = 0;
      const total = items.length;

      items.forEach(item => {
        const request = store.put(item);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve(true);
          }
        };
        request.onerror = () => reject(request.error);
      });

      if (total === 0) resolve(true);
    });
  }

  // Migrate data from localStorage to IndexedDB
  async migrateFromLocalStorage() {
    const stores = [
      { name: 'users', key: 'mnr_users' },
      { name: 'departments', key: 'mnr_departments' },
      { name: 'accessories', key: 'mnr_accessories' },
      { name: 'it_assets', key: 'mnr_it_assets' },
      { name: 'units', key: 'mnr_units' },
      { name: 'products', key: 'mnr_products' },
      { name: 'user_activities', key: 'mnr_user_activities' },
      { name: 'schedules', key: 'mnr_schedules' }
    ];

    for (const store of stores) {
      const localData = localStorage.getItem(store.key);
      if (localData) {
        try {
          const data = JSON.parse(localData);
          if (Array.isArray(data) && data.length > 0) {
            await this.bulkPut(store.name, data);
          }
        } catch (error) {
          console.error(`Failed to migrate ${store.name}:`, error);
        }
      }
    }
  }
}

export default new IndexedDBService();
