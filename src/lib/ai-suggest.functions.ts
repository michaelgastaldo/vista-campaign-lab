import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAiQuota } from "@/lib/ai-quota.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(body: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error (${res.status})`);
  }
  return res.json();
}

function getToolArgs(json: unknown): Record<string, unknown> {
  const j = json as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured output");
  return JSON.parse(args) as Record<string, unknown>;
}

// ─── Checklist suggestions ──────────────────────────────────────────────
export const suggestChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignType: string; goal: string | null; channel: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a senior marketing campaign manager. Produce an ordered, actionable launch checklist tailored to the campaign type." },
        { role: "user", content: `Campaign type: ${data.campaignType}\nChannel: ${data.channel ?? "unspecified"}\nGoal: ${data.goal ?? "unspecified"}\n\nProduce 8–14 checklist items, each ≤ 8 words, specific and verb-led. Order them chronologically (planning → launch → wrap-up).` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_checklist",
          parameters: {
            type: "object",
            properties: { items: { type: "array", minItems: 6, maxItems: 16, items: { type: "string" } } },
            required: ["items"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_checklist" } },
    });
    return getToolArgs(json) as { items: string[] };
  });

// ─── A/B winner summary ─────────────────────────────────────────────────
export const summarizeWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { variants: Array<{ label: string; subject: string | null; copy: string | null; results: Record<string, number> }>; winnerLabel: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a growth analyst. Explain in 2–3 sentences why the winning variant beat the others, citing specific numbers when present. Be direct, no hedging." },
        { role: "user", content: `Winner: ${data.winnerLabel}\n\nVariants:\n${JSON.stringify(data.variants, null, 2)}` },
      ],
    });
    const j = json as { choices?: Array<{ message?: { content?: string } }> };
    return { summary: j.choices?.[0]?.message?.content?.trim() ?? "" };
  });

// ─── KPI paste parser ───────────────────────────────────────────────────
export const parseKpiPaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paste: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You convert pasted ad-platform / ESP / GA4 reports into a normalized per-channel KPI table. Map columns intelligently. Spend and revenue are in cents. Currency-format pasted dollars get multiplied by 100." },
        { role: "user", content: `Parse this report and return per-channel rows:\n\n${data.paste.slice(0, 8000)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_kpis",
          parameters: {
            type: "object",
            properties: {
              rows: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    channel: { type: "string" },
                    sent: { type: "integer" },
                    opens: { type: "integer" },
                    clicks: { type: "integer" },
                    conversions: { type: "integer" },
                    spend_cents: { type: "integer" },
                    revenue_cents: { type: "integer" },
                  },
                  required: ["channel"],
                  additionalProperties: false,
                },
              },
            },
            required: ["rows"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_kpis" } },
    });
    return getToolArgs(json) as { rows: Array<Record<string, number | string>> };
  });

// ─── Draft a campaign from a free-text brief ────────────────────────────
export const draftCampaignFromBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { brief: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a senior marketing campaign manager turning a short brief into a structured workspace plan. Be concrete, no fluff." },
        { role: "user", content: `Brief:\n${data.brief.slice(0, 4000)}\n\nReturn a campaign plan.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_campaign",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
              goal: { type: "string" },
              channel: { type: "string", enum: ["email","paid-search","paid-social","organic","content","events","display","video","partner"] },
              campaign_type: { type: "string", enum: ["product_launch","webinar","newsletter","paid_acquisition","event","content","other"] },
              kpi_label: { type: "string" },
              kpi_target: { type: "number" },
              checklist: { type: "array", minItems: 6, maxItems: 14, items: { type: "string" } },
              variants: {
                type: "array", minItems: 2, maxItems: 4,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    subject: { type: "string" },
                    copy: { type: "string" },
                  },
                  required: ["label","subject","copy"],
                  additionalProperties: false,
                },
              },
            },
            required: ["name","goal","channel","campaign_type","kpi_label","kpi_target","checklist","variants"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_campaign" } },
    });
    return getToolArgs(json) as {
      name: string; goal: string; channel: string;
      campaign_type: "product_launch"|"webinar"|"newsletter"|"paid_acquisition"|"event"|"content"|"other";
      kpi_label: string; kpi_target: number;
      checklist: string[];
      variants: Array<{ label: string; subject: string; copy: string }>;
    };
  });

