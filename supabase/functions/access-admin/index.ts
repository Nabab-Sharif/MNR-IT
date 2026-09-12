// Super-admin only. Create / update / delete access users (with permissions).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const emailFor = (id: string) => `id${id}@access.mnr.local`;
const passFor = (id: string) => `${id}#mnr-2026-access`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await anon.auth.getClaims(token);
    const callerId = claims?.claims?.sub;
    if (!callerId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: caller } = await admin.from("access_users").select("is_super_admin").eq("user_id", callerId).maybeSingle();
    if (!caller?.is_super_admin) return json({ error: "Super admin only" }, 403);
    const { data: callerInfo } = await admin.from("access_users")
      .select("access_id, label, full_name").eq("user_id", callerId).maybeSingle();
    const actorLabel = callerInfo?.full_name || callerInfo?.label || callerInfo?.access_id || "Super Admin";
    const actorAccessId = callerInfo?.access_id || null;
    const logAct = async (a: "add" | "edit" | "delete", entity_id: string | null, description: string) => {
      const { data, error } = await admin.from("activity_log").insert({
        user_id: callerId, access_id: actorAccessId, actor_label: actorLabel,
        action: a, entity: "Access User", entity_id, description, route: "/super-admin",
      }).select("id, user_id, action, entity, entity_id, actor_label, access_id, description, route, created_at, seen").single();
      if (error) console.error("activity_log_insert_failed", error.message);
      return data;
    };

    const body = await req.json();
    const action = body.action as string;

    if (action === "list") {
      const { data, error } = await admin
        .from("access_users")
        .select("*")
        .order("last_seen", { ascending: false, nullsFirst: false });
      if (error) return json({ error: error.message }, 400);
      return json({ rows: data || [] });
    }

    if (action === "create") {
      const { access_id, label, default_route, allowed_routes, route_permissions, make_admin,
              full_name, designation, department, unit_office, phone } = body;
      const id = String(access_id || "").trim();
      if (!id) return json({ error: "Access ID required" }, 400);
      const email = emailFor(id);
      const password = passFor(id);
      const { data: c, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (cErr) return json({ error: cErr.message }, 400);
      const userId = c.user!.id;
      const { error: insertErr } = await admin.from("access_users").insert({
        user_id: userId, access_id: id, label, default_route: default_route || "/",
        allowed_routes: allowed_routes || [], route_permissions: route_permissions || {}, is_super_admin: false,
        full_name: full_name || null, designation: designation || null, department: department || null,
        unit_office: unit_office || null, phone: phone || null,
      });
      if (insertErr) return json({ error: insertErr.message }, 400);
      if (make_admin) {
        const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (roleErr) return json({ error: roleErr.message }, 400);
      }
      const activity = await logAct("add", id, `Created access user ${id}${full_name ? " · " + full_name : ""}${unit_office ? " · " + unit_office : ""}`);
      return json({ ok: true, user_id: userId, activity });
    }

    if (action === "update") {
      const { user_id, access_id, label, default_route, allowed_routes, route_permissions, make_admin,
              full_name, designation, department, unit_office, phone } = body;
      const patch: Record<string, unknown> = { label, default_route, allowed_routes };
      if (route_permissions !== undefined) patch.route_permissions = route_permissions;
      if (full_name !== undefined) patch.full_name = full_name || null;
      if (designation !== undefined) patch.designation = designation || null;
      if (department !== undefined) patch.department = department || null;
      if (unit_office !== undefined) patch.unit_office = unit_office || null;
      if (phone !== undefined) patch.phone = phone || null;
      if (access_id !== undefined && String(access_id).trim()) {
        const newId = String(access_id).trim();
        patch.access_id = newId;
        // Keep auth login (email/password derived from access_id) in sync.
        const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
          email: emailFor(newId),
          password: passFor(newId),
        });
        if (authErr) return json({ error: authErr.message }, 400);
      }
      const { error: updateErr } = await admin.from("access_users").update(patch).eq("user_id", user_id);
      if (updateErr) return json({ error: updateErr.message }, 400);
      if (typeof make_admin === "boolean") {
        if (make_admin) {
          const { error: roleErr } = await admin.from("user_roles").upsert({ user_id, role: "admin" });
          if (roleErr) return json({ error: roleErr.message }, 400);
        } else {
          const { error: roleErr } = await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
          if (roleErr) return json({ error: roleErr.message }, 400);
        }
      }
      const targetAccessId = access_id ? String(access_id).trim() : String(user_id || "");
      const activity = await logAct("edit", targetAccessId, `Updated access user ${targetAccessId}${full_name ? " · " + full_name : ""}${unit_office ? " · " + unit_office : ""}`);
      return json({ ok: true, activity });
    }

    if (action === "delete") {
      const { user_id } = body;
      const { data: target } = await admin.from("access_users").select("is_super_admin").eq("user_id", user_id).maybeSingle();
      if (target?.is_super_admin) return json({ error: "Cannot delete super admin" }, 400);
      const { data: victim } = await admin.from("access_users").select("access_id, full_name, label").eq("user_id", user_id).maybeSingle();
      const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id); // cascades access_users + user_roles
      if (deleteErr) return json({ error: deleteErr.message }, 400);
      const activity = await logAct("delete", victim?.access_id || String(user_id || ""), `Deleted access user ${victim?.access_id || ""}${victim?.full_name ? " · " + victim.full_name : victim?.label ? " · " + victim.label : ""}`);
      return json({ ok: true, activity });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}