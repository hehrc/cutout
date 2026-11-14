import type { AspectId, ExportPresetId } from "@/lib/presets";
import { ASPECTS } from "@/lib/presets";

/** Short side, in pixels, for each export preset. */
const PRESET_SHORT_SIDE: Record<ExportPresetId, number> = {
  "720p": 720,
  "1080p": 1080,
  "4k": 2160,
};

export interface ExportSize {
  width: number;
  height: number;
}

export function isExportSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window;
}

/** Compute the output pixel size for a preset + aspect ratio. */
export function exportSize(
  preset: ExportPresetId,
  aspect: AspectId,
  sourceWidth: number,
  sourceHeight: number,
): ExportSize {
  const shortSide = PRESET_SHORT_SIDE[preset];
  const sourceRatio = sourceWidth / Math.max(1, sourceHeight);
  const ratio =
    aspect === "source"
      ? sourceRatio
      : (ASPECTS.find((option) => option.id === aspect)?.ratio ?? sourceRatio);

  const width = ratio >= 1 ? shortSide * ratio : shortSide;
  const height = ratio >= 1 ? shortSide : shortSide / ratio;

  return { width: even(width), height: even(height) };
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
