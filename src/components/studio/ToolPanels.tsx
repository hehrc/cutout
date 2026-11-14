import { useRef, useState, type ReactNode } from "react";
import {
  Brush,
  Check,
  Crop,
  Download,
  Eraser,
  Film,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MonitorPlay,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ASPECTS,
  BACKDROPS,
  EXPORT_PRESETS,
  type AspectId,
  type BackdropId,
  type ExportPresetId,
} from "@/lib/presets";
import { formatBytes } from "@/lib/media";
import { exportSize } from "@/lib/export-meta";
import { useExport } from "@/hooks/useExport";
import { usePlayer } from "@/components/studio/PlayerProvider";
import { useStudio } from "@/store/studio";
import { TOOL_META, useEditor, type ToolId } from "@/store/editor";

const PANEL_TITLES: Record<ToolId, string> = {
  background: "Backdrop",
  refine: "Refine the edge",
  frame: "Frame the cut",
  export: "Export locally",
};

interface ToolPanelsProps {
  onClose?: () => void;
}

export function ToolPanels({ onClose }: ToolPanelsProps) {
  const tool = useEditor((state) => state.tool);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-stage-line px-4 py-3.5 sm:px-5 sm:py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[20px] leading-none font-medium tracking-[-0.02em] text-ink sm:text-[21px]">
              {PANEL_TITLES[tool]}
            </h2>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-dark">
            {TOOL_META[tool].blurb}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-dark transition-colors hover:bg-ink/6 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-6 sm:px-5 sm:py-5">
        {tool === "background" && <BackgroundPanel />}
        {tool === "refine" && <RefinePanel />}
        {tool === "frame" && <FramePanel />}
        {tool === "export" && <ExportPanel />}
      </div>

      <div className="flex items-center gap-2 border-t border-stage-line px-4 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] text-muted-dark sm:px-5 sm:pb-3">
        <Lock className="h-3 w-3 shrink-0" />
        <span className="font-mono text-[8.5px] tracking-[0.12em] uppercase">
          nothing leaves this tab
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full bg-ink px-4 py-1.5 text-[11px] font-bold text-paper transition-transform active:scale-95"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 font-mono text-[9px] font-medium tracking-[0.16em] text-muted-dark uppercase">
      {children}
    </p>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold text-ink/80">{label}</span>
        <span className="rounded-full bg-ink/[0.055] px-2 py-0.5 font-mono text-[10px] text-ink/65 tabular-nums">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="stage-range mt-3 w-full"
      />
      {hint && (
        <span className="mt-1.5 block text-[10.5px] leading-snug text-muted-dark">
          {hint}
        </span>
      )}
    </label>
  );
}

