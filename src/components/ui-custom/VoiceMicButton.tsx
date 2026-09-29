import { Mic, MicOff } from "lucide-react";
import { useVoiceDictation, isVoiceDictationSupported } from "@/hooks/use-voice-dictation";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  size?: number;
  label?: string;
}

/**
 * Single-button mic toggle that appends dictated speech to the bound input.
 * Hides itself entirely when the browser doesn't support Web Speech.
 */
export function VoiceMicButton({ value, onChange, className, size = 16, label = "Dictate" }: Props) {
  const { listening, toggle, supported } = useVoiceDictation({
    onTranscript: onChange,
    getCurrentValue: () => value,
  });

  if (!supported && !isVoiceDictationSupported()) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop dictation" : label}
      title={listening ? "Stop dictation" : "Hold to dictate (Web Speech)"}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full border transition-colors",
        listening
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-glass-border bg-glass/50 text-muted-foreground hover:text-foreground hover:bg-glass",
        className,
      )}
    >
      {listening ? <MicOff size={size} /> : <Mic size={size} />}
      {listening && (
        <span className="pointer-events-none absolute -inset-0.5 animate-ping rounded-full border border-primary/40" />
      )}
    </button>
  );
}
