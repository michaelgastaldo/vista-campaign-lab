// Server-only demo-mode provisioning. Never import from client code — this
// module uses the service-role client.
//
// The demo signs visitors into a single shared account so they can browse the
// whole app without signing up. Provisioning mirrors what handle_new_user()
// does for real signups (profile, org, seeds) so the demo account works even
// if that trigger is missing, then layers on the four sample campaigns.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRecipe } from "@/lib/templates.functions";
import type { Database } from "@/integrations/supabase/types";

export const DEMO_EMAIL = "demo@mc3-demo.app";
const DEMO_NAME = "Demo Marketer";

const DEFAULT_CHANNELS = ["email", "paid-social", "paid-search", "organic", "content", "events"];

type DemoInvite = { email: string; token: string };

export async function ensureDemoSession(): Promise<DemoInvite> {
  const admin = supabaseAdmin;

  let link = await admin.auth.admin.generateLink({ type: "magiclink", email: DEMO_EMAIL });
  if (link.error || !link.data) {
    // Demo account doesn't exist yet — create it. The handle_new_user trigger
    // (when attached) seeds the org; we re-verify everything below regardless.
    const created = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      email_confirm: true,
      user_metadata: { full_name: DEMO_NAME },
    });
    if (created.error) throw new Error(created.error.message);
    link = await admin.auth.admin.generateLink({ type: "magiclink", email: DEMO_EMAIL });
  }
  if (link.error || !link.data) {
    throw new Error(link.error?.message ?? "Could not start the demo session");
  }

  const userId = link.data.user.id;
  const token = link.data.properties.hashed_token;
  await provisionDemoWorkspace(userId);
  return { email: DEMO_EMAIL, token };
}

/** Idempotent: fills in anything missing on the shared demo account. */
async function provisionDemoWorkspace(userId: string) {
  const admin = supabaseAdmin;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, default_org_id, onboarded_at")
    .eq("id", userId)
    .maybeSingle();

  let orgId = profile?.default_org_id ?? null;
  if (!orgId) {
    // Mirror handle_new_user: profile, org, membership, settings, starter data.
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: `${DEMO_NAME}'s Workspace`, slug: `demo-${userId.slice(0, 8)}` })
      .select("id")
      .single();
    if (orgErr || !org) throw new Error(orgErr?.message ?? "Could not create demo workspace");
    orgId = org.id;

    await admin.from("org_members").insert({ org_id: orgId, user_id: userId, role: "owner" });
    await admin.from("profiles").insert({ id: userId, full_name: DEMO_NAME, default_org_id: orgId });
    await admin.from("taxonomy_settings").insert({ org_id: orgId, channels: DEFAULT_CHANNELS });
    await admin.from("utm_settings").insert({ org_id: orgId });

    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .insert({
        org_id: orgId,
        owner_id: userId,
        name: "Welcome campaign",
        status: "draft",
        goal: "Explore Campaign Canvas — rename this workspace, set a goal, and try the tools in the sidebar.",
        channel: "email",
      })
      .select("id")
      .single();
    if (ws && !wsErr) {
      await admin.from("workspace_activity").insert({
        workspace_id: ws.id,
        org_id: orgId,
        actor_id: userId,
        kind: "workspace.seeded",
        payload: { reason: "first_login" },
      });
    }

    await admin.rpc("seed_funnel_sample", { _org_id: orgId, _user_id: userId });
    await admin.rpc("seed_contacts_sample", { _org_id: orgId, _user_id: userId });
  }

  // Tune the demo org so the app looks lived-in from the first click.
  await admin.from("organizations").update({ industry: "SaaS / Software" }).eq("id", orgId);
  await admin
    .from("taxonomy_settings")
    .update({ channels: DEFAULT_CHANNELS })
    .eq("org_id", orgId);

  // Mark onboarded so the demo skips the setup wizard entirely.
  if (!profile?.onboarded_at) {
    await admin
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", userId);
  }

  await seedSampleWorkspaces(orgId, userId);
}

/** Mirrors instantiateTemplate() for all four recipes, via service role. */
async function seedSampleWorkspaces(orgId: string, userId: string) {
  const admin = supabaseAdmin;
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  for (const slug of ["product-launch", "webinar", "newsletter", "paid-acquisition"]) {
    const recipe = getRecipe(slug);
    if (!recipe) continue;

    const { data: existing } = await admin
      .from("workspaces")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_sample", true)
      .eq("name", recipe.name)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();
    if (existing?.id) continue;

    const end = new Date(today);
    end.setDate(end.getDate() + recipe.duration_days);

    const { data: ws, error: wsErr } = await admin
      .from("workspaces")
      .insert({
        org_id: orgId,
        owner_id: userId,
        name: recipe.name,
        status: "planning",
        goal: recipe.goal,
        channel: recipe.channel,
        campaign_type: recipe.campaign_type as Database["public"]["Enums"]["campaign_type"],
        kpi_label: recipe.kpi_label,
        kpi_target: recipe.kpi_target,
        kpi_actual: 0,
        budget_cents: recipe.budget_cents,
        spend_cents: 0,
        revenue_cents: 0,
        start_date: fmt(today),
        end_date: fmt(end),
        is_sample: true,
      })
      .select("id")
      .single();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Failed to create sample workspace");
    const wsId = ws.id;

    if (recipe.checklist.length) {
      await admin.from("checklist_items").insert(
        recipe.checklist.map((title, i) => ({
          workspace_id: wsId,
          org_id: orgId,
          created_by: userId,
          title,
          position: i,
          done: false,
        })),
      );
    }

    if (recipe.budget_lines.length) {
      await admin.from("workspace_budget_lines").insert(
        recipe.budget_lines.map((b, i) => ({
          workspace_id: wsId,
          org_id: orgId,
          created_by: userId,
          label: b.label,
          channel: b.channel,
          planned_cents: b.planned_cents,
          actual_cents: 0,
          position: i,
        })),
      );
    }

    await admin.from("workspace_kpis").insert({
      workspace_id: wsId,
      org_id: orgId,
      created_by: userId,
      channel: recipe.channel,
      sent: 0,
      opens: 0,
      clicks: 0,
      conversions: 0,
      spend_cents: 0,
      revenue_cents: 0,
    });

    await admin.from("workspace_activity").insert({
      workspace_id: wsId,
      org_id: orgId,
      actor_id: userId,
      kind: "workspace.sample_loaded",
      payload: { template: slug },
    });
  }
}
