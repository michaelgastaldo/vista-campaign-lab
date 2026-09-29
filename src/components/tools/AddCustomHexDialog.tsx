/**
 * AddCustomHexDialog
 *
 * AI-assisted "add a new hex" flow. The user gives us a name and a short
 * description of what the hex should do. Lovable AI then designs the
 * fields and the Lovable build prompt. The user edits both inline (live
 * preview of the form fields) and copies the prompt back into chat.
 */

import { useEffect, useRef, useState, type WheelEvent } from "react";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconSpark, IconArrowRight, IconPlus, IconClose } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateHexSpec, type HexField } from "@/lib/custom-hex.functions";

const PRIMARY_LABEL: Record<string, string> = {
  utm: "UTM Builder",
  funnel: "Funnel",
  campaign: "Campaign-in-a-box",
};

const FIELD_TYPES: HexField["type"][] = [
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
];

const LIVE_SPEC_START = "--- LIVE FIELD SPEC START ---";
const LIVE_SPEC_END = "--- LIVE FIELD SPEC END ---";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-hex";

const canScrollInDirection = (el: HTMLElement, deltaY: number) => {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  return deltaY < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1;
};

const closestScrollable = (target: HTMLElement, boundary: HTMLElement, deltaY: number) => {
  let el: HTMLElement | null = target;
  while (el) {
    if (canScrollInDirection(el, deltaY)) return el;
    if (el === boundary) break;
    el = el.parentElement;
  }
  return null;
};

const fieldLine = (field: HexField, index: number) => {
  const details = [
    `type: ${field.type}`,
    field.required ? "required" : "optional",
    field.placeholder ? `placeholder: ${field.placeholder}` : "",
    field.options?.length ? `options: ${field.options.join(" | ")}` : "",
  ].filter(Boolean);
  return `${index + 1}. ${field.label} (${details.join("; ")})`;
};

const buildLiveSpecBlock = (fields: HexField[]) => {
  const types = new Set(fields.map((field) => field.type));
  const requirements = [
    "Build exactly the fields above; do not add generic extra fields unless the workflow explicitly needs them.",
    "Validate only the fields marked required.",
    types.has("phone")
      ? "Phone fields must use a country-flag selector and proper phone formatting."
      : "",
    types.has("camera")
      ? "Camera fields must support live camera capture plus a fallback file upload."
      : "",
    types.has("image")
      ? "Image fields must support image uploads with preview, replace, and remove states."
      : "",
    types.has("file")
      ? "File fields must support document upload with clear empty, uploaded, replace, and remove states."
      : "",
    types.has("csv")
      ? "CSV fields must support CSV/list upload with file validation and a readable uploaded-file state."
      : "",
    types.has("select") ? "Select fields must use only the listed options." : "",
  ].filter(Boolean);

  return `${LIVE_SPEC_START}\nForm fields currently shown in the preview:\n${fields
    .map(fieldLine)
    .join(
      "\n",
    )}\n\nField-specific UI requirements:\n${requirements.map((item) => `- ${item}`).join("\n")}\n${LIVE_SPEC_END}`;
};

const syncPromptWithLiveSpec = (draft: string, fields: HexField[]) => {
  const liveBlock = buildLiveSpecBlock(fields);
  const pattern = new RegExp(`${LIVE_SPEC_START}[\\s\\S]*?${LIVE_SPEC_END}`);
  if (pattern.test(draft)) return draft.replace(pattern, liveBlock);
  return `${draft.trim()}\n\n${liveBlock}`.trim();
};

interface Props {
  open: boolean;
  primaryId: string | null;
  onClose: () => void;
}

