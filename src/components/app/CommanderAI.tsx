import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Link, useNavigate, useLocation, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceMicButton } from "@/components/ui-custom/VoiceMicButton";
import { isVoiceDictationSupported } from "@/hooks/use-voice-dictation";
import { Check, Copy, X } from "lucide-react";
import { useDraft } from "@/hooks/use-draft";
import { CommanderOrb } from "./CommanderOrb";
import {
  runCommanderTurn,
  executeCommanderAction,
  type CommanderMessage,
  type CommanderTurn,
  type ProposedAction,
  type ClarificationQuestion,
} from "@/lib/commander.functions";
import { BRAND } from "@/lib/brand";

type ExecutedAction = {
  tool: ProposedAction["tool"];
  summary: string;
  action: ProposedAction;
  result?: Record<string, unknown>;
  error?: string;
};

type Bubble =
  | { id: string; role: "user"; text: string; hidden?: boolean }
  | { id: string; role: "commander"; turn: CommanderTurn; resolved?: boolean }
  | { id: string; role: "commander"; executed: ExecutedAction[] };

// Tools that don't mutate user-visible content — auto-execute without a Confirm step.
const AUTO_EXECUTE_TOOLS = new Set<ProposedAction["tool"]>([
  "create_utm_link",
  "add_checklist_item",
  "toggle_checklist_item",
]);

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function describePage(pathname: string): string {
  if (pathname.startsWith("/campaigns/")) return "Campaign detail page";
  if (pathname.startsWith("/campaigns")) return "Campaigns list";
  if (pathname.startsWith("/dashboard")) return "This week dashboard";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/funnel")) return "Funnel";
  if (pathname.startsWith("/requests")) return "Requests";
  if (pathname.startsWith("/templates")) return "Templates";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/tools")) return `Tool: ${pathname.replace("/tools/", "") || "tools hub"}`;
  return pathname;
}

