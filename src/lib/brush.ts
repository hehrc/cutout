import { cropRect } from "@/lib/compositor";

/** A single painted correction point, normalized to the output crop (0–1). */
export interface BrushPoint {
  x: number;
  y: number;
}

export type BrushMode = "keep" | "erase";

/**
 * A matte correction painted on the stage. `time` is the source time the
 * stroke belongs to; corrections hold for a short window around it so a few
 * strokes can repair a moving edge without repainting the whole clip.
 */
export interface BrushStroke {
  id: string;
  mode: BrushMode;
  /** Brush diameter as a fraction of the shorter source side (0–1). */
  size: number;
  /** Source time, in seconds, when the stroke was painted. */
  time: number;
  points: BrushPoint[];
}

/** Seconds a stroke stays active on either side of its painted frame. */
export const BRUSH_WINDOW = 0.35;

/** Strokes whose time window covers this frame. */
export function activeStrokes(
  strokes: readonly BrushStroke[],
  time: number,
  window = BRUSH_WINDOW,
): BrushStroke[] {
  if (!strokes.length) return [];
  return strokes.filter((stroke) => Math.abs(stroke.time - time) <= window);
}

let overlay: HTMLCanvasElement | null = null;

/**
 * Rasterize the active keep/erase strokes onto a source-resolution alpha mask.
 * Keep raises alpha toward 255, erase pulls it toward 0; anti-aliased brush
 * coverage is preserved so painted edges stay soft.
 */
export function applyStrokes(
  mask: ImageData,
  strokes: readonly BrushStroke[],
  time: number,
  aspectRatio?: number,
  window = BRUSH_WINDOW,
): ImageData {
  const active = activeStrokes(strokes, time, window);
  if (!active.length) return mask;

  const { width, height } = mask;
  if (!width || !height) return mask;

  const crop = cropRect(width, height, aspectRatio);
  // Keep corrections inside the visible crop.
  const minX = crop.x;
  const maxX = crop.x + crop.width;
  const minY = crop.y;
  const maxY = crop.y + crop.height;

  if (!overlay) overlay = document.createElement("canvas");
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  const ctx = overlay.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of active) {
    if (!stroke.points.length) continue;
    const lineWidth = Math.max(1, stroke.size * Math.min(width, height));
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke.mode === "keep" ? "#ffffff" : "#000000";
    ctx.fillStyle = ctx.strokeStyle;

    const points = stroke.points.map((point) => ({
      x: Math.min(maxX, Math.max(minX, crop.x + point.x * crop.width)),
      y: Math.min(maxY, Math.max(minY, crop.y + point.y * crop.height)),
    }));

    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  const painted = ctx.getImageData(0, 0, width, height).data;
  const alpha = mask.data;
  for (let i = 0; i < painted.length; i += 4) {
    const coverage = painted[i + 3];
    if (!coverage) continue;
    const index = i + 3;
    if (painted[i] > 127) {
      // Keep: raise alpha to the painted coverage.
      if (coverage > alpha[index]) alpha[index] = coverage;
    } else {
      // Erase: pull alpha down by the painted coverage.
      const cleared = 255 - coverage;
      if (cleared < alpha[index]) alpha[index] = cleared;
    }
  }

  return mask;
}