export function AddCustomHexDialog({ open, primaryId, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [fields, setFields] = useState<HexField[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const parentLabel = primaryId ? (PRIMARY_LABEL[primaryId] ?? primaryId) : "";
  const generate = useServerFn(generateHexSpec);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const stopBackgroundWheel = (event: globalThis.WheelEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && contentRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("wheel", stopBackgroundWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener("wheel", stopBackgroundWheel, { capture: true });
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  const buildPrompt = (nextFields: HexField[], titleValue = name, purposeValue = purpose) => {
    const title = titleValue.trim() || "Custom hex";
    const slug = slugify(title);
    return `Build a "${title}" hex under "${parentLabel || "this section"}".\n\nPurpose:\n${purposeValue.trim() || "Use the current description from the dialog."}\n\nImplementation steps:\n- Register a new focused tool in src/components/tools/focused-tools.tsx under primaryId "${primaryId}" with parentTitle "${parentLabel}".\n- Add a satellite in src/components/tools/HexToolsTree.tsx and map it in SATELLITE_TO_FOCUS_SLUG to "${slug}".\n- Create src/routes/_app/tools/${slug}.tsx exporting a headerless content component.\n- Add the hex to the /tools sidebar tree in src/routes/_app.tsx.\n- Persist submissions through the generic CRM adapter in src/lib/crm/*; never call HubSpot directly.\n- Match the existing hex/header styling.\n\n${buildLiveSpecBlock(nextFields)}`;
  };

  const syncPromptWithCurrentState = (
    draft: string,
    nextFields: HexField[],
    titleValue = name,
    purposeValue = purpose,
  ) => {
    const title = titleValue.trim() || "Custom hex";
    const slug = slugify(title);
    return syncPromptWithLiveSpec(
      draft || buildPrompt(nextFields, titleValue, purposeValue),
      nextFields,
    )
      .replace(
        /^Build a "[^"]+" hex under "[^"]+"\./,
        `Build a "${title}" hex under "${parentLabel || "this section"}".`,
      )
      .replace(
        /Purpose:\n[\s\S]*?\n\nImplementation steps:/,
        `Purpose:\n${purposeValue.trim() || "Use the current description from the dialog."}\n\nImplementation steps:`,
      )
      .replace(/SATELLITE_TO_FOCUS_SLUG to "[^"]+"/, `SATELLITE_TO_FOCUS_SLUG to "${slug}"`)
      .replace(/src\/routes\/_app\/tools\/[^\s]+\.tsx/, `src/routes/_app/tools/${slug}.tsx`);
  };

  const handleWheelCapture = (event: WheelEvent<HTMLDivElement>) => {
    const scrollArea = scrollAreaRef.current;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!scrollArea || !target) return;

    const scrollable = closestScrollable(target, scrollArea, event.deltaY);
    if (scrollable) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (canScrollInDirection(scrollArea, event.deltaY)) {
      scrollArea.scrollTop += event.deltaY;
    }
  };

  const handleGenerate = async () => {
    if (!primaryId || !name.trim() || !purpose.trim()) {
      toast.error("Give it a name and describe what it should do.");
      return;
    }
    setLoading(true);
    try {
      const spec = await generate({ data: { parentLabel, primaryId, name, purpose } });
      setFields(spec.fields);
      setPrompt(buildPrompt(spec.fields));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (i: number, patch: Partial<HexField>) => {
    if (!fields) return;
    const next = fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    setFields(next);
    setPrompt((draft) => syncPromptWithCurrentState(draft, next));
  };
  const removeField = (i: number) => {
    if (!fields) return;
    const next = fields.filter((_, idx) => idx !== i);
    setFields(next);
    setPrompt((draft) => syncPromptWithCurrentState(draft, next));
  };
  const addField = () => {
    const next = [
      ...(fields ?? []),
      { label: "New field", type: "text", required: false } satisfies HexField,
    ];
    setFields(next);
    setPrompt((draft) => syncPromptWithCurrentState(draft, next));
  };

  const copyText = (text: string) => copyToClipboard(text);


  const copy = async () => {
    const finalPrompt = syncPromptWithCurrentState(prompt, fields ?? []);
    setPrompt(finalPrompt);

    if (await copyText(finalPrompt)) {
      toast.success("Prompt copied — paste it back into Lovable chat");
      return;
    }

    promptTextareaRef.current?.focus();
    promptTextareaRef.current?.select();
    toast.error("Copy blocked by the browser — the prompt is selected now.");
  };

  const reset = () => {
    setName("");
    setPurpose("");
    setFields(null);
    setPrompt("");
    setLoading(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setTimeout(reset, 200);
        }
      }}
    >
      <DialogContent
        ref={contentRef}
        onWheelCapture={handleWheelCapture}
        className="!block max-w-2xl max-h-[90vh] overflow-hidden p-0 border-glass-border bg-background/95 backdrop-blur-xl"
      >
        <div className="flex max-h-[90vh] flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-glass-border/60 p-6 pb-4">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl">
              <IconSpark size={20} className="text-primary" />
              Add a custom hex
            </DialogTitle>
            <DialogDescription>
              Describe the sub-tool you want under{" "}
              <span className="text-foreground">{parentLabel || "this section"}</span>. Lovable AI
              designs the form fields and the build prompt — tweak anything, then paste back into
              chat.
            </DialogDescription>
          </DialogHeader>

          <div
            ref={scrollAreaRef}
            className="min-h-0 flex-1 overflow-y-scroll overscroll-contain px-6 py-5 space-y-5"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name it</Label>
              <Input
                value={name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setName(nextName);
                  if (fields)
                    setPrompt((draft) =>
                      syncPromptWithCurrentState(draft, fields, nextName, purpose),
                    );
                }}
                placeholder="e.g. Webinar request, Booth scan upload, Partner MDF…"
                className="glass border-glass-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">What should it do?</Label>
              <Textarea
                rows={3}
                value={purpose}
                onChange={(e) => {
                  const nextPurpose = e.target.value;
                  setPurpose(nextPurpose);
                  if (fields)
                    setPrompt((draft) =>
                      syncPromptWithCurrentState(draft, fields, name, nextPurpose),
                    );
                }}
                placeholder="In plain English: who fills it out, what info matters (uploads, photos, business cards, CSVs all OK), what happens on submit. Lovable AI takes it from there."
                className="glass border-glass-border"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || !name.trim() || !purpose.trim()}
              className="w-full gap-1.5"
            >
              <IconSpark size={14} />
              {loading ? "Designing…" : fields ? "Regenerate with AI" : "Design with AI"}
            </Button>

            {fields && (
              <>
                <div className="space-y-2 rounded-lg border border-glass-border bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Form preview · edit inline
                    </Label>
                    <button
                      type="button"
                      onClick={addField}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                    >
                      <IconPlus size={12} /> Add field
                    </button>
                  </div>

                  {fields.map((f, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_140px_auto_auto] items-center gap-2 rounded-md border border-glass-border/60 bg-glass/20 p-2"
                    >
                      <Input
                        value={f.label}
                        onChange={(e) => updateField(i, { label: e.target.value })}
                        className="h-8 border-glass-border bg-transparent text-sm"
                      />
                      <Select
                        value={f.type}
                        onValueChange={(v) => updateField(i, { type: v as HexField["type"] })}
                      >
                        <SelectTrigger className="h-8 border-glass-border bg-transparent text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Checkbox
                          checked={f.required}
                          onCheckedChange={(c) => updateField(i, { required: c === true })}
                        />
                        required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        aria-label="Remove field"
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-glass-strong hover:text-foreground"
                      >
                        <IconClose size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Generated prompt <span className="opacity-60">· editable</span>
                  </Label>
                  <Textarea
                    ref={promptTextareaRef}
                    rows={10}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="glass border-glass-border font-mono text-[11px] leading-relaxed overscroll-contain"
                  />
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-glass-border/60 p-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={copy} disabled={!fields} className="gap-1.5">
              Copy prompt <IconArrowRight size={14} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
