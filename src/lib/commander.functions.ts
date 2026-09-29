import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAiQuota } from "@/lib/ai-quota.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

// ─── Types shared with client ───────────────────────────────────────────
export type CommanderMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

export type ProposedAction =
  | { tool: "create_campaign"; args: { name: string; channel?: string; campaign_type?: string; goal?: string; kpi_label?: string; kpi_target?: number }; summary: string }
  | { tool: "update_campaign"; args: { id: string; patch: Record<string, string | number | boolean | null> }; summary: string }
  | { tool: "add_checklist_item"; args: { campaign_id: string; title: string }; summary: string }
  | { tool: "toggle_checklist_item"; args: { item_id: string; done: boolean }; summary: string }
  | { tool: "create_utm_link"; args: { label: string; base_url: string; utm_source: string; utm_medium: string; utm_campaign: string; utm_content?: string }; summary: string };

export type ClarificationQuestion = {
  id: string;
  question: string;
  options?: string[];
  placeholder?: string;
};

export type CommanderTurn =
  | { kind: "text"; text: string }
  | { kind: "navigate"; path: string; text?: string }
  | { kind: "clarify"; intro: string; questions: ClarificationQuestion[] }
  | { kind: "propose"; intro: string; actions: ProposedAction[] }
  | { kind: "read"; text: string };

// ─── Helpers ────────────────────────────────────────────────────────────
async function callGateway(body: unknown): Promise<unknown> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Commander is taking a breath. Try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(`Commander gateway error (${res.status})`);
  }
  return res.json();
}

function pickToolArgs(json: unknown): { name: string; args: Record<string, unknown> } | null {
  const j = json as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } }> };
  const call = j.choices?.[0]?.message?.tool_calls?.[0]?.function;
  if (!call?.name || !call?.arguments) return null;
  try {
    return { name: call.name, args: JSON.parse(call.arguments) as Record<string, unknown> };
  } catch {
    return null;
  }
}