export function CommanderAI() {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useDraft<Bubble[]>("commander.bubbles", []);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const navigate = useNavigate();
  const loc = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const params = useParams({ strict: false }) as { id?: string };
  const currentCampaignId = loc.pathname.startsWith("/campaigns/") ? (params.id ?? null) : null;
  const pageContext = describePage(loc.pathname);

  const runTurn = useServerFn(runCommanderTurn);
  const runAction = useServerFn(executeCommanderAction);

  // ⌘K / ctrl+K to toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-focus & scroll
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [bubbles, open, thinking]);

  // Voice dictation is owned by the VoiceMicButton itself when given value/onChange.



  const messagesForServer: CommanderMessage[] = useMemo(() => {
    return bubbles.flatMap<CommanderMessage>((b) => {
      if (b.role === "user") return [{ role: "user", content: b.text }];
      if ("executed" in b) {
        return [{
          role: "assistant",
          content: `Executed: ${b.executed.map((e) => e.summary + (e.error ? ` (failed: ${e.error})` : "")).join("; ")}`,
        }];
      }
      const t = b.turn;
      if (t.kind === "text" || t.kind === "read") return [{ role: "assistant", content: t.text }];
      if (t.kind === "navigate") return [{ role: "assistant", content: t.text ?? `(Navigated to ${t.path})` }];
      if (t.kind === "clarify") return [{ role: "assistant", content: `${t.intro} — asked: ${t.questions.map((q: ClarificationQuestion) => q.question).join(" | ")}` }];
      if (t.kind === "propose") return [{ role: "assistant", content: `${t.intro} — proposed: ${t.actions.map((a: ProposedAction) => a.summary).join("; ")}` }];
      return [];
    });
  }, [bubbles]);

  const executeActions = useCallback(
    async (actions: ProposedAction[], resolveBubbleId?: string) => {
      setThinking(true);
      const executed: ExecutedAction[] = [];
      let navTarget: string | null = null;
      for (const a of actions) {
        try {
          const res = await runAction({ data: { action: a } });
          const r = res as { result?: Record<string, unknown>; navigate?: string } | undefined;
          executed.push({ tool: a.tool, summary: a.summary, action: a, result: r?.result });
          if (r?.navigate) navTarget = r.navigate;
        } catch (err) {
          executed.push({ tool: a.tool, summary: a.summary, action: a, error: err instanceof Error ? err.message : "failed" });
        }
      }
      setBubbles((prev) => {
        const updated = resolveBubbleId
          ? prev.map((b) => (b.id === resolveBubbleId && "turn" in b ? { ...b, resolved: true } : b))
          : prev;
        return [...updated, { id: newId(), role: "commander", executed }];
      });
      setThinking(false);
      const ok = executed.filter((e) => !e.error).length;
      const failed = executed.filter((e) => e.error).length;
      if (failed === 0 && ok > 0) toast.success(`${ok} action${ok === 1 ? "" : "s"} complete`);
      if (navTarget) {
        setOpen(false);
        setTimeout(() => navigate({ to: navTarget as never }), 120);
      }
    },
    [navigate, runAction, setBubbles],
  );

  const send = useCallback(
    async (text: string, opts: { silent?: boolean } = {}) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;
      const userBubble: Bubble = { id: newId(), role: "user", text: trimmed, hidden: opts.silent };
      setBubbles([...bubbles, userBubble]);
      if (!opts.silent) setInput("");
      setThinking(true);
      try {
        const { turn } = await runTurn({
          data: {
            messages: [
              ...messagesForServer,
              { role: "user", content: trimmed },
            ],
            pageContext,
            currentCampaignId,
          },
        });
        // Defensive: drop any malformed actions the model may have returned.
        if (turn.kind === "propose") {
          turn.actions = (turn.actions ?? []).filter(
            (a): a is ProposedAction => !!a && typeof (a as ProposedAction).tool === "string",
          );
        }
        // Auto-execute when every proposed action is a safe utility action.
        if (turn.kind === "propose" && turn.actions.length > 0 && turn.actions.every((a) => AUTO_EXECUTE_TOOLS.has(a.tool))) {
          setThinking(false);
          await executeActions(turn.actions);
          return;
        }
        setBubbles((prev) => [...prev, { id: newId(), role: "commander", turn }]);
        if (turn.kind === "navigate") {
          setOpen(false);
          setTimeout(() => navigate({ to: turn.path as never }), 120);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Commander hit an error.";
        toast.error(msg);
        setBubbles((prev) => [...prev, { id: newId(), role: "commander", turn: { kind: "text", text: msg } }]);
      } finally {
        setThinking(false);
      }
    },
    [bubbles, currentCampaignId, executeActions, messagesForServer, navigate, pageContext, runTurn, setBubbles, thinking],
  );

  const dismissBubble = useCallback(
    (bubbleId: string, note: string) => {
      setBubbles((prev) =>
        prev
          .map((b) => (b.id === bubbleId && "turn" in b ? { ...b, resolved: true } : b))
          .concat([{ id: newId(), role: "commander", turn: { kind: "text", text: note } }]),
      );
    },
    [setBubbles],
  );

  const submitClarification = useCallback(
    (bubbleId: string, questions: ClarificationQuestion[], answers: Record<string, string>) => {
      setBubbles((prev) => prev.map((b) => (b.id === bubbleId && "turn" in b ? { ...b, resolved: true } : b)));
      const summary = questions
        .map((q) => `${q.question} → ${answers[q.id]?.trim() || "(skipped)"}`)
        .join("\n");
      // Send silently — no need to echo the user's answers as a chat bubble.
      void send(summary, { silent: true });
    },
    [send],
  );

  const reset = useCallback(() => {
    setBubbles([]);
    setThinking(false);
    setInput("");
  }, [setBubbles]);

  // Backward-compat wrapper used by ProposeCard (kept for non-auto-executable proposals).
  const confirmActions = useCallback(
    (bubbleId: string, actions: ProposedAction[]) => executeActions(actions, bubbleId),
    [executeActions],
  );

  const retryAction = useCallback(
    (action: ProposedAction) => void executeActions([action]),
    [executeActions],
  );

  return (
    <>
      {!open && (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ask ${BRAND.shortName} AI`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-[0_8px_40px_-8px_oklch(0.78_0.2_280/0.7)] backdrop-blur-xl md:hidden"
        >
          <CommanderOrb size={40} active />
        </motion.button>
      )}
    <Dialog open={open} onOpenChange={setOpen}>

      <DialogContent
        className="max-w-2xl gap-0 overflow-hidden border-glass-border bg-[color:var(--color-ink)]/95 p-0 backdrop-blur-2xl origin-bottom-right data-[state=open]:!slide-in-from-bottom-[60%] data-[state=open]:!slide-in-from-right-[60%] data-[state=closed]:!slide-out-to-bottom-[60%] data-[state=closed]:!slide-out-to-right-[60%] data-[state=open]:!zoom-in-90 data-[state=closed]:!zoom-out-90 [&>button.absolute]:hidden"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Commander</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <CommanderOrb size={18} active={thinking} />
            <span className="text-sm font-medium text-foreground">Commander</span>
            {thinking && (
              <span className="text-xs text-muted-foreground">thinking…</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {bubbles.length > 0 && (
              <button
                onClick={reset}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-glass/40 hover:text-foreground"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-glass/40 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} data-lenis-prevent className="max-h-[55vh] min-h-[200px] overflow-y-auto overscroll-contain px-5">
          {bubbles.length === 0 && !thinking && (
            <EmptyState pathname={loc.pathname} onPick={(t) => void send(t)} />
          )}
          <div className="space-y-3 pb-2">
            <AnimatePresence initial={false}>
              {bubbles.map((b) => {
                if (b.role === "user") {
                  if (b.hidden) return null;
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-glass-border bg-glass/50 px-3.5 py-2 text-sm text-foreground"
                    >
                      {b.text}
                    </motion.div>
                  );
                }
                if ("executed" in b) {
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex max-w-[92%] gap-2.5"
                    >
                      <CommanderOrb size={20} />
                      <div className="flex-1">
                        <ResultCard executed={b.executed} onRetry={retryAction} />
                      </div>
                    </motion.div>
                  );
                }
                return (
                  <CommanderBubble
                    key={b.id}
                    bubble={b}
                    onConfirm={(actions) => void confirmActions(b.id, actions)}
                    onDismiss={(note) => dismissBubble(b.id, note)}
                    onClarify={(qs, answers) => submitClarification(b.id, qs, answers)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Composer */}
        <div className="px-5 pb-5 pt-3">
          <div className="flex items-end gap-1.5 rounded-2xl border border-glass-border bg-glass/30 px-2.5 py-1.5 focus-within:border-white/20">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Ask anything…"
              className="min-h-[36px] max-h-[140px] resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0"
              rows={1}
            />
            <div className="flex shrink-0 items-center gap-1 pb-1">
              {isVoiceDictationSupported() && (
                <VoiceMicButton value={input} onChange={setInput} />
              )}
              <Button
                size="sm"
                onClick={() => void send(input)}
                disabled={!input.trim() || thinking}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Send
              </Button>
            </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
    </>
  );

}

// ─── Empty state ────────────────────────────────────────────────────────
function suggestionsForPath(pathname: string): string[] {
  if (pathname.startsWith("/campaigns/"))
    return [
      "Summarize this campaign",
      "Add a checklist item here",
      "Draft a launch email for this",
      "What's blocking this campaign?",
    ];
  if (pathname.startsWith("/campaigns"))
    return [
      "Plan a launch campaign for next month",
      "Show campaigns behind on MQLs",
      "Spin up a webinar campaign",
    ];
  if (pathname.startsWith("/funnel"))
    return [
      "Summarize last week's MQL pacing",
      "Which stage is leaking the most?",
      "Set Q3 SQO targets",
    ];
  if (pathname.startsWith("/calendar"))
    return [
      "What's launching this week?",
      "Find a gap to schedule a webinar",
      "Move next week's campaign to the week after",
    ];
  if (pathname.startsWith("/tools/utm"))
    return [
      "Build a UTM for the spring webinar landing page",
      "Audit utm_source values from last month",
    ];
  if (pathname.startsWith("/dashboard"))
    return [
      "What needs my attention today?",
      "Summarize last week's MQL pacing",
      "Plan a launch campaign for next month",
    ];
  return [
    "Plan a launch campaign",
    "Build a UTM link",
    "Go to the funnel",
  ];
}

function EmptyState({
  pathname,
  onPick,
}: {
  pathname: string;
  onPick: (text: string) => void;
}) {
  const prompts = useMemo(() => suggestionsForPath(pathname), [pathname]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState("");
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");

  useEffect(() => {
    const target = prompts[index] ?? "";
    if (phase === "typing") {
      if (shown.length < target.length) {
        const t = setTimeout(() => setShown(target.slice(0, shown.length + 1)), 28);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("holding"), 1600);
      return () => clearTimeout(t);
    }
    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), 600);
      return () => clearTimeout(t);
    }
    // deleting
    if (shown.length > 0) {
      const t = setTimeout(() => setShown(shown.slice(0, -1)), 14);
      return () => clearTimeout(t);
    }
    setIndex((i) => (i + 1) % prompts.length);
    setPhase("typing");
  }, [shown, phase, index, prompts]);

  return (
    <div className="flex flex-col gap-4 py-10">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Try
      </div>
      <button
        type="button"
        onClick={() => onPick(prompts[index] ?? "")}
        className="group -mx-2 flex min-h-[3.25rem] items-start rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-glass/30"
      >
        <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-xl font-display leading-snug text-transparent">
          {shown}
          <span className="ml-0.5 inline-block h-[1.1em] w-[2px] -translate-y-[2px] animate-pulse bg-primary align-middle" />
        </span>
      </button>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {prompts.map((p, i) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              i === index
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-glass-border bg-glass/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.length > 28 ? `${p.slice(0, 26)}…` : p}
          </button>
        ))}
      </div>
    </div>
  );
}


// ─── Commander bubble (renders all turn kinds) ──────────────────────────
function CommanderBubble({
  bubble,
  onConfirm,
  onDismiss,
  onClarify,
}: {
  bubble: { id: string; role: "commander"; turn: CommanderTurn; resolved?: boolean };
  onConfirm: (actions: ProposedAction[]) => void;
  onDismiss: (note: string) => void;
  onClarify: (qs: ClarificationQuestion[], answers: Record<string, string>) => void;
}) {
  const turn = bubble.turn;
  const resolved = bubble.resolved;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex max-w-[92%] gap-2.5"
    >
      <CommanderOrb size={20} />
      <div className="flex-1 space-y-2">
        {turn.kind === "text" && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{turn.text}</div>
        )}
        {turn.kind === "read" && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{turn.text}</div>
        )}
        {turn.kind === "navigate" && (
          <div className="text-sm text-muted-foreground">
            {turn.text ?? `Taking you to ${turn.path}…`}
          </div>
        )}
        {turn.kind === "clarify" && (
          <ClarifyCard
            intro={turn.intro}
            questions={turn.questions}
            disabled={resolved}
            onSubmit={(answers) => onClarify(turn.questions, answers)}
            onSkip={() => onDismiss("Skipped clarification.")}
          />
        )}
        {turn.kind === "propose" && (
          <ProposeCard
            intro={turn.intro}
            actions={turn.actions}
            disabled={resolved}
            onConfirm={() => onConfirm(turn.actions)}
            onCancel={() => onDismiss("Cancelled — nothing changed.")}
          />
        )}
      </div>
    </motion.div>
  );
}

function ProposeCard({
  intro,
  actions,
  disabled,
  onConfirm,
  onCancel,
}: {
  intro: string;
  actions: ProposedAction[];
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl border border-glass-border bg-glass/50 p-3 backdrop-blur-xl">
      <div className="mb-2 text-sm text-foreground">{intro}</div>
      <ul className="mb-3 space-y-1.5">
        {actions.map((a, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-black/20 px-2.5 py-2 text-sm">
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span className="flex-1 text-foreground">{a.summary}</span>
            <span className="rounded bg-glass px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {a.tool.replace(/_/g, " ")}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={disabled}>
          {disabled ? "Done" : `Confirm ${actions.length === 1 ? "" : `${actions.length} actions`}`.trim()}
        </Button>
      </div>
    </div>
  );
}

function inferFieldKind(q: ClarificationQuestion): "url" | "email" | "number" | "text" {
  const haystack = `${q.id} ${q.question} ${q.placeholder ?? ""}`.toLowerCase();
  if (/(url|link|website|domain|destination|landing|address)/.test(haystack)) return "url";
  if (/email/.test(haystack)) return "email";
  if (/(number|count|target|how many|goal|amount|budget)/.test(haystack)) return "number";
  return "text";
}

function placeholderFor(q: ClarificationQuestion, kind: "url" | "email" | "number" | "text"): string {
  if (q.placeholder) return q.placeholder;
  if (kind === "url") return `e.g. ${BRAND.domain}/spring-webinar`;
  if (kind === "email") return "name@company.com";
  if (kind === "number") return "e.g. 250";
  return "Type your answer…";
}

function validateAnswer(value: string, kind: "url" | "email" | "number" | "text"): string | null {
  const v = value.trim();
  if (!v) return "Required.";
  if (kind === "url") {
    const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(candidate);
      if (!u.hostname.includes(".")) return "That doesn't look like a real URL.";
      return null;
    } catch {
      return "That doesn't look like a real URL.";
    }
  }
  if (kind === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email.";
  }
  if (kind === "number") {
    return /^-?\d+(\.\d+)?$/.test(v) ? null : "Enter a number.";
  }
  return null;
}

function ClarifyCard({
  intro,
  questions,
  disabled,
  onSubmit,
  onSkip,
}: {
  intro: string;
  questions: ClarificationQuestion[];
  disabled?: boolean;
  onSubmit: (answers: Record<string, string>) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const total = questions.length;
  const q = questions[step];
  const current = answers[q?.id ?? ""] ?? "";
  const isLast = step === total - 1;
  const kind = q ? inferFieldKind(q) : "text";
  const required = kind !== "text"; // URLs/emails/numbers shouldn't be skippable
  const error = touched ? validateAnswer(current, kind) : null;

  const advance = () => {
    setTouched(true);
    const err = validateAnswer(current, kind);
    if (err) return;
    setTouched(false);
    if (isLast) onSubmit(answers);
    else setStep((s) => Math.min(s + 1, total - 1));
  };

  if (!q) return null;

  return (
    <div className="rounded-2xl border border-glass-border bg-glass/50 p-3 backdrop-blur-xl">
      {step === 0 && intro && (
        <div className="mb-3 text-sm text-foreground">{intro}</div>
      )}

      {total > 1 && (
        <div className="mb-3 flex items-center gap-1.5">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < step
                  ? "bg-primary/70"
                  : i === step
                    ? "bg-primary"
                    : "bg-glass-border"
              }`}
            />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <div className="mb-2 text-sm text-foreground">{q.question}</div>
          {q.options && q.options.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((opt) => {
                  const picked = current === opt;
                  return (
                    <button
                      key={opt}
                      disabled={disabled}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, [q.id]: opt }));
                        setTouched(false);
                        setTimeout(advance, 140);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        picked
                          ? "border-primary bg-primary/20 text-foreground"
                          : "border-glass-border bg-glass/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={q.options.includes(current) ? "" : current}
                onChange={(e) => {
                  setAnswers((a) => ({ ...a, [q.id]: e.target.value }));
                  setTouched(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    advance();
                  }
                }}
                placeholder="Or type your own…"
                disabled={disabled}
                className="w-full rounded-lg border border-glass-border bg-black/20 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>
          ) : (
            <Textarea
              value={current}
              onChange={(e) => {
                setAnswers((a) => ({ ...a, [q.id]: e.target.value }));
                setTouched(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  advance();
                }
              }}
              placeholder={placeholderFor(q, kind)}
              disabled={disabled}
              rows={2}
              autoFocus
              className={`min-h-[44px] resize-none border-glass-border bg-black/20 ${error ? "border-destructive/60" : ""}`}
            />
          )}
          {error && (
            <div className="mt-1.5 text-[11px] text-destructive">{error}</div>
          )}
          {!error && kind === "url" && current.trim() && !/^https?:\/\//i.test(current.trim()) && (
            <div className="mt-1.5 text-[11px] text-muted-foreground">
              We'll add <span className="font-mono">https://</span> for you.
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTouched(false);
                setStep((s) => Math.max(s - 1, 0));
              }}
              disabled={disabled}
            >
              Back
            </Button>
          ) : (
            !required && (
              <Button variant="ghost" size="sm" onClick={onSkip} disabled={disabled}>
                Skip
              </Button>
            )
          )}
          {total > 1 && (
            <span className="text-[11px] text-muted-foreground">
              {step + 1} of {total}
            </span>
          )}
        </div>
        <Button size="sm" onClick={advance} disabled={disabled}>
          {isLast ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

// ─── Result card for auto-executed / completed actions ─────────────────
function ResultCard({ executed, onRetry }: { executed: ExecutedAction[]; onRetry: (a: ProposedAction) => void }) {
  return (
    <div className="space-y-2">
      {executed.map((e, i) => (
        <ResultRow key={i} item={e} onRetry={() => onRetry(e.action)} />
      ))}
    </div>
  );
}

function ResultRow({ item, onRetry }: { item: ExecutedAction; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);

  if (item.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
        <div className="mb-0.5 text-[11px] uppercase tracking-wider text-destructive">Couldn't finish</div>
        <div>{item.summary}</div>
        <div className="mb-2 text-xs text-muted-foreground">{item.error}</div>
        <div className="flex justify-end">
          <button
            onClick={onRetry}
            className="rounded-md border border-glass-border bg-glass/40 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-glass/60"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (item.tool === "create_utm_link") {
    const finalUrl = (item.result?.final_url as string | undefined) ?? "";
    const label = (item.result?.label as string | undefined) ?? "UTM link";
    const copy = async () => {
      if (!finalUrl) return;
      try {
        await copyToClipboard(finalUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // ignore
      }
    };
    return (
      <div className="space-y-2 rounded-2xl border border-glass-border bg-glass/50 p-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">UTM link ready</span>
          <span className="text-xs text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2.5 py-2">
          <code className="flex-1 truncate text-xs text-foreground">{finalUrl}</code>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md border border-glass-border bg-glass/40 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-glass/60"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex justify-end">
          <Link to="/tools" search={{ focus: "utm" }} className="text-[11px] text-primary hover:underline">
            Open in UTM Builder →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl bg-glass/30 px-3 py-2 text-sm text-foreground">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <span className="flex-1">{item.summary}</span>
    </div>
  );
}
