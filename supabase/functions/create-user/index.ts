// Supabase Edge Function: create-user
// -----------------------------------------------------------------------------
// Lets an approved ADMIN create a staff/management login (email + temp password)
// and set their permissions. The Supabase service-role key stays on the server
// here — it is never shipped to the browser.
//
// Deploy:
//   supabase functions deploy create-user
//   supabase secrets set SERVICE_ROLE_KEY=<your service_role key>
//   (SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.)
//
// The browser calls it with:  supabase.functions.invoke("create-user", { body })
// -----------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Who is calling?
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Not signed in." }, 401);
    }
    const { data: profile } = await caller
      .from("profiles")
      .select("role, is_approved")
      .eq("id", userData.user.id)
      .single();
    // Only the Owner (super_admin) creates logins — matches the app's own
    // access model (src/lib/access.js: manageUsers: isSuperAdmin), which
    // hides "Create Login" from plain admins. This check used to also
    // accept role === "admin", which let any operational admin mint a new
    // admin-level login by calling this function directly (bypassing the
    // UI restriction entirely) — see the engineering review, finding C3.
    if (!profile || profile.role !== "super_admin" || !profile.is_approved) {
      return json({ error: "Only the Owner (super admin) can create logins." }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    // Kept in sync with ASSIGNABLE_ROLES in src/lib/access.js — student/
    // faculty/professional have no permissions or screens today, so this
    // function won't create a dead-end login for them either.
    const ASSIGNABLE = ["admin", "staff"];
    const role = ASSIGNABLE.includes(body.role) ? body.role : "staff";
    const canView = role === "admin" ? true : Boolean(body.can_view_financials);
    const approved = body.is_approved !== false;

    if (!email || password.length < 8) {
      return json({ error: "Email and a password of at least 8 characters are required." }, 400);
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // The handle_new_user trigger has already inserted a profile row; set its
    // role / approval / access here. must_change_password: true forces this
    // person through the password-change screen on their first sign-in,
    // since `password` above is a temp password the super-admin just set and
    // is handing them out-of-band — see the engineering review, finding M6.
    const { error: profErr } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        role,
        is_approved: approved,
        can_view_financials: canView,
        must_change_password: true,
      })
      .eq("id", created.user.id);
    if (profErr) return json({ error: profErr.message }, 400);

    return json({ ok: true, id: created.user.id, email });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
