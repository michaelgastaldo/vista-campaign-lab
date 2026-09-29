import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sample-campaign recipes. Keeping these inline (rather than reading from
 * the `workspace_templates` table) keeps the seed deterministic per slug
 * even when an org has edited its own templates. The slugs match
 * src/routes/_app/templates.tsx.
 */
type Recipe = {
  name: string;
  goal: string;
  channel: string;
  campaign_type: string;
  kpi_label: string;
  kpi_target: number;
  budget_cents: number;
  duration_days: number;
  checklist: string[];
  budget_lines: { label: string; channel: string; planned_cents: number }[];
};

const RECIPES: Record<string, Recipe> = {
  "product-launch": {
    name: "Sample: Product launch",
    goal: "Drive 500 signups and 80 demo requests for the new feature in 4 weeks.",
    channel: "email",
    campaign_type: "product_launch",
    kpi_label: "Signups",
    kpi_target: 500,
    budget_cents: 1_500_000,
    duration_days: 28,
    checklist: [
      "Lock messaging & positioning",
      "Brief design on launch assets",
      "Draft launch announcement email",
      "Set up UTM tagging plan",
      "Schedule paid social + organic",
      "QA links & tracking pre-launch",
      "Post-launch retro & report",
    ],
    budget_lines: [
      { label: "Paid social boosts", channel: "paid-social", planned_cents: 800_000 },
      { label: "Creative production", channel: "content", planned_cents: 700_000 },
    ],
  },
  webinar: {
    name: "Sample: Webinar",
    goal: "Maximize qualified registrations and on-day attendance for the next webinar.",
    channel: "email",
    campaign_type: "webinar",
    kpi_label: "Registrations",
    kpi_target: 300,
    budget_cents: 500_000,
    duration_days: 21,
    checklist: [
      "Confirm speakers and topic",
      "Build registration landing page",
      "Send promo email (week -3)",
      "LinkedIn + partner amplification",
      "Run live session & record",
      "Send replay + nurture sequence",
    ],
    budget_lines: [
      { label: "Promo paid", channel: "paid-social", planned_cents: 300_000 },
      { label: "Webinar platform", channel: "content", planned_cents: 200_000 },
    ],
  },
  newsletter: {
    name: "Sample: Newsletter send",
    goal: "Lift click-through rate by 2pp on the next monthly send.",
    channel: "email",
    campaign_type: "newsletter",
    kpi_label: "CTR %",
    kpi_target: 8,
    budget_cents: 0,
    duration_days: 7,
    checklist: [
      "Plan editorial line-up",
      "Write subject line variants",
      "Build audience segment",
      "QA on multiple email clients",
      "Schedule + monitor first hour",
    ],
    budget_lines: [],
  },
  "paid-acquisition": {
    name: "Sample: Paid acquisition",
    goal: "Drive low-CPA signups across paid search and paid social.",
    channel: "paid-search",
    campaign_type: "paid_acquisition",
    kpi_label: "CPA ($)",
    kpi_target: 50,
    budget_cents: 3_000_000,
    duration_days: 30,
    checklist: [
      "Define audience & negatives",
      "Build creative variants (3 hooks)",
      "Set up UTM + conversion tracking",
      "Launch + monitor day 1–3",
      "Rotate underperforming creative weekly",
      "Weekly performance readout",
    ],
    budget_lines: [
      { label: "Paid search", channel: "paid-search", planned_cents: 1_800_000 },
      { label: "Paid social", channel: "paid-social", planned_cents: 1_200_000 },
    ],
  },
};

export const listTemplateSlugs = () => Object.keys(RECIPES);
export const getRecipe = (slug: string): Recipe | null => RECIPES[slug] ?? null;

/**
 * Instantiate a sample campaign. Re-derives org_id from the caller's
 * profile (never trust client). Seeds a workspace with checklist, budget
 * lines, and a KPI row so the user lands on something live, not empty.
 */
export const instantiateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => {
    if (!data?.slug || typeof data.slug !== "string") {
      throw new Error("Missing template slug");
    }
    if (!RECIPES[data.slug]) {
      throw new Error(`Unknown template: ${data.slug}`);
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("default_org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const orgId = profile?.default_org_id;
    if (!orgId) throw new Error("No default organization for user");

    const recipe = RECIPES[data.slug]!;
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + recipe.duration_days);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // De-dupe: if this exact sample already exists for the org and isn't
    // archived, jump to it instead of spawning a duplicate. Users hit
    // "Load sample" twice constantly and end up with a wall of clones.
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_sample", true)
      .eq("name", recipe.name)
      .neq("status", "archived")
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      return { id: existing.id, slug: data.slug, reused: true };
    }

    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .insert({
        org_id: orgId,
        owner_id: userId,
        name: recipe.name,
        status: "planning",
        goal: recipe.goal,
        channel: recipe.channel,
        campaign_type: recipe.campaign_type as
          | "product_launch"
          | "webinar"
          | "newsletter"
          | "paid_acquisition"
          | "event"
          | "content"
          | "other",
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
      await supabase.from("checklist_items").insert(
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
      await supabase.from("workspace_budget_lines").insert(
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

    await supabase.from("workspace_kpis").insert({
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

    await supabase.from("workspace_activity").insert({
      workspace_id: wsId,
      org_id: orgId,
      actor_id: userId,
      kind: "workspace.sample_loaded",
      payload: { template: data.slug },
    });

    return { id: wsId, slug: data.slug };
  });

/** Remove all "sample" workspaces for the current org. Used by "Remove samples" CTA. */
export const removeAllSamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_org_id")
      .eq("id", userId)
      .maybeSingle();
    const orgId = profile?.default_org_id;
    if (!orgId) return { removed: 0 };

    const { data: rows, error } = await supabase
      .from("workspaces")
      .delete()
      .eq("is_sample", true)
      .eq("org_id", orgId)
      .select("id");
    if (error) throw new Error(error.message);
    return { removed: rows?.length ?? 0 };
  });
