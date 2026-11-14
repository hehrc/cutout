import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Scissors,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatClock } from "@/lib/media";
import { extractThumbnails } from "@/lib/thumbs";
import { usePlayer, usePlayerTime } from "@/components/studio/PlayerProvider";
import { useStudio } from "@/store/studio";
import { useEditor } from "@/store/editor";
import { cn } from "@/lib/cn";

export function Timeline() {
  const source = useStudio((state) => state.source);
  const { playing, muted, duration, toggle, seek, step, toggleMute } = usePlayer();
  const time = usePlayerTime();
  const trimStart = useEditor((state) => state.trimStart);
  const trimEnd = useEditor((state) => state.trimEnd);
  const setTrim = useEditor((state) => state.setTrim);

  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  const dragEdgeRef = useRef<"start" | "end" | null>(null);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setThumbs([]);
    void extractThumbnails(source.url, 12).then((frames) => {
      if (!cancelled) setThumbs(frames);
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source) return null;

  const total = duration || source.duration || 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, time / total)) : 0;
  const end = trimEnd > 0 ? Math.min(trimEnd, total) : total;
  const start = Math.min(trimStart, Math.max(0, end - 0.1));
  const startRatio = total > 0 ? Math.min(1, Math.max(0, start / total)) : 0;
  const endRatio = total > 0 ? Math.min(1, Math.max(0, end / total)) : 1;
  const trimmed = start > 0.02 || (trimEnd > 0 && trimEnd < total - 0.02);
  const minGap = Math.min(0.5, total * 0.1);

  const seekFromPointer = (clientX: number) => {
    const element = trackRef.current;
    if (!element || !total) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seek(ratio * total);
  };

  const dragTo = (edge: "start" | "end", clientX: number) => {
    const element = trackRef.current;
    if (!element || !total) return;
    const rect = element.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const value = ratio * total;

    if (edge === "start") {
      const next = Math.min(Math.max(0, value), Math.max(0, end - minGap));
      setTrim(next, trimEnd);
      seek(next);
    } else {
      const next = Math.max(start + minGap, Math.min(total, value));
      setTrim(trimStart, next >= total - 0.02 ? 0 : next);
      seek(Math.min(next, Math.max(0, total - 0.03)));
    }
  };

  return (
    <section
      aria-label="Timeline"
      className="shrink-0 border-t border-stage-line bg-paper px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] sm:px-3 lg:px-4"
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous frame"
          className="grid h-9 w-9 place-items-center rounded-full text-ink/65 transition-colors hover:bg-ink/6 hover:text-ink sm:h-8 sm:w-8"
        >
          <StepBack className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper shadow-[0_8px_20px_-10px_rgba(11,11,15,0.7)] transition-transform duration-150 active:scale-95 sm:h-9 sm:w-9"
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>

        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next frame"
          className="grid h-9 w-9 place-items-center rounded-full text-ink/65 transition-colors hover:bg-ink/6 hover:text-ink sm:h-8 sm:w-8"
        >
          <StepForward className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>

        <span className="ml-0.5 font-mono text-[10px] text-ink/70 tabular-nums sm:ml-1.5">
          {formatClock(time, true)}
          <span className="mx-1 text-ink/25">/</span>
          <span className="text-muted-dark">{formatClock(total, true)}</span>
        </span>

        {trimmed && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-coral/35 bg-coral/8 px-2 py-1 font-mono text-[8.5px] tracking-[0.06em] text-coral tabular-nums">
            <Scissors className="h-2.5 w-2.5" />
            {formatClock(start, true)}–{formatClock(end, true)}
            <button
              type="button"
              onClick={() => {
                setTrim(0, 0);
                seek(0);
              }}
              aria-label="Reset trim"
              className="ml-0.5 grid h-3.5 w-3.5 place-items-center rounded-full text-coral/80 transition-colors hover:bg-coral/15 hover:text-coral"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className="hidden font-mono text-[8.5px] tracking-[0.12em] text-muted-dark uppercase md:inline">
            frame{" "}
            {Math.min(
              Math.max(1, Math.round(total * 30)),
              Math.floor(time * 30) + 1,
            )}{" "}
            / {Math.max(1, Math.round(total * 30))}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute preview" : "Mute preview"}
            className="grid h-9 w-9 place-items-center rounded-full text-ink/65 transition-colors hover:bg-ink/6 hover:text-ink sm:h-8 sm:w-8"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Scrub timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(total * 30)}
        aria-valuenow={Math.round(time * 30)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setScrubbing(true);
          seekFromPointer(event.clientX);
        }}
        onPointerMove={(event) => {
          if (scrubbing) seekFromPointer(event.clientX);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setScrubbing(false);
        }}
        onPointerCancel={() => setScrubbing(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          } else if (event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "relative h-[62px] touch-none overflow-hidden rounded-xl bg-paper-deep ring-1 ring-ink/8 ring-inset sm:h-[54px]",
          scrubbing ? "cursor-grabbing" : "cursor-ew-resize",
        )}
      >
        <div className="pointer-events-none absolute inset-0 flex">
          {thumbs.length > 0
            ? thumbs.map((frame, index) => (
                <img
                  key={`${index}-${frame.slice(-24)}`}
                  src={frame}
                  alt=""
                  draggable={false}
                  className="h-full min-w-0 flex-1 object-cover opacity-85"
                />
              ))
            : source.poster && (
                <img
                  src={source.poster}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover opacity-45"
                />
              )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-paper/10" />

        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-ink/18"
          style={{
            width: `${progress * 100}%`,
            transition: scrubbing ? "none" : "width 90ms linear",
          }}
        />

        {/* Outside-trim shading */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-20 bg-paper/62"
          style={{ width: `${startRatio * 100}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 bg-paper/62"
          style={{ width: `${(1 - endRatio) * 100}%` }}
        />

        {/* Trim band */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 border-x-2 border-coral/90"
          style={{
            left: `${startRatio * 100}%`,
            width: `${Math.max(0, (endRatio - startRatio) * 100)}%`,
          }}
        />

        <div
          className="pointer-events-none absolute inset-y-0 z-30"
          style={{
            left: `${progress * 100}%`,
            transition: scrubbing ? "none" : "left 90ms linear",
          }}
        >
          <div className="absolute inset-y-0 -left-px w-0.5 bg-coral" />
          <div className="absolute top-0 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-paper bg-coral shadow-sm" />
        </div>

        {/* In / out handles */}
        <button
          type="button"
          aria-label="Trim start"
          title="Trim start"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragEdgeRef.current = "start";
          }}
          onPointerMove={(event) => {
            if (dragEdgeRef.current === "start") dragTo("start", event.clientX);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragEdgeRef.current = null;
          }}
          onPointerCancel={() => { dragEdgeRef.current = null; }}
          className="absolute inset-y-0 z-40 w-8 -translate-x-1/2 cursor-ew-resize touch-none sm:w-3"
          style={{ left: `${startRatio * 100}%` }}
        >
          <span className="absolute inset-y-1 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-coral shadow-[0_0_0_1px_rgba(252,250,245,0.9)]" />
          <span className="absolute top-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-[4px] border border-paper/80 bg-coral sm:h-3 sm:w-3 sm:rounded-[3px]" />
        </button>

        <button
          type="button"
          aria-label="Trim end"
          title="Trim end"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragEdgeRef.current = "end";
          }}
          onPointerMove={(event) => {
            if (dragEdgeRef.current === "end") dragTo("end", event.clientX);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            event.currentTarget.releasePointerCapture(event.pointerId);
            dragEdgeRef.current = null;
          }}
          onPointerCancel={() => { dragEdgeRef.current = null; }}
          className="absolute inset-y-0 z-40 w-8 -translate-x-1/2 cursor-ew-resize touch-none sm:w-3"
          style={{ left: `${endRatio * 100}%` }}
        >
          <span className="absolute inset-y-1 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-coral shadow-[0_0_0_1px_rgba(252,250,245,0.9)]" />
          <span className="absolute top-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-[4px] border border-paper/80 bg-coral sm:h-3 sm:w-3 sm:rounded-[3px]" />
        </button>
      </div>
    </section>
  );
}