function BackgroundPanel() {
  const backdrop = useEditor((state) => state.backdrop);
  const backdropMedia = useEditor((state) => state.backdropMedia);
  const backdropBlur = useEditor((state) => state.backdropBlur);
  const setBackdrop = useEditor((state) => state.setBackdrop);
  const setBackdropMedia = useEditor((state) => state.setBackdropMedia);
  const setBackdropBlur = useEditor((state) => state.setBackdropBlur);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const chooseMedia = (kind: "image" | "video", file: File | null) => {
    if (!file) return;
    if (kind === "image" && !file.type.startsWith("image/")) {
      setUploadError("Choose an image file (PNG, JPEG, WebP, AVIF).");
      return;
    }
    if (kind === "video" && !file.type.startsWith("video/")) {
      setUploadError("Choose a video file this browser can decode.");
      return;
    }
    if (file.size > 512 * 1024 * 1024) {
      setUploadError("That backdrop is over 512 MB. Try a smaller file.");
      return;
    }
    setUploadError(null);
    setBackdropMedia({
      kind,
      url: URL.createObjectURL(file),
      name: file.name,
    });
  };

  const mediaKind = backdropMedia?.kind ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ink/8 bg-ink/[0.025] p-3.5">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/80">
          <Sparkles className="h-3.5 w-3.5 text-coral" />
          Composited on device
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-dark">
          The matte engine paints your subject over this canvas in real time.
          Colors and gradients render instantly; image and video backdrops loop
          behind the cut without an upload step.
        </p>
      </div>

      <div>
        <SectionLabel>Canvas</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {BACKDROPS.map((option) => {
            const selected = backdrop === option.id;
            const matching =
              backdropMedia && mediaKind === option.kind ? backdropMedia : null;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setBackdrop(option.id as BackdropId);
                  if (option.kind === "image" && !matching) imageInput.current?.click();
                  if (option.kind === "video" && !matching) videoInput.current?.click();
                }}
                aria-pressed={selected}
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-1 text-left transition-all duration-200",
                  selected
                    ? "border-coral shadow-[0_0_0_1px_var(--coral)]"
                    : "border-ink/10 hover:border-ink/30",
                )}
              >
                <span
                  className={cn(
                    "relative block h-12 w-full overflow-hidden rounded-[7px]",
                    option.css === null && "checkerboard-sm",
                  )}
                  style={option.css ? { background: option.css } : undefined}
                >
                  {option.kind === "image" && matching && (
                    <img
                      src={matching.url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {option.kind === "video" && matching && (
                    <video
                      src={matching.url}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {option.kind === "blur" && (
                    <span className="absolute inset-0 bg-[linear-gradient(140deg,#8d7bff,#ff5a36_55%,#c7f464)]">
                      <span className="absolute inset-2 rounded-full bg-paper/70 blur-[5px]" />
                    </span>
                  )}
                  {option.kind === "image" && !matching && (
                    <span className="absolute inset-0 grid place-items-center bg-ink/[0.04] text-ink/40">
                      <ImageIcon className="h-4 w-4" />
                    </span>
                  )}
                  {option.kind === "video" && !matching && (
                    <span className="absolute inset-0 grid place-items-center bg-ink/[0.04] text-ink/40">
                      <Film className="h-4 w-4" />
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-coral text-[#1a0c07]">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="mt-1.5 block px-0.5 pb-0.5 text-[10px] font-semibold text-ink/65">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          chooseMedia("image", event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          chooseMedia("video", event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      {(backdrop === "image" || backdrop === "video") && (
        <div>
          <SectionLabel>
            {backdrop === "image" ? "Image backdrop" : "Video backdrop"}
          </SectionLabel>
          <button
            type="button"
            onClick={() =>
              backdrop === "image"
                ? imageInput.current?.click()
                : videoInput.current?.click()
            }
            className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-ink/20 bg-ink/[0.02] px-3 py-3 text-left transition-colors hover:border-ink/35 hover:bg-ink/4"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink/6 text-ink/55">
              {backdrop === "image" ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <Film className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-semibold text-ink/80">
                {mediaKind === backdrop
                  ? `Replace ${backdrop}`
                  : `Upload ${backdrop}`}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[9px] text-muted-dark">
                {mediaKind === backdrop && backdropMedia
                  ? backdropMedia.name
                  : backdrop === "image"
                    ? "PNG, JPEG, WebP, AVIF"
                    : "MP4, WebM, MOV"}
              </span>
            </span>
            <Upload className="h-3.5 w-3.5 shrink-0 text-ink/40" />
          </button>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-dark">
            {backdrop === "video"
              ? "The clip loops behind your subject and is seeked frame by frame in the export."
              : "The image is center-cropped to fill the frame."}{" "}
            Nothing is uploaded.
          </p>
        </div>
      )}

      {(backdrop === "blur" || backdrop === "image" || backdrop === "video") && (
        <Slider
          label={backdrop === "blur" ? "Blur strength" : "Backdrop blur"}
          value={backdropBlur}
          min={0}
          max={30}
          format={(value) => `${value} px`}
          onChange={setBackdropBlur}
        />
      )}

      {uploadError && (
        <p
          role="status"
          className="rounded-xl border border-coral/25 bg-coral/8 p-3 text-[11px] leading-relaxed text-ink/70"
        >
          {uploadError}
        </p>
      )}

      <div className="rounded-xl border border-dashed border-ink/15 p-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[8.5px] tracking-[0.14em] text-muted-dark uppercase">
          <Info className="h-3 w-3" />
          every backdrop is local
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-dark">
          Blur keeps your original scene as a soft canvas. Image and video
          backdrops composite at full resolution in the preview and the render.
        </p>
      </div>
    </div>
  );
}

function RefinePanel() {
  const feather = useEditor((state) => state.feather);
  const threshold = useEditor((state) => state.threshold);
  const expand = useEditor((state) => state.expand);
  const subjectLock = useEditor((state) => state.subjectLock);
  const setRefine = useEditor((state) => state.setRefine);
  const setSubjectLock = useEditor((state) => state.setSubjectLock);
  const requestAutoEdge = useEditor((state) => state.requestAutoEdge);
  const resetRefine = useEditor((state) => state.resetRefine);
  const brushActive = useEditor((state) => state.brushActive);
  const brushMode = useEditor((state) => state.brushMode);
  const brushSize = useEditor((state) => state.brushSize);
  const strokeCount = useEditor((state) => state.strokes.length);
  const setBrushActive = useEditor((state) => state.setBrushActive);
  const setBrushMode = useEditor((state) => state.setBrushMode);
  const setBrushSize = useEditor((state) => state.setBrushSize);
  const clearStrokes = useEditor((state) => state.clearStrokes);
  const source = useStudio((state) => state.source);

  const shortSide = Math.min(source?.width ?? 1280, source?.height ?? 720);
  const brushPx = Math.round(brushSize * shortSide);

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "rounded-xl border p-3.5 transition-colors",
          subjectLock
            ? "border-lime/70 bg-lime/18"
            : "border-ink/10 bg-ink/[0.025]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink/85">
              <Sparkles className="h-3.5 w-3.5 text-ink/55" />
              Main subject lock
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink/60">
              Keeps the largest, most centered subject and drops stray flower
              petals, lamps, and background specks. Turn it off to keep every
              detected region.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={subjectLock}
            aria-label="Keep only the main subject"
            onClick={() => setSubjectLock(!subjectLock)}
            className={cn(
              "relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
              subjectLock ? "bg-ink" : "bg-ink/18",
            )}
          >
            <span
              className={cn(
                "pointer-events-none absolute top-0.5 left-0 h-6 w-6 rounded-full bg-paper shadow-sm transition-transform duration-200",
                subjectLock ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>

      <div>
        <SectionLabel>One-tap fixes</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={requestAutoEdge}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ink/15 bg-ink text-[11.5px] font-bold text-paper transition-transform active:scale-[0.98]"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Auto edge
          </button>
          <button
            type="button"
            onClick={() => setRefine({ feather: 2, threshold: 44, expand: 1 })}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ink/12 text-[11.5px] font-semibold text-ink/75 transition-colors hover:border-ink/25 hover:bg-ink/4"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Hair detail
          </button>
          <button
            type="button"
            onClick={() => setRefine({ feather: 0, threshold: 56, expand: 0 })}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ink/12 text-[11.5px] font-semibold text-ink/75 transition-colors hover:border-ink/25 hover:bg-ink/4"
          >
            <Crop className="h-3.5 w-3.5" />
            Clean cut
          </button>
          <button
            type="button"
            onClick={resetRefine}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-ink/12 text-[11.5px] font-semibold text-ink/75 transition-colors hover:border-ink/25 hover:bg-ink/4"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-muted-dark">
          Auto edge measures the current frame, then sets the threshold for you.
          Presets only adjust the mask — the source file is untouched.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-ink/8 bg-ink/[0.02] p-3.5">
        <Slider
          label="Edge softness"
          value={feather}
          min={0}
          max={40}
          format={(value) => `${value} px`}
          hint="Higher values blend the cut into the backdrop; 0 keeps a hard edge."
          onChange={(value) => setRefine({ feather: value })}
        />
        <Slider
          label="Subject threshold"
          value={threshold}
          min={10}
          max={90}
          format={(value) => `${value}%`}
          hint="How much the matte must be sure before a pixel is kept. Lower keeps more, higher is stricter."
          onChange={(value) => setRefine({ threshold: value })}
        />
        <Slider
          label="Edge expand"
          value={expand}
          min={-20}
          max={20}
          format={(value) => `${value > 0 ? "+" : ""}${value} px`}
          hint="Grow the matte to recover fine edges, or shrink it to remove a halo."
          onChange={(value) => setRefine({ expand: value })}
        />
      </div>

      <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink/80">
              <Brush className="h-3.5 w-3.5 text-iris" />
              Keep / erase brush
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-dark">
              Paint on the preview — finger or mouse — to repair the matte.
              {strokeCount > 0 && (
                <span className="text-ink/60">
                  {" "}
                  {strokeCount} correction{strokeCount === 1 ? "" : "s"}.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrushActive(!brushActive)}
            aria-pressed={brushActive}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-semibold transition-colors",
              brushActive
                ? "bg-ink text-paper"
                : "border border-ink/15 text-ink/65 hover:border-ink/30 hover:text-ink",
            )}
          >
            {brushActive ? "Painting" : "Start"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBrushMode("keep")}
            aria-pressed={brushMode === "keep"}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[11.5px] font-semibold transition-colors",
              brushMode === "keep"
                ? "border-lime bg-lime/30 text-ink"
                : "border-ink/12 text-ink/65 hover:border-ink/25 hover:bg-ink/4",
            )}
          >
            <Brush className="h-3.5 w-3.5" />
            Keep
          </button>
          <button
            type="button"
            onClick={() => setBrushMode("erase")}
            aria-pressed={brushMode === "erase"}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[11.5px] font-semibold transition-colors",
              brushMode === "erase"
                ? "border-coral bg-coral/15 text-ink"
                : "border-ink/12 text-ink/65 hover:border-ink/25 hover:bg-ink/4",
            )}
          >
            <Eraser className="h-3.5 w-3.5" />
            Erase
          </button>
        </div>

        <div className="mt-3">
          <Slider
            label="Brush size"
            value={Math.round(brushSize * 100)}
            min={2}
            max={20}
            format={(value) => `${value}% · ${Math.round((value / 100) * shortSide)} px`}
            hint="The brush follows your finger; size is relative to the video."
            onChange={(value) => setBrushSize(value / 100)}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="font-mono text-[9px] leading-relaxed text-muted-dark">
            holds ±0.35s around the painted frame
          </p>
          <button
            type="button"
            onClick={clearStrokes}
            disabled={strokeCount === 0}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-ink/12 px-2.5 text-[10.5px] font-semibold text-ink/65 transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>

        <p className="mt-2 font-mono text-[9px] text-muted-dark">
          brush ≈ {brushPx}px at source resolution
        </p>
      </div>
    </div>
  );
}

function FramePanel() {
  const aspect = useEditor((state) => state.aspect);
  const setAspect = useEditor((state) => state.setAspect);

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Aspect ratio</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {ASPECTS.map((option) => {
            const selected = aspect === option.id;
            const ratio = option.ratio ?? 16 / 9;
            const boxWidth = ratio >= 1 ? 30 : Math.round(30 * ratio);
            const boxHeight = ratio >= 1 ? Math.round(30 / ratio) : 30;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAspect(option.id as AspectId)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-all duration-200",
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/10 text-ink/70 hover:border-ink/30 hover:bg-ink/3",
                )}
              >
                <span className="grid h-16 w-full place-items-center rounded-lg bg-ink/5">
                  <span
                    className={cn(
                      "rounded-[3px] border-2",
                      selected ? "border-paper/80" : "border-ink/35",
                    )}
                    style={{ width: boxWidth, height: boxHeight }}
                  />
                </span>
                <span className="flex items-baseline justify-between gap-1">
                  <span className="text-[11.5px] font-semibold">{option.label}</span>
                  <span
                    className={cn(
                      "font-mono text-[8px] tracking-[0.08em] uppercase",
                      selected ? "text-paper/45" : "text-muted-dark",
                    )}
                  >
                    {option.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-ink/8 bg-ink/[0.025] p-3.5">
        <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/80">
          <Crop className="h-3.5 w-3.5 text-coral" />
          Crop, don't re-encode twice
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-dark">
          The frame is a preview of the export crop. The source file is never
          modified — every ratio renders from the same local decode.
        </p>
      </div>
    </div>
  );
}

function ExportPanel() {
  const preset = useEditor((state) => state.exportPreset);
  const setPreset = useEditor((state) => state.setExportPreset);
  const keepAudio = useEditor((state) => state.keepAudio);
  const setKeepAudio = useEditor((state) => state.setKeepAudio);
  const aspect = useEditor((state) => state.aspect);
  const trimStart = useEditor((state) => state.trimStart);
  const trimEnd = useEditor((state) => state.trimEnd);
  const source = useStudio((state) => state.source);
  const { duration } = usePlayer();
  const { supported, status, progress, download, error, start, cancel, reset } = useExport();

  const clipEnd = trimEnd > 0 ? Math.min(trimEnd, duration) : duration;
  const clipDuration = Math.max(0.1, clipEnd - trimStart);
  const trimmed = trimStart > 0.02 || (trimEnd > 0 && trimEnd < duration - 0.02);

  const bitrates: Record<ExportPresetId, number> = {
    "720p": 5,
    "1080p": 10,
    "4k": 38,
  };
  const estimate = formatBytes(
    (bitrates[preset] * 1_000_000 * Math.max(clipDuration, 1)) / 8,
  );
  const size = exportSize(
    preset,
    aspect,
    source?.width ?? 1920,
    source?.height ?? 1080,
  );
  const percent = Math.round((progress?.ratio ?? 0) * 100);
  const running = status === "running";

  const phaseLabel =
    progress?.phase === "preparing"
      ? "Warming up the matte engine"
      : progress?.phase === "audio"
        ? "Preparing the audio track"
        : progress?.phase === "muxing"
          ? "Writing the MP4"
          : `Segmenting frame ${progress?.frame ?? 0} of ${progress?.frames ?? 0}`;

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Resolution</SectionLabel>
        <div className="space-y-2">
          {EXPORT_PRESETS.map((option) => {
            const selected = preset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreset(option.id as ExportPresetId)}
                disabled={running}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                  selected
                    ? "border-coral bg-coral/6 shadow-[0_0_0_1px_var(--coral)]"
                    : "border-ink/10 hover:border-ink/25 hover:bg-ink/2",
                  running && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    selected ? "bg-coral text-[#1a0c07]" : "bg-ink/5 text-ink/50",
                  )}
                >
                  <MonitorPlay className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[12.5px] font-semibold text-ink">
                      {option.label}
                    </span>
                    <span className="font-mono text-[8.5px] tracking-[0.08em] text-muted-dark uppercase">
                      {option.hint}
                    </span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[9.5px] text-muted-dark">
                    {option.pixels} · {option.note}
                  </span>
                </span>
                {selected && (
                  <Check className="h-4 w-4 shrink-0 text-coral" strokeWidth={2.6} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Container</SectionLabel>
        <div className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-ink/80">
                MP4 / WebM · auto
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-muted-dark">
                H.264 + AAC · VP9 + Opus fallback
              </p>
            </div>
            <span className="rounded-full border border-ink/10 bg-paper px-2 py-1 font-mono text-[8.5px] tracking-[0.1em] text-muted-dark uppercase">
              default
            </span>
          </div>
          <button
            type="button"
            onClick={() => setKeepAudio(!keepAudio)}
            disabled={running}
            aria-pressed={keepAudio}
            className="mt-3 flex w-full items-center justify-between gap-3 border-t border-ink/8 pt-3 text-[11.5px] font-semibold text-ink/75"
          >
            Keep original audio
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors duration-200",
                keepAudio ? "bg-ink" : "bg-ink/15",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-paper transition-transform duration-200",
                  keepAudio ? "translate-x-[18px]" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-ink px-3.5 py-3 text-paper">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[8.5px] tracking-[0.14em] text-paper/45 uppercase">
            output
          </span>
          <span className="font-mono text-[10.5px] tabular-nums">
            {size.width} × {size.height}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[8.5px] tracking-[0.14em] text-paper/45 uppercase">
            estimated size
          </span>
          <span className="font-mono text-[10.5px] tabular-nums">≈ {estimate}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[8.5px] tracking-[0.14em] text-paper/45 uppercase">
            timeline
          </span>
          <span className="font-mono text-[10.5px] tabular-nums">
            {clipDuration.toFixed(1)}s{trimmed ? " · trimmed" : ""}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[8.5px] tracking-[0.14em] text-paper/45 uppercase">
            destination
          </span>
          <span className="font-mono text-[10.5px]">this device</span>
        </div>
      </div>

      {trimmed && (
        <p className="-mt-3 text-[10.5px] leading-relaxed text-muted-dark">
          The render uses the timeline in/out points. Drag the coral handles to
          change the clip without re-encoding the source.
        </p>
      )}

      {running ? (
        <div className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-ink/75">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-coral" />
              <span className="truncate">{phaseLabel}</span>
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-dark">
              {percent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Render progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10"
          >
            <div
              className="h-full rounded-full bg-coral transition-[width] duration-200"
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-dark">
            The renderer drives the source frame by frame. Keep this tab open —
            inference and encoding both run here.
          </p>
          <button
            type="button"
            onClick={cancel}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink/15 py-2 text-[11px] font-semibold text-ink/70 transition-colors hover:border-ink/30 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
            Cancel render
          </button>
        </div>
      ) : download ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-lime/60 bg-lime/20 p-3.5">
            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink/80">
              <Check className="h-3.5 w-3.5 text-ink/70" strokeWidth={2.6} />
              Render complete
            </p>
            <p className="mt-1.5 font-mono text-[9.5px] leading-relaxed break-all text-ink/55">
              {download.name}
              <br />
              {download.container} · {download.width} × {download.height} ·{" "}
              {formatBytes(download.size)} ·{" "}
              {download.hasAudio ? "audio intact" : "no audio track"}
            </p>
            {download.flattened && (
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink/55">
                This container has no alpha channel, so the transparent canvas
                was flattened onto ink. Choose a solid or gradient canvas for
                exact colors.
              </p>
            )}
          </div>
          <a
            href={download.url}
            download={download.name}
            className="btn btn-primary w-full"
          >
            <Download className="h-4 w-4" />
            Download {download.container}
          </a>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border border-ink/15 py-2 text-[11px] font-semibold text-ink/70 transition-colors hover:border-ink/30 hover:text-ink"
          >
            Render another
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void start()}
            disabled={!supported}
            className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Start local render
          </button>
          {!supported && (
            <p className="text-[10.5px] leading-relaxed text-coral">
              This browser does not expose WebCodecs, so local MP4 rendering is
              unavailable here. Chrome or Edge 94+ work best.
            </p>
          )}
          {error && (
            <div
              role="status"
              className="rounded-xl border border-coral/25 bg-coral/8 p-3 text-[11px] leading-relaxed text-ink/70"
            >
              Render failed: {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
