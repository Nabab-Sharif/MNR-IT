// Generic cloud-backed keyed store. All app collections live in one table
// (public.app_data) with realtime enabled. Use this when you want realtime
// sync across devices. Existing IndexedDB code keeps working for local-only.
import { supabase } from "@/integrations/supabase/client";

export type CloudRow<T = any> = { collection: string; id: string; data: T; updated_at: string };

export const cloudStore = {
  async list<T = any>(collection: string): Promise<T[]> {
    const { data, error } = await supabase.from("app_data").select("id,data").eq("collection", collection);
    if (error) throw error;
    return (data || []).map((r: any) => ({ id: r.id, ...(r.data || {}) })) as T[];
  },
  async get<T = any>(collection: string, id: string): Promise<T | null> {
    const { data } = await supabase.from("app_data").select("data").eq("collection", collection).eq("id", id).maybeSingle();
    return data ? ({ id, ...(data as any).data } as T) : null;
  },
  async set<T extends { id?: string }>(collection: string, item: T): Promise<T> {
    const id = item.id ?? crypto.randomUUID();
    const { id: _, ...rest } = item as any;
    const { error } = await supabase.from("app_data").upsert({ collection, id, data: rest });
    if (error) throw error;
    return { ...(item as any), id };
  },
  async remove(collection: string, id: string): Promise<void> {
    const { error } = await supabase.from("app_data").delete().eq("collection", collection).eq("id", id);
    if (error) throw error;
  },
  subscribe(collection: string, cb: () => void) {
    const ch = supabase
      .channel(`app_data:${collection}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "app_data", filter: `collection=eq.${collection}` },
        () => cb())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },
};