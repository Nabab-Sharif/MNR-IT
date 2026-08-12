// Public endpoint. Given an Access ID, returns the internal email/password so the
// client can call signInWithPassword. Only bootstraps the super admin id automatically.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPER_ADMIN_ID = "01838047391";
const ALL_ROUTES = [
  "/","/departments","/accessories","/ip-addresses","/printers","/sticker-printer",
  "/sticker-printer/crop","/ip-phones","/wifi-list","/cctv-list","/cctv-checklist",
  "/switch-mapping","/products","/settings","/user-profiles","/super-admin",
];

const emailFor = (id: string) => `id${id}@access.mnr.local`;
const passFor = (id: string) => `${id}#mnr-2026-access`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { access_id } = await req.json();
    const id = String(access_id || "").trim();
    if (!id) return json({ error: "Access ID required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up access_users mapping
    const { data: row } = await admin.from("access_users").select("*").eq("access_id", id).maybeSingle();

    if (!row) {
      // Bootstrap only for hard-coded super admin
      if (id !== SUPER_ADMIN_ID) return json({ error: "Access ID not registered" }, 404);

      const email = emailFor(id);
      const password = passFor(id);
      // Create auth user
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr && !String(cErr.message).toLowerCase().includes("already")) return json({ error: cErr.message }, 400);
      let userId = created?.user?.id;
      if (!userId) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        userId = list?.users.find((u) => u.email === email)?.id;
      }
      if (!userId) return json({ error: "Bootstrap failed" }, 500);

      await admin.from("access_users").upsert({
        user_id: userId, access_id: id, label: "Super Admin",
        default_route: "/", is_super_admin: true, allowed_routes: ALL_ROUTES,
      });
      await admin.from("user_roles").upsert({ user_id: userId, role: "admin" });

      return json({ email, password });
    }

    return json({ email: emailFor(id), password: passFor(id) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}