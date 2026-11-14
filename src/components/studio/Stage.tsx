import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Brush,
  Columns2,
  Eraser,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { ASPECTS, backdropById } from "@/lib/presets";
import { BRUSH_WINDOW, type BrushPoint } from "@/lib/brush";
import { usePlayer, usePlayerTime } from "@/components/studio/PlayerProvider";
import { useEditor } from "@/store/editor";
import { useStudio } from "@/store/studio";
import { useMatteEngine } from "@/hooks/useMatteEngine";
import { cn } from "@/lib/cn";

export function Stage() {
  const source = useStudio((state) => state.source);
  const aspect = useEditor((state) => state.aspect);
  const backdrop = useEditor((state) => state.backdrop);
  const brushActive = useEditor((state) => state.brushActive);
  const brushMode = useEditor((state) => state.brushMode);
  const brushSize = useEditor((state) => state.brushSize);
  const strokeCount = useEditor((state) => state.strokes.length);
  const compare = useEditor((state) => state.compare);
  const { attach, playing, muted, toggle, toggleMute, video } = usePlayer();
  const setBrushActive = useEditor((state) => state.setBrushActive);
  const addStroke = useEditor((state) => state.addStroke);
  const setCompare = useEditor((state) => state.setCompare);

  const { status, progress, error, fps, firstFrame, attachVideo, attachCanvas, reprocess } =
    useMatteEngine(source);

  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<BrushPoint[] | null>(null);
  const [split, setSplit] = useState(0.5);
  const draggingSplitRef = useRef(false);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleAttach = (el: HTMLVideoElement | null) => {
    attach(el);
    attachVideo(el);
  };

  const ratio = useMemo(() => {
    if (!source) return 16 / 9;
    if (aspect === "source") return source.width / Math.max(1, source.height);
    return ASPECTS.find((option) => option.id === aspect)?.ratio ?? 16 / 9;
  }, [aspect, source]);

  const frame = useMemo(() => {
    if (!box.width || !box.height) return { width: 0, height: 0 };
    let width = box.width;
    let height = width / ratio;
    if (height > box.height) {
      height = box.height;
      width = height * ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  }, [box, ratio]);

  if (!source) return null;

  const descriptor = backdropById(backdrop);
  const transparent = descriptor.kind === "none";
  const matteReady = status === "ready" && firstFrame;
  const showCompare = compare && matteReady && !brushActive;

  const pointFromEvent = (event: ReactPointerEvent): BrushPoint => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const startStroke = (event: ReactPointerEvent) => {
    if (!brushActive) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      frameRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that already ended (fast tap) can't be captured; painting
      // still works without it.
    }
    setDraft([pointFromEvent(event)]);
  };

  const moveStroke = (event: ReactPointerEvent) => {
    if (!draft) return;
    const next = pointFromEvent(event);
    const last = draft[draft.length - 1];
    if (!last) return;
    const rect = frameRef.current?.getBoundingClientRect();
    const dx = (next.x - last.x) * (rect?.width ?? 1);
    const dy = (next.y - last.y) * (rect?.height ?? 1);
    if (Math.hypot(dx, dy) < 2) return;
    setDraft([...draft, next]);
  };

  const endStroke = (event: ReactPointerEvent) => {
    if (!draft) return;
    event.stopPropagation();
    try {
      frameRef.current?.releasePointerCapture?.(event.pointerId);
    } catch {
      // Capture may never have been established; nothing to release.
    }
    if (draft.length) {
      addStroke({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${strokeCount}`,
        mode: brushMode,
        size: brushSize,
        time: video?.currentTime ?? 0,
        points: draft,
      });
    }
    setDraft(null);
  };

  const updateSplit = (event: ReactPointerEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSplit(Math.min(0.98, Math.max(0.02, (event.clientX - rect.left) / rect.width)));
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-stage"
      style={descriptor.css ? { background: descriptor.css } : undefined}
    >
      <div
        ref={wrapRef}
        className={cn(
          "absolute inset-0 flex items-center justify-center px-2.5 pt-2.5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8",
          // Reserve a strip under the preview for the brush bar on phone and
          // tablet layouts, where the bar sits outside the frame.
          brushActive ? "pb-16 lg:pb-8" : "pb-2.5 sm:pb-6 lg:pb-8",
        )}
      >
        <div
          className="pointer-events-none relative"
          style={{
            width: frame.width,
            height: frame.height,
            opacity: visible ? 1 : 0,
            transition:
              "width 320ms var(--ease-out), height 320ms var(--ease-out), opacity 240ms ease",
          }}
        >
          <div
            ref={frameRef}
            className={cn(
              "group pointer-events-auto relative h-full w-full touch-manipulation overflow-hidden rounded-[14px] shadow-[0_28px_80px_-32px_rgba(23,20,14,0.6)] ring-1 ring-ink/10 select-none sm:rounded-[16px]",
              transparent ? "checkerboard" : "bg-ink",
              brushActive && "cursor-crosshair",
            )}
            style={brushActive ? { touchAction: "none" } : undefined}
            onClick={() => {
              if (!brushActive) toggle();
            }}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={() => setDraft(null)}
            role="button"
            tabIndex={-1}
            aria-label={
              brushActive
                ? "Paint matte corrections"
                : playing
                  ? "Pause preview"
                  : "Play preview"
            }
          >
            <video
              ref={handleAttach}
              src={source.url}
              poster={source.poster}
              playsInline
              muted
              loop
              preload="auto"
              onLoadedData={() => setVisible(true)}
              onCanPlay={() => setVisible(true)}
              style={
                showCompare
                  ? { clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }
                  : undefined
              }
              aria-label={`Preview of ${source.name}`}
              className={cn(
                "h-full w-full object-cover transition-opacity duration-300",
                showCompare && "z-10",
                matteReady && !showCompare ? "opacity-0" : "opacity-100",
              )}
            />

            <canvas
              ref={attachCanvas}
              aria-label="Segmented preview with the local matte applied"
              className={cn(
                "pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300",
                matteReady ? "opacity-100" : "opacity-0",
              )}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2.5 sm:gap-3 sm:p-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/40 px-2.5 py-1 font-mono text-[8.5px] tracking-[0.14em] text-white/80 uppercase backdrop-blur-md">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "error"
                      ? "bg-coral"
                      : playing
                        ? "bg-lime"
                        : "bg-white/50",
                  )}
                  style={
                    playing && status !== "error"
                      ? { animation: "pulse-dot 2s ease-in-out infinite" }
                      : undefined
                  }
                />
                {status === "loading"
                  ? "loading matte"
                  : status === "error"
                    ? "model error"
                    : status === "ready" && !firstFrame
                      ? "warming matte"
                      : matteReady
                        ? playing
                          ? "live matte"
                          : fps
                            ? `matte · ${fps} fps`
                            : "matte ready"
                        : "preview"}
              </span>

              <div className="pointer-events-auto flex items-center gap-1">
                {matteReady && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!compare) setBrushActive(false);
                      setCompare(!compare);
                    }}
                    aria-pressed={compare}
                    aria-label="Toggle before and after comparison"
                    title="Before / after"
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition-colors sm:h-7 sm:w-7",
                      compare
                        ? "border-lime/50 bg-lime/25 text-lime"
                        : "border-white/12 bg-black/40 text-white/75 hover:bg-black/60 hover:text-white",
                    )}
                  >
                    <Columns2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setBrushActive(!brushActive);
                    if (!brushActive) setCompare(false);
                  }}
                  aria-pressed={brushActive}
                  aria-label="Toggle keep and erase brush"
                  title="Keep / erase brush"
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-full border backdrop-blur-md transition-colors sm:h-7 sm:w-7",
                    brushActive
                      ? "border-lime/50 bg-lime/25 text-lime"
                      : "border-white/12 bg-black/40 text-white/75 hover:bg-black/60 hover:text-white",
                  )}
                >
                  <Brush className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </button>
                <span className="hidden rounded-full border border-white/12 bg-black/40 px-2.5 py-1 font-mono text-[8.5px] tracking-[0.12em] text-white/65 backdrop-blur-md sm:inline">
                  {source.width}×{source.height}
                </span>
              </div>
            </div>

            {brushActive && status !== "loading" && status !== "error" && (
              <div
                className="absolute inset-x-3 bottom-14 z-30 hidden items-center rounded-full border border-white/12 bg-black/70 p-1 backdrop-blur-md lg:flex"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <BrushControls />
              </div>
            )}

            {draft && (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 h-full w-full"
                viewBox={`0 0 ${Math.max(1, frame.width)} ${Math.max(1, frame.height)}`}
                preserveAspectRatio="none"
              >
                <polyline
                  points={draft
                    .map((point) => `${point.x * frame.width},${point.y * frame.height}`)
                    .join(" ")}
                  fill="none"
                  stroke={brushMode === "keep" ? "#c7f464" : "#ff5a36"}
                  strokeOpacity={0.6}
                  strokeWidth={Math.max(
                    1,
                    brushSize * Math.min(frame.width, frame.height),
                  )}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}

            {showCompare && (
              <div
                className="pointer-events-none absolute inset-y-0 z-30"
                style={{ left: `${split * 100}%` }}
              >
                <div className="absolute inset-y-0 -left-px w-0.5 bg-paper/80 shadow-[0_0_0_1px_rgba(11,11,15,0.25)]" />
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggingSplitRef.current = true;
                    updateSplit(event);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    if (draggingSplitRef.current) updateSplit(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    draggingSplitRef.current = false;
                  }}
                  onPointerCancel={() => { draggingSplitRef.current = false; }}
                  aria-label="Drag to compare before and after"
                  className="pointer-events-auto absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full border border-white/30 bg-ink/75 text-paper backdrop-blur-md transition-transform hover:scale-105"
                >
                  <Columns2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {showCompare && (
              <>
                <span className="pointer-events-none absolute top-12 left-3 z-20 rounded-full border border-white/12 bg-black/45 px-2 py-0.5 font-mono text-[8px] tracking-[0.14em] text-white/70 uppercase backdrop-blur-md">
                  original
                </span>
                <span className="pointer-events-none absolute top-12 right-3 z-20 rounded-full border border-white/12 bg-black/45 px-2 py-0.5 font-mono text-[8px] tracking-[0.14em] text-white/70 uppercase backdrop-blur-md">
                  cutout
                </span>
              </>
            )}

            {(status === "loading" || (status === "ready" && !firstFrame)) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/90 px-6 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-lime" />
                <div>
                  <p className="font-display text-[14px] font-medium text-paper">
                    {status === "loading"
                      ? "Loading local matte engine"
                      : "Warming up the matte"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-[0.08em] text-white/55">
                    {status === "loading"
                      ? `${Math.round(progress * 100)}% · U²-Netp · WASM`
                      : "first pass · on device"}
                  </p>
                </div>
                <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-lime transition-[width] duration-200"
                    style={{
                      width:
                        status === "loading"
                          ? `${Math.max(4, Math.round(progress * 100))}%`
                          : "100%",
                    }}
                  />
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink/92 px-6 text-center">
                <Zap className="h-7 w-7 text-coral" />
                <div>
                  <p className="font-display text-[14px] font-medium text-paper">
                    Matte engine unavailable
                  </p>
                  <p className="mt-1 max-w-xs font-mono text-[10px] leading-relaxed text-white/55">
                    {error ?? "The segmentation model could not start."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    reprocess();
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-paper transition-colors hover:bg-white/10"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry matte
                </button>
              </div>
            )}

            {!playing &&
              !brushActive &&
              status !== "loading" &&
              status !== "error" && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle();
                  }}
                  aria-label="Play preview"
                  className="absolute top-1/2 left-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-ink/55 text-paper backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-ink/70"
                >
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                </button>
              )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-t from-black/55 to-transparent px-2.5 pt-8 pb-2 sm:px-3 sm:pb-3">
              <StageClock duration={source.duration} />
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle();
                  }}
                  aria-label={playing ? "Pause preview" : "Play preview"}
                  className="grid h-9 w-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white sm:h-8 sm:w-8"
                >
                  {playing ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleMute();
                  }}
                  aria-label={muted ? "Unmute preview" : "Mute preview"}
                  className="grid h-9 w-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white sm:h-8 sm:w-8"
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {brushActive && (
              <span className="pointer-events-none absolute top-12 left-2.5 z-20 rounded-full bg-black/45 px-2 py-0.5 font-mono text-[8.5px] tracking-[0.08em] text-white/70 backdrop-blur-md sm:left-3">
                paint holds ±{BRUSH_WINDOW.toFixed(2)}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/*
        Below the large breakpoint the preview frame is small and its bottom
        edge carries the transport controls, so the brush bar lives in the
        empty stage area underneath the frame instead of covering the subject.
      */}
      {brushActive && status !== "loading" && status !== "error" && (
        <div
          className="absolute inset-x-2 bottom-2 z-30 flex lg:hidden"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="flex w-full items-center rounded-2xl border border-white/12 bg-black/70 p-1 backdrop-blur-md">
            <BrushControls />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The keep/erase brush bar. Shared by the in-frame (desktop) and below-frame
 * (phone/tablet) placements so both stay in sync with the editor store.
 */
function BrushControls() {
  const source = useStudio((state) => state.source);
  const brushMode = useEditor((state) => state.brushMode);
  const brushSize = useEditor((state) => state.brushSize);
  const setBrushSize = useEditor((state) => state.setBrushSize);
  const setBrushMode = useEditor((state) => state.setBrushMode);
  const setBrushActive = useEditor((state) => state.setBrushActive);
  const clearStrokes = useEditor((state) => state.clearStrokes);
  const strokeCount = useEditor((state) => state.strokes.length);

  if (!source) return null;
  const brushPx = Math.round(brushSize * Math.min(source.width, source.height));

  return (
    <div className="flex w-full items-center gap-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setBrushMode("keep");
        }}
        aria-pressed={brushMode === "keep"}
        aria-label="Keep brush"
        title="Keep brush"
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors sm:px-3",
          brushMode === "keep"
            ? "bg-lime text-[#16200a]"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <Brush className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Keep</span>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setBrushMode("erase");
        }}
        aria-pressed={brushMode === "erase"}
        aria-label="Erase brush"
        title="Erase brush"
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors sm:px-3",
          brushMode === "erase"
            ? "bg-coral text-[#1a0c07]"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <Eraser className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Erase</span>
      </button>
      <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setBrushSize(Math.max(0.02, brushSize - 0.01));
          }}
          aria-label="Smaller brush"
          className="grid h-9 w-9 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center font-mono text-[9.5px] text-white/65 tabular-nums">
          {brushPx}px
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setBrushSize(Math.min(0.2, brushSize + 0.01));
          }}
          aria-label="Larger brush"
          className="grid h-9 w-9 place-items-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          clearStrokes();
        }}
        disabled={strokeCount === 0}
        aria-label="Clear brush corrections"
        title="Clear corrections"
        className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setBrushActive(false);
        }}
        aria-label="Stop painting"
        className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StageClock({ duration }: { duration: number }) {
  const time = usePlayerTime();
  return (
    <span className="font-mono text-[9.5px] text-white/75 tabular-nums">
      {formatTime(time)} / {formatTime(duration)}
    </span>
  );
}

function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}
