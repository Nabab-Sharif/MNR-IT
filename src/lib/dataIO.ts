import { supabase } from "@/integrations/supabase/client";
import indexedDB from "@/services/indexedDBService";
import type { DataSource } from "./pageDataRegistry";

export async function readSource(src: DataSource): Promise<any[]> {
  if (src.kind === "cloud") {
    const { data, error } = await supabase.from(src.store as any).select("*");
    if (error) throw error;
    return data || [];
  }
  return await indexedDB.getAll(src.store);
}

export async function writeSource(src: DataSource, items: any[], mode: "merge" | "replace"): Promise<number> {
  if (!Array.isArray(items)) throw new Error("Import file must be an array");
  if (src.kind === "cloud") {
    if (mode === "replace") {
      const { error: delErr } = await supabase.from(src.store as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
    }
    let count = 0;
    for (const raw of items) {
      const { created_at: _c, updated_at: _u, ...rest } = raw || {};
      const clean: any = {};
      for (const [k, v] of Object.entries(rest)) if (v !== "" && v !== undefined) clean[k] = v;
      const hasValidId = clean.id && /^[0-9a-f-]{36}$/i.test(String(clean.id));
      if (!hasValidId) delete clean.id;
      const { error } = await supabase.from(src.store as any).upsert(clean);
      if (!error) count++;
    }
    return count;
  }
  if (mode === "replace") {
    await indexedDB.clear(src.store);
  }
  const withIds = items.map((it) => ({ ...it, id: it?.id || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }));
  await indexedDB.bulkPut(src.store, withIds);
  return withIds.length;
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function pickJSONFile(): Promise<any | null> {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json,.json";
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => {
        try { resolve(JSON.parse(String(r.result || "null"))); }
        catch { resolve(null); }
      };
      r.readAsText(f);
    };
    inp.click();
  });
}