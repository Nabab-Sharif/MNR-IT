import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORES: Record<string, string> = {
  units: "units_cloud",
  departments: "departments_cloud",
  it_assets: "it_assets_cloud",
  accessories: "accessories_cloud",
  products: "products_cloud",
};

function readAllLocal(storeName: string): Promise<any[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open("mnr_it_management");
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const g = store.getAll();
        g.onsuccess = () => { db.close(); resolve(g.result || []); };
        g.onerror = () => { db.close(); resolve([]); };
      } catch { db.close(); resolve([]); }
    };
  });
}

export default function LocalToCloudMigrationButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!confirm("Upload all local Units, Departments, IT Assets, Accessories, and Products to the cloud? Existing cloud rows with the same ID will be overwritten.")) return;
    setBusy(true);
    let total = 0;
    try {
      for (const [local, table] of Object.entries(STORES)) {
        const items = await readAllLocal(local);
        if (!items.length) continue;
        const rows = items.map((it: any) => {
          const { id, created_at, updated_at, ...rest } = it;
          return { id: id != null ? String(id) : crypto.randomUUID(), data: rest };
        });
        // upsert in chunks of 200
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabase.from(table as any).upsert(chunk, { onConflict: "id" });
          if (error) throw new Error(`${table}: ${error.message}`);
          total += chunk.length;
        }
        toast.success(`${local}: uploaded ${items.length}`);
      }
      toast.success(`Done. Uploaded ${total} records to cloud.`);
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally { setBusy(false); }
  };
  return (
    <Button onClick={run} disabled={busy} variant="outline">
      {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CloudUpload className="w-4 h-4 mr-1.5 text-sky-600" />}
      Upload Local Data to Cloud
    </Button>
  );
}
