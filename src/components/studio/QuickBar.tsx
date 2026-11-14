import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Brush, Columns2, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEditor } from "@/store/editor";

/**
 * One-tap row for the phone layout. The full panel is a swipe away, but the
 * actions people reach for most — keep the main subject, auto-tune the edge,
 * paint a fix, compare — stay right under the preview where the thumb is.
 */
export function QuickBar() {
  const subjectLock = useEditor((state) => state.subjectLock);
  const setSubjectLock = useEditor((state) => state.setSubjectLock);
  const requestAutoEdge = useEditor((state) => state.requestAutoEdge);
  const brushActive = useEditor((state) => state.brushActive);
  const setBrushActive = useEditor((state) => state.setBrushActive);
  const compare = useEditor((state) => state.compare);
  const setCompare = useEditor((state) => state.setCompare);

  return (
    <div className="grid shrink-0 grid-cols-4 gap-1.5 border-t border-stage-line bg-paper px-2.5 py-2 lg:hidden">
      <QuickButton
        active={subjectLock}
        onClick={() => setSubjectLock(!subjectLock)}
        label="Subject"
        aria-label="Keep only the main subject"
        aria-pressed={subjectLock}
      >
        <Sparkles className="h-4 w-4" />
      </QuickButton>
      <QuickButton onClick={requestAutoEdge} label="Auto edge">
        <Wand2 className="h-4 w-4" />
      </QuickButton>
      <QuickButton
        active={brushActive}
        onClick={() => {
          setBrushActive(!brushActive);
          if (!brushActive) setCompare(false);
        }}
        label="Brush"
        aria-pressed={brushActive}
      >
        <Brush className="h-4 w-4" />
      </QuickButton>
      <QuickButton
        active={compare}
        onClick={() => {
          setCompare(!compare);
          if (!compare) setBrushActive(false);
        }}
        label="Compare"
        aria-pressed={compare}
      >
        <Columns2 className="h-4 w-4" />
      </QuickButton>
    </div>
  );
}

function QuickButton({
  active,
  onClick,
  label,
  children,
  ...rest
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] leading-none font-semibold transition-colors active:scale-[0.98]",
        active
          ? "border-ink bg-ink text-paper"
          : "border-ink/12 text-ink/70 hover:border-ink/25 hover:bg-ink/4 hover:text-ink",
      )}
      {...rest}
    >
      {children}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
