import { supabase } from "@/integrations/supabase/client";

export type ActivityAction = "add" | "edit" | "delete" | "issue" | "receive" | "print";

export type LogActivityInput = {
  action: ActivityAction;
  entity: string;              // e.g. "IT Asset", "CCTV", "Switch"
  entity_id?: string | null;   // e.g. asset id or name
  description?: string;        // human-readable summary
  route?: string;              // current pathname
};

/**
 * Fire-and-forget activity logger.
 * Attaches user_id, access_id, and label from the current session so
 * super admins see who did what in real time.
 */
export async function logActivity(input: LogActivityInput) {
  try {
    const { data: sess } = await supabase.auth.getUser();
    const user = sess?.user;
    if (!user) return;

    let access_id: string | null = null;
    let actor_label: string | null = null;
    const { data: acc } = await supabase
      .from("access_users")
      .select("access_id, label")
      .eq("user_id", user.id)
      .maybeSingle();
    if (acc) {
      access_id = acc.access_id;
      actor_label = acc.label ?? null;
    }

    await supabase.from("activity_log").insert({
      user_id: user.id,
      access_id,
      actor_label,
      action: input.action,
      entity: input.entity,
      entity_id: input.entity_id ?? null,
      description: input.description ?? null,
      route: input.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
    });
  } catch {
    // never break UX on logging failure
  }
}