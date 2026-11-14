import { create } from "zustand";
import type { AspectId, BackdropId, ExportPresetId } from "@/lib/presets";
import type { BrushMode, BrushStroke } from "@/lib/brush";
import type { BackdropMedia } from "@/lib/backdrop";

export type ToolId = "background" | "refine" | "frame" | "export";

export const TOOL_META: Record<
  ToolId,
  { label: string; blurb: string }
> = {
  background: {
    label: "Backdrop",
    blurb: "Set the canvas behind your subject.",
  },
  refine: {
    label: "Refine",
    blurb: "Tune the matte edge and paint corrections.",
  },
  frame: {
    label: "Frame",
    blurb: "Choose the aspect ratio for the cut.",
  },
  export: {
    label: "Export",
    blurb: "Render locally, up to 4K, audio intact.",
  },
};

interface EditorStore {
  tool: ToolId;
  panelOpen: boolean;
  aspect: AspectId;
  backdrop: BackdropId;
  backdropMedia: BackdropMedia | null;
  backdropBlur: number;
  feather: number;
  threshold: number;
  expand: number;
  /** Keep only the main subject and clear stray background blobs. */
  subjectLock: boolean;
  /** Bumped by "Auto edge" so the engine can measure the frame and set a threshold. */
  autoEdgeRevision: number;
  brushActive: boolean;
  brushMode: BrushMode;
  /** Brush diameter as a fraction of the shorter source side. */
  brushSize: number;
  strokes: BrushStroke[];
  /** Bumped whenever strokes change so the matte engine re-infers. */
  strokeRevision: number;
  trimStart: number;
  /** Trim out point in seconds; 0 means "end of clip". */
  trimEnd: number;
  compare: boolean;
  exportPreset: ExportPresetId;
  /** Keep the source audio track in the rendered file. */
  keepAudio: boolean;
  /** True while a local render is running; the preview engine idles. */
  exporting: boolean;
  setTool: (tool: ToolId) => void;
  setPanelOpen: (open: boolean) => void;
  setAspect: (aspect: AspectId) => void;
  setBackdrop: (backdrop: BackdropId) => void;
  setBackdropMedia: (media: BackdropMedia | null) => void;
  setBackdropBlur: (blur: number) => void;
  setRefine: (patch: Partial<Pick<EditorStore, "feather" | "threshold" | "expand">>) => void;
  setSubjectLock: (locked: boolean) => void;
  requestAutoEdge: () => void;
  resetRefine: () => void;
  setBrushActive: (active: boolean) => void;
  setBrushMode: (mode: BrushMode) => void;
  setBrushSize: (size: number) => void;
  addStroke: (stroke: BrushStroke) => void;
  clearStrokes: () => void;
  setTrim: (start: number, end: number) => void;
  setCompare: (compare: boolean) => void;
  setExportPreset: (preset: ExportPresetId) => void;
  setKeepAudio: (keepAudio: boolean) => void;
  setExporting: (exporting: boolean) => void;
  resetEdits: () => void;
}

const REFINE_DEFAULTS = {
  feather: 4,
  threshold: 50,
  expand: -2,
  subjectLock: true,
};

export const useEditor = create<EditorStore>()((set) => ({
  tool: "background",
  panelOpen: false,
  aspect: "source",
  backdrop: "transparent",
  backdropMedia: null,
  backdropBlur: 14,
  ...REFINE_DEFAULTS,
  autoEdgeRevision: 0,
  brushActive: false,
  brushMode: "keep",
  brushSize: 0.06,
  strokes: [],
  strokeRevision: 0,
  trimStart: 0,
  trimEnd: 0,
  compare: false,
  exportPreset: "1080p",
  keepAudio: true,
  exporting: false,

  setTool: (tool) =>
    set((state) => ({
      tool,
      panelOpen: window.innerWidth < 1024 ? true : state.panelOpen,
    })),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setAspect: (aspect) => set({ aspect }),
  setBackdrop: (backdrop) => set({ backdrop }),
  setBackdropMedia: (backdropMedia) =>
    set(
      backdropMedia
        ? {
            backdropMedia,
            backdrop: backdropMedia.kind,
            // Picking a backdrop means the stage should play, not paint.
            brushActive: false,
          }
        : { backdropMedia: null },
    ),
  setBackdropBlur: (backdropBlur) => set({ backdropBlur }),
  setRefine: (patch) => set(patch),
  setSubjectLock: (subjectLock) => set({ subjectLock }),
  requestAutoEdge: () =>
    set((state) => ({
      autoEdgeRevision: state.autoEdgeRevision + 1,
      subjectLock: true,
    })),
  resetRefine: () => set(REFINE_DEFAULTS),
  setBrushActive: (brushActive) =>
    set((state) => ({
      brushActive,
      // Switching tools keeps the panel in context. Starting the brush on a
      // phone dismisses the sheet so the stage you paint on stays visible.
      tool: brushActive ? "refine" : state.tool,
      panelOpen:
        brushActive && window.innerWidth < 1024 ? false : state.panelOpen,
    })),
  setBrushMode: (brushMode) => set({ brushMode, brushActive: true }),
  setBrushSize: (brushSize) => set({ brushSize }),
  addStroke: (stroke) =>
    set((state) => ({
      strokes: [...state.strokes, stroke],
      strokeRevision: state.strokeRevision + 1,
    })),
  clearStrokes: () =>
    set((state) => ({
      strokes: [],
      strokeRevision: state.strokeRevision + 1,
    })),
  setTrim: (trimStart, trimEnd) => set({ trimStart, trimEnd }),
  setCompare: (compare) => set({ compare }),
  setExportPreset: (exportPreset) => set({ exportPreset }),
  setKeepAudio: (keepAudio) => set({ keepAudio }),
  setExporting: (exporting) => set({ exporting }),
  resetEdits: () =>
    set((state) => ({
      strokes: [],
      strokeRevision: state.strokeRevision + 1,
      trimStart: 0,
      trimEnd: 0,
      brushActive: false,
      compare: false,
    })),
}));