// ─── Auto retro draft from KPIs + checklist ─────────────────────────────
export const draftRetroSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string; goal: string | null;
    kpi: { label: string | null; target: number | null; actual: number | null };
    checklist: Array<{ title: string; done: boolean }>;
    kpis: Array<{ channel: string; sent: number; clicks: number; conversions: number; spend_cents: number; revenue_cents: number }>;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You write campaign retrospectives. Be specific, cite numbers when present, and keep each section to 1-3 sentences." },
        { role: "user", content: `Campaign: ${data.name}\nGoal: ${data.goal ?? "—"}\nKPI: ${data.kpi.label ?? "—"} target ${data.kpi.target ?? "—"} actual ${data.kpi.actual ?? "—"}\n\nChecklist:\n${data.checklist.map(c => `- [${c.done?"x":" "}] ${c.title}`).join("\n")}\n\nResults by channel:\n${JSON.stringify(data.kpis, null, 2)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_retro",
          parameters: {
            type: "object",
            properties: {
              what_worked: { type: "string" },
              what_didnt: { type: "string" },
              next_time: { type: "string" },
            },
            required: ["what_worked","what_didnt","next_time"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_retro" } },
    });
    return getToolArgs(json) as { what_worked: string; what_didnt: string; next_time: string };
  });

// ─── Retro clustering ───────────────────────────────────────────────────
export const clusterRetros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignType: string; retros: Array<{ what_worked: string | null; what_didnt: string | null; next_time: string | null }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You synthesize repeated retrospective lessons into 3–6 concrete checklist additions. Each item ≤ 8 words, verb-led." },
        { role: "user", content: `Campaign type: ${data.campaignType}\n\nRetros:\n${JSON.stringify(data.retros, null, 2)}\n\nReturn checklist suggestions to add to this campaign type's playbook.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_suggestions",
          parameters: {
            type: "object",
            properties: { items: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } } },
            required: ["items"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_suggestions" } },
    });
    return getToolArgs(json) as { items: string[] };
  });

// ─── Audience prompt parser (AI structured extraction) ──────────────────
export const parseAudiencePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAiQuota(context.supabase, "ai-suggest");
    const json = await callAI({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You parse plain-English B2B audience descriptions into structured targeting criteria. Normalize values to lowercase short tokens (e.g. 'emea', 'saas', 'director', 'midmarket'). Only include values the user implied — do not invent. Return a heuristic match_estimate between 500 and 500000 reflecting how broad/narrow the audience is (broader = larger), and a confidence label.",
        },
        { role: "user", content: data.prompt.slice(0, 2000) },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_audience",
            parameters: {
              type: "object",
              properties: {
                geos: { type: "array", items: { type: "string" } },
                industries: { type: "array", items: { type: "string" } },
                departments: { type: "array", items: { type: "string" } },
                seniorities: { type: "array", items: { type: "string" } },
                company_size: { type: "array", items: { type: "string" } },
                match_estimate: { type: "integer" },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                rationale: { type: "string" },
              },
              required: [
                "geos",
                "industries",
                "departments",
                "seniorities",
                "company_size",
                "match_estimate",
                "confidence",
                "rationale",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_audience" } },
    });
    return getToolArgs(json) as {
      geos: string[];
      industries: string[];
      departments: string[];
      seniorities: string[];
      company_size: string[];
      match_estimate: number;
      confidence: "low" | "medium" | "high";
      rationale: string;
    };
  });
