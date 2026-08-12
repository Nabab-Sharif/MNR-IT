import { supabase } from "@/integrations/supabase/client";
import dbService from "@/services/dbService";

export type TrashInput = {
  entity: string;           // e.g. "IT Asset", "Printer"
  entity_id?: string | null;
  entity_label?: string | null;
  collection?: string;      // dbService method suffix, e.g. "ITAsset", "Printer", "CCTVCamera"
  payload: unknown;         // full row to allow restore
};

/** Send an item to the recycle bin (fire-and-forget; never blocks UX). */
export async function sendToRecycleBin(input: TrashInput) {
  try {
    const { data: sess } = await supabase.auth.getUser();
    const user = sess?.user;
    if (!user) return;
    const { data: acc } = await supabase
      .from("access_users")
      .select("access_id, label, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("recycle_bin").insert({
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      entity_label: input.entity_label ?? null,
      collection: input.collection ?? null,
      payload: input.payload as any,
      deleted_by: user.id,
      deleted_by_label: acc?.full_name || acc?.label || null,
      deleted_by_access_id: acc?.access_id || null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
    });
  } catch {
    // ignore
  }
}

/** Send multiple items to the recycle bin in one request. */
export async function sendManyToRecycleBin(inputs: TrashInput[]) {
  try {
    if (!inputs.length) return;
    const { data: sess } = await supabase.auth.getUser();
    const user = sess?.user;
    if (!user) return;
    const { data: acc } = await supabase
      .from("access_users")
      .select("access_id, label, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const route = typeof window !== "undefined" ? window.location.pathname : null;
    await supabase.from("recycle_bin").insert(inputs.map((input) => ({
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      entity_label: input.entity_label ?? null,
      collection: input.collection ?? null,
      payload: input.payload as any,
      deleted_by: user.id,
      deleted_by_label: acc?.full_name || acc?.label || null,
      deleted_by_access_id: acc?.access_id || null,
      route,
    })));
  } catch {
    // ignore
  }
}

/** Restore an item back to its original collection via dbService. */
export async function restoreFromRecycleBin(row: {
  id: string; collection: string | null; payload: any;
}) {
  const fn = row.collection ? `add${row.collection}` : null;
  const svc = dbService as any;
  if (fn && typeof svc[fn] === "function") {
    const { id, created_at, updated_at, ...rest } = row.payload || {};
    await svc[fn](rest);
  }
  await supabase.from("recycle_bin").delete().eq("id", row.id);
}

export async function purgeFromRecycleBin(id: string) {
  await supabase.from("recycle_bin").delete().eq("id", id);
}