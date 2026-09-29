/**
 * AI-assisted spec generator for "Add a custom hex".
 *
 * The user gives us a name + a short description of what the new hex
 * should do. We ask Lovable AI to design:
 *   - a focused list of form fields (label, type, required)
 *   - a clean Lovable prompt that, when pasted back into chat, will
 *     build the page + hex + CRM wiring end-to-end.
 *
 * The output is editable in the UI before the user copies the prompt.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAiQuota } from "@/lib/ai-quota.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type HexField = {
  label: string;
  type:
    | "text"
    | "email"
    | "phone"
    | "url"
    | "number"
    | "date"
    | "textarea"
    | "select"
    | "file"
    | "image"
    | "camera"
    | "csv";
  required: boolean;
  options?: string[];
  placeholder?: string;
};

export type HexSpec = {
  fields: HexField[];
  prompt: string;
};

export const generateHexSpec = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { parentLabel: string; primaryId: string; name: string; purpose: string }) => d,
  )
  .handler(async ({ data, context }): Promise<HexSpec> => {
    await assertAiQuota(context.supabase, "custom-hex");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You design small marketing sub-tools ("hexes") inside the Marketing Command Center.
Given a parent section, a name, and a short description, you decide:
  1) the minimum set of form fields needed to capture the data
  2) a clean Lovable prompt to build the hex + page + CRM wiring

Field selection rules — pick ONLY what the description actually needs:
  • Include first name, last name, and email ONLY when the hex captures a person/lead. Skip them otherwise.
  • Mark only the truly necessary fields as required. Optional > required when in doubt.
  • Use phone for phone numbers, url for links, number for counts/amounts, date for dates, textarea for notes/descriptions, select (with options) for fixed choices.
  • Use file when the user mentions uploads (PDFs, decks, attachments, documents).
  • Use csv when the user mentions CSV import, list upload, bulk import, or spreadsheets.
  • Use image when they mention photos/screenshots/logos that come from existing files.
  • Use camera when they mention business cards, badge scans, receipts, or anything captured live from a phone/webcam. Camera fields imply drag-and-drop + photo capture in the built UI.
  • You can include BOTH csv and camera/file in the same hex when the description calls for multiple intake paths (e.g. "csv upload AND business cards via camera").
Prefer 3–10 fields. Don't pad. Don't omit something the description explicitly asks for.`;

    const user = `Parent section: "${data.parentLabel}" (primaryId: ${data.primaryId})
Hex name: ${data.name}
What it should do: ${data.purpose}

Design the form fields and a Lovable build prompt. The prompt must instruct Lovable to:
- register a new focused tool in src/components/tools/focused-tools.tsx under primaryId "${data.primaryId}" with parentTitle "${data.parentLabel}"
- add a satellite in src/components/tools/HexToolsTree.tsx and map it in SATELLITE_TO_FOCUS_SLUG
- create src/routes/_app/tools/<slug>.tsx exporting a headerless content component
- persist via the CRM adapter in src/lib/crm/* (never call HubSpot directly)
- add the hex to src/routes/_app.tsx sidebar tree
- match the existing hex/header styling and use country-flag phone inputs where applicable`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_hex_spec",
              parameters: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    minItems: 2,
                    maxItems: 12,
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        type: {
                          type: "string",
                          enum: [
                            "text",
                            "email",
                            "phone",
                            "url",
                            "number",
                            "date",
                            "textarea",
                            "select",
                            "file",
                            "image",
                            "camera",
                            "csv",
                          ],
                        },
                        required: { type: "boolean" },
                        options: { type: "array", items: { type: "string" } },
                        placeholder: { type: "string" },
                      },
                      required: ["label", "type", "required"],
                      additionalProperties: false,
                    },
                  },
                  prompt: { type: "string", minLength: 80 },
                },
                required: ["fields", "prompt"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_hex_spec" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limited — try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
      throw new Error(`AI gateway error (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI returned no structured output");
    return JSON.parse(args) as HexSpec;
  });