// ─── Main agent turn ────────────────────────────────────────────────────
export const runCommanderTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: CommanderMessage[]; pageContext?: string; currentCampaignId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAiQuota(supabase, "commander");

    // ─── Context bundle ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_org_id, full_name")
      .eq("id", userId)
      .maybeSingle();
    const orgId = profile?.default_org_id as string | null;

    const [{ data: campaigns }, { data: currentCampaign }, { data: checklist }, { data: targets }] = await Promise.all([
      supabase
        .from("workspaces")
        .select("id,name,status,campaign_type,channel,goal,kpi_label,kpi_target,kpi_actual,start_date,end_date,updated_at")
        .order("updated_at", { ascending: false })
        .limit(15),
      data.currentCampaignId
        ? supabase
            .from("workspaces")
            .select("id,name,status,campaign_type,channel,goal,kpi_label,kpi_target,kpi_actual,start_date,end_date")
            .eq("id", data.currentCampaignId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      data.currentCampaignId
        ? supabase
            .from("checklist_items")
            .select("id,title,done,position")
            .eq("workspace_id", data.currentCampaignId)
            .order("position", { ascending: true })
        : Promise.resolve({ data: null }),
      orgId
        ? supabase.from("funnel_targets").select("month,mql_target,sqo_target").eq("org_id", orgId).limit(3)
        : Promise.resolve({ data: null }),
    ]);

    const contextBlock = JSON.stringify(
      {
        page: data.pageContext ?? "unknown",
        recent_campaigns: campaigns ?? [],
        current_campaign: currentCampaign ?? null,
        current_checklist: checklist ?? null,
        funnel_targets: targets ?? null,
      },
      null,
      2,
    );

    const systemPrompt = `You are **Commander**, a marketing genius and command-center copilot for the user's marketing operations app.

Your job: answer questions, navigate, summarize data, and propose write actions. You always respond by calling exactly one tool function — never plain text.

# Tools you can call (pick ONE per turn):

1. **final_answer(text)** — short, direct natural-language answer or a read/summary result. Use for questions, summaries, or when an action just finished.
2. **navigate(path, text?)** — when the user wants to go somewhere. Valid paths: /dashboard, /campaigns, /campaigns/<id>, /calendar, /funnel, /requests, /templates, /settings, /tools, /tools/utm, /tools/campaign-in-a-box, /tools/campaign-creator, /tools/import, /integrations, /connectors.
3. **clarify(intro, questions[])** — ask 1-3 short clarification questions before acting. Use ONLY when missing information you cannot reasonably infer. Each question gets a stable id, the question text, and optional preset options.
4. **propose_actions(intro, actions[])** — propose 1-N write actions that will run AFTER the user confirms. Each action has a tool name, args, and a one-line human summary. Available actions:
   - create_campaign({ name, channel?, campaign_type?, goal?, kpi_label?, kpi_target? }) — campaign_type ∈ product_launch|webinar|newsletter|paid_acquisition|event|content|other
   - update_campaign({ id, patch }) — patch may include name, goal, channel, kpi_label, kpi_target, status, start_date, end_date
   - add_checklist_item({ campaign_id, title }) — title ≤ 8 words, verb-led
   - toggle_checklist_item({ item_id, done })
   - create_utm_link({ label, base_url, utm_source, utm_medium, utm_campaign, utm_content? })

# Rules
- Be direct. No filler. No "I'd be happy to". No emoji unless asked.
- Prefer **navigate** over describing how to navigate.
- Prefer **propose_actions** over telling the user to do it themselves.
- Never invent campaign IDs — use IDs from the context bundle below.
- When the user clearly says "do X" with enough info, skip clarify and go straight to propose_actions.
- When a question is answerable from the context bundle, use final_answer with the numbers.
- Multi-step requests: propose the whole batch of actions at once.
- **NEVER re-ask a question the user already answered.** If a prior assistant turn shows "asked: X" and the next user message contains "X → answer", treat that as the answer. Move on to propose_actions immediately.
- If an answer is "(skipped)", do NOT ask it again — fill it with a sensible default (e.g. utm_medium="referral", utm_campaign=slug of label) and proceed to propose_actions.
- If a base_url lacks "http://" or "https://", silently prepend "https://" and proceed — do not ask the user about it.
- You may ask clarify AT MOST ONCE per user task. After the user answers a clarify, your next turn MUST be propose_actions, final_answer, or navigate — never another clarify.

# Live context bundle (current user, page, and data):
${contextBlock}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "final_answer",
          description: "Respond with natural-language text. Use for answers, summaries, or status confirmations.",
          parameters: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "navigate",
          description: "Navigate the user to an in-app path.",
          parameters: {
            type: "object",
            properties: { path: { type: "string" }, text: { type: "string" } },
            required: ["path"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "clarify",
          description: "Ask 1-3 short clarification questions before taking action.",
          parameters: {
            type: "object",
            properties: {
              intro: { type: "string" },
              questions: {
                type: "array",
                minItems: 1,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    placeholder: { type: "string" },
                  },
                  required: ["id", "question"],
                  additionalProperties: false,
                },
              },
            },
            required: ["intro", "questions"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "propose_actions",
          description: "Propose write actions. The user will see each summary and confirm before anything runs.",
          parameters: {
            type: "object",
            properties: {
              intro: { type: "string" },
              actions: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items: {
                  type: "object",
                  properties: {
                    tool: {
                      type: "string",
                      enum: ["create_campaign", "update_campaign", "add_checklist_item", "toggle_checklist_item", "create_utm_link"],
                    },
                    args: { type: "object", additionalProperties: true },
                    summary: { type: "string" },
                  },
                  required: ["tool", "args", "summary"],
                  additionalProperties: false,
                },
              },
            },
            required: ["intro", "actions"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages = [
      { role: "system", content: systemPrompt },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const json = await callGateway({
      model: MODEL,
      messages,
      tools,
      tool_choice: "required",
    });
    const picked = pickToolArgs(json);
    if (!picked) {
      const j = json as { choices?: Array<{ message?: { content?: string } }> };
      const fallback = j.choices?.[0]?.message?.content?.trim() ?? "Sorry, I couldn't formulate a response.";
      return { turn: { kind: "text", text: fallback } as CommanderTurn };
    }

    switch (picked.name) {
      case "navigate":
        return {
          turn: {
            kind: "navigate",
            path: String(picked.args.path),
            text: typeof picked.args.text === "string" ? picked.args.text : undefined,
          } as CommanderTurn,
        };
      case "clarify":
        return {
          turn: {
            kind: "clarify",
            intro: String(picked.args.intro ?? ""),
            questions: (picked.args.questions as ClarificationQuestion[]) ?? [],
          } as CommanderTurn,
        };
      case "propose_actions":
        return {
          turn: {
            kind: "propose",
            intro: String(picked.args.intro ?? ""),
            actions: (picked.args.actions as ProposedAction[]) ?? [],
          } as CommanderTurn,
        };
      case "final_answer":
      default:
        return { turn: { kind: "text", text: String(picked.args.text ?? "") } as CommanderTurn };
    }
  });

// ─── Allow-lists / validators (defense-in-depth over RLS) ───────────────
// The model proposes patches; we never trust them as-is. Only these columns
// can be touched, and each value is coerced/clamped to a safe shape before
// it reaches Supabase. org_id / owner_id / created_by are ALWAYS derived
// server-side from the authenticated user — never accepted from the model.

const ALLOWED_CAMPAIGN_TYPES = [
  "product_launch", "webinar", "newsletter", "paid_acquisition",
  "event", "content", "other",
] as const;
type AllowedCampaignType = (typeof ALLOWED_CAMPAIGN_TYPES)[number];




function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function cleanFiniteNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n;
}

function cleanDate(v: unknown): string | null {
  // Accept YYYY-MM-DD or any ISO string; reject anything else.
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Sanitize a model-proposed workspace patch. Returns a plain object containing
 * ONLY allowed columns with validated values. Unknown keys (org_id, owner_id,
 * created_at, …) are silently dropped.
 */
function sanitizeWorkspacePatch(
  raw: Record<string, unknown> | null | undefined,
  allowedStageKeys: Set<string>,
): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  if (!raw || typeof raw !== "object") return out;

  const name = cleanString(raw.name, 200);
  if (name !== null) out.name = name;

  if ("status" in raw) {
    const s = typeof raw.status === "string" ? raw.status.trim() : "";
    if (s && allowedStageKeys.has(s)) {
      out.status = s;
    }
  }

  if ("campaign_type" in raw) {
    const t = typeof raw.campaign_type === "string" ? raw.campaign_type.trim() : "";
    if ((ALLOWED_CAMPAIGN_TYPES as readonly string[]).includes(t)) {
      out.campaign_type = t as AllowedCampaignType;
    }
  }

  const goal = cleanString(raw.goal, 2000);
  if (goal !== null) out.goal = goal;

  const channel = cleanString(raw.channel, 80);
  if (channel !== null) out.channel = channel;

  const kpi_label = cleanString(raw.kpi_label, 120);
  if (kpi_label !== null) out.kpi_label = kpi_label;

  for (const key of ["kpi_target", "kpi_actual", "budget_cents", "spend_cents", "revenue_cents"] as const) {
    if (key in raw) {
      const n = cleanFiniteNumber(raw[key]);
      if (n !== null) out[key] = n;
    }
  }

  for (const key of ["start_date", "end_date"] as const) {
    if (key in raw) {
      const d = cleanDate(raw[key]);
      if (d !== null) out[key] = d;
    }
  }

  return out;
}

// ─── Execute a confirmed action ─────────────────────────────────────────
export const executeCommanderAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { action: ProposedAction }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_org_id")
      .eq("id", userId)
      .maybeSingle();
    const orgId = profile?.default_org_id as string | null;
    if (!orgId) throw new Error("No active organization.");

    const a = data.action;
    if (!a || typeof a.tool !== "string") {
      throw new Error("Commander received an invalid action.");
    }
    switch (a.tool) {
      case "create_campaign": {
        const name = cleanString(a.args.name, 200);
        if (!name) throw new Error("Campaign name is required.");
        const ct = typeof a.args.campaign_type === "string" ? a.args.campaign_type.trim() : "";
        const campaign_type: AllowedCampaignType =
          (ALLOWED_CAMPAIGN_TYPES as readonly string[]).includes(ct)
            ? (ct as AllowedCampaignType)
            : "other";
        const insert: Record<string, string | number | null> = {
          name,
          // Server-derived — never from model output:
          org_id: orgId,
          owner_id: userId,
          campaign_type,
          channel: cleanString(a.args.channel, 80),
          goal: cleanString(a.args.goal, 2000),
          kpi_label: cleanString(a.args.kpi_label, 120),
          kpi_target: cleanFiniteNumber(a.args.kpi_target),
        };
        const { data: row, error } = await supabase
          .from("workspaces")
          .insert(insert as never)
          .select("id,name")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, result: row, navigate: `/campaigns/${row.id}` };
      }
      case "update_campaign": {
        const id = cleanString(a.args.id, 64);
        if (!id) throw new Error("Missing campaign id.");
        const { data: stageRows } = await supabase
          .from("campaign_stages")
          .select("key")
          .eq("org_id", orgId);
        const allowedStageKeys = new Set(
          ((stageRows as Array<{ key: string }> | null) ?? []).map((s) => s.key),
        );
        const patch = sanitizeWorkspacePatch(
          a.args.patch as Record<string, unknown> | null | undefined,
          allowedStageKeys,
        );
        if (Object.keys(patch).length === 0) {
          return { ok: false, error: "Nothing safe to update — patch contained no allowed fields." };
        }
        const { data: row, error } = await supabase
          .from("workspaces")
          .update(patch as never)
          .eq("id", id)
          .select("id,name")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, result: row };
      }
      case "add_checklist_item": {
        const workspace_id = cleanString(a.args.campaign_id, 64);
        const title = cleanString(a.args.title, 200);
        if (!workspace_id) throw new Error("Missing campaign id.");
        if (!title) throw new Error("Checklist title is required.");
        const { data: row, error } = await supabase
          .from("checklist_items")
          .insert({
            workspace_id,
            title,
            // Server-derived — never from model output:
            org_id: orgId,
            created_by: userId,
          })
          .select("id,title")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, result: row };
      }
      case "toggle_checklist_item": {
        const item_id = cleanString(a.args.item_id, 64);
        if (!item_id) throw new Error("Missing checklist item id.");
        const done = Boolean(a.args.done);
        const { data: row, error } = await supabase
          .from("checklist_items")
          .update({ done })
          .eq("id", item_id)
          .select("id,done")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, result: row };
      }
      case "create_utm_link": {
        const label = cleanString(a.args.label, 200);
        if (!label) throw new Error("UTM label is required.");
        let baseUrl = String(a.args.base_url ?? "").trim();
        if (!baseUrl) throw new Error("Destination URL is required.");
        if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `https://${baseUrl}`;
        let u: URL;
        try {
          u = new URL(baseUrl);
        } catch {
          throw new Error(`Couldn't parse destination URL: "${a.args.base_url}"`);
        }
        const utm_source = cleanString(a.args.utm_source, 80);
        const utm_medium = cleanString(a.args.utm_medium, 80);
        const utm_campaign = cleanString(a.args.utm_campaign, 120);
        const utm_content = cleanString(a.args.utm_content, 120);
        if (!utm_source || !utm_medium || !utm_campaign) {
          throw new Error("UTM source, medium, and campaign are required.");
        }
        u.searchParams.set("utm_source", utm_source);
        u.searchParams.set("utm_medium", utm_medium);
        u.searchParams.set("utm_campaign", utm_campaign);
        if (utm_content) u.searchParams.set("utm_content", utm_content);
        const final_url = u.toString();
        const { data: row, error } = await supabase
          .from("utm_links")
          .insert({
            label,
            base_url: baseUrl,
            final_url,
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content,
            // Server-derived — never from model output:
            org_id: orgId,
            created_by: userId,
          })
          .select("id,label,final_url")
          .single();
        if (error) throw new Error(error.message);
        return { ok: true, result: row };
      }
    }
  });
