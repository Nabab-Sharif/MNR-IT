import { useEffect, useState, useCallback } from "react";
import { cloudStore } from "@/services/cloudStore";

export function useCloudCollection<T = any>(collection: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try { setItems(await cloudStore.list<T>(collection)); }
    finally { setLoading(false); }
  }, [collection]);

  useEffect(() => {
    reload();
    const unsub = cloudStore.subscribe(collection, reload);
    return unsub;
  }, [collection, reload]);

  return { items, loading, reload,
    set: async (item: T) => { await cloudStore.set(collection, item as any); await reload(); },
    remove: async (id: string) => { await cloudStore.remove(collection, id); await reload(); },
  };
}