import type { BackdropId } from "@/lib/presets";
import { backdropById } from "@/lib/presets";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompositeFrameOptions {
  /** Source video frame (video element or canvas) */
  source: HTMLVideoElement | HTMLCanvasElement;
  /** Alpha mask canvas (alpha channel carries the matte) */
  mask: HTMLCanvasElement;
  /** Target canvas to draw onto */
  target: HTMLCanvasElement;
  /** Current backdrop ID */
  backdrop: BackdropId;
  /** Loaded image or video element used by the image/video backdrops. */
  backdropMedia?: HTMLImageElement | HTMLVideoElement | null;
  /** Backdrop blur in preview pixels (scaled to the render size). */
  backdropBlur?: number;
  /** Crop aspect ratio (width / height). Omit to keep the source ratio. */
  aspectRatio?: number;
  /** Render size. Omit to composite at the cropped source size. */
  outputWidth?: number;
  outputHeight?: number;
}

/**
 * The centered source crop used for an aspect ratio. Shared by the compositor,
 * the brush rasterizer, and the export so painted strokes land exactly where
 * they were drawn.
 */
export function cropRect(
  srcW: number,
  srcH: number,
  aspectRatio?: number,
): CropRect {
  let width = srcW;
  let height = srcH;
  if (aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0) {
    const srcRatio = srcW / srcH;
    if (srcRatio > aspectRatio) {
      width = Math.round(srcH * aspectRatio);
      height = srcH;
    } else {
      width = srcW;
      height = Math.round(srcW / aspectRatio);
    }
  }
  return {
    x: Math.round((srcW - width) / 2),
    y: Math.round((srcH - height) / 2),
    width,
    height,
  };
}

// Reused scratch canvases so per-frame compositing doesn't allocate.
let subjectCanvas: HTMLCanvasElement | null = null;
let backdropCanvas: HTMLCanvasElement | null = null;
let smallCanvas: HTMLCanvasElement | null = null;

/** Cache key for backdrops that don't change from frame to frame. */
let staticKey: {
  id: BackdropId | null;
  width: number;
  height: number;
  blur: number;
  media: HTMLImageElement | null;
} = { id: null, width: 0, height: 0, blur: -1, media: null };

/** Draw the composited frame: the masked subject over the selected backdrop. */
export function compositeFrame(opts: CompositeFrameOptions): void {
  const { source, mask, target, backdrop, aspectRatio, backdropMedia } = opts;
  const outW = Math.max(0, Math.round(opts.outputWidth ?? 0));
  const outH = Math.max(0, Math.round(opts.outputHeight ?? 0));

  const srcW = "videoWidth" in source ? source.videoWidth : source.width;
  const srcH = "videoHeight" in source ? source.videoHeight : source.height;
  if (!srcW || !srcH) return;

  const crop = cropRect(srcW, srcH, aspectRatio);

  // Render size defaults to the cropped source size (1:1 preview).
  const renderW = outW || crop.width;
  const renderH = outH || crop.height;

  if (target.width !== renderW || target.height !== renderH) {
    target.width = renderW;
    target.height = renderH;
  }

  // Keep blur visually consistent between the preview and larger exports.
  const scaledBlur =
    Math.max(0, opts.backdropBlur ?? 0) * (Math.min(renderW, renderH) / 720);

  // The mask may be smaller than the source (the preview works at a capped
  // resolution), so crop it in its own coordinate space.
  const maskCrop = cropRect(mask.width, mask.height, aspectRatio);

  const ctx = target.getContext("2d")!;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.clearRect(0, 0, renderW, renderH);

  const descriptor = backdropById(backdrop);

  // Transparent output is the common case: draw the frame once and punch the
  // matte out on the target. No scratch canvas, no second full-size blit.
  if (descriptor.kind === "none") {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      renderW,
      renderH,
    );
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(
      mask,
      maskCrop.x,
      maskCrop.y,
      maskCrop.width,
      maskCrop.height,
      0,
      0,
      renderW,
      renderH,
    );
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  // 1. Build the masked subject on a scratch canvas.
  if (!subjectCanvas) subjectCanvas = document.createElement("canvas");
  if (subjectCanvas.width !== renderW || subjectCanvas.height !== renderH) {
    subjectCanvas.width = renderW;
    subjectCanvas.height = renderH;
  }
  const sctx = subjectCanvas.getContext("2d")!;
  sctx.globalCompositeOperation = "source-over";
  sctx.filter = "none";
  sctx.clearRect(0, 0, renderW, renderH);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "medium";
  sctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, renderW, renderH);
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(
    mask,
    maskCrop.x,
    maskCrop.y,
    maskCrop.width,
    maskCrop.height,
    0,
    0,
    renderW,
    renderH,
  );
  sctx.globalCompositeOperation = "source-over";

  // 2. Paint the backdrop, then lay the subject over it.
  if (descriptor.kind === "blur") {
    drawBlurredSource(
      ctx,
      source,
      crop,
      renderW,
      renderH,
      Math.max(3, scaledBlur || 14),
    );
  } else if (descriptor.kind === "image" || descriptor.kind === "video") {
    const image =
      backdropMedia instanceof HTMLImageElement ? backdropMedia : null;
    if (
      descriptor.kind === "image" &&
      canCacheStatic(backdrop, image)
    ) {
      ctx.drawImage(
        staticBackdrop(backdrop, renderW, renderH, scaledBlur, image),
        0,
        0,
      );
    } else {
      // Ink behind a not-yet-loaded or letterboxed backdrop.
      ctx.fillStyle = "#0b0b0f";
      ctx.fillRect(0, 0, renderW, renderH);
      if (backdropMedia) {
        drawCover(ctx, backdropMedia, renderW, renderH, scaledBlur);
      }
    }
  } else {
    if (canCacheStatic(backdrop, null)) {
      ctx.drawImage(staticBackdrop(backdrop, renderW, renderH, scaledBlur, null), 0, 0);
    } else {
      drawBackdrop(ctx, backdrop, renderW, renderH);
    }
  }

  ctx.drawImage(subjectCanvas, 0, 0, renderW, renderH);
}

function canCacheStatic(
  id: BackdropId,
  media: HTMLImageElement | null | undefined,
): boolean {
  const descriptor = backdropById(id);
  if (descriptor.kind === "video" || descriptor.kind === "blur" || descriptor.kind === "none") {
    return false;
  }
  if (descriptor.kind === "image" && !media) return false;
  return true;
}

/**
 * Cache solid, gradient, and image backdrops. They only depend on the id,
 * render size, blur, and (for images) the loaded element — redrawing them on
 * every frame is wasted work.
 */
function staticBackdrop(
  id: BackdropId,
  width: number,
  height: number,
  blur: number,
  media: HTMLImageElement | null | undefined,
): HTMLCanvasElement {
  const image = media ?? null;
  if (
    staticKey.id === id &&
    staticKey.width === width &&
    staticKey.height === height &&
    staticKey.blur === blur &&
    staticKey.media === image
  ) {
    return backdropCanvas!;
  }

  if (!backdropCanvas) backdropCanvas = document.createElement("canvas");
  if (backdropCanvas.width !== width || backdropCanvas.height !== height) {
    backdropCanvas.width = width;
    backdropCanvas.height = height;
  }
  const ctx = backdropCanvas.getContext("2d")!;
  ctx.filter = "none";
  ctx.clearRect(0, 0, width, height);

  const descriptor = backdropById(id);
  if (descriptor.kind === "image") {
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, width, height);
    if (image) drawCover(ctx, image, width, height, blur);
  } else {
    drawBackdrop(ctx, id, width, height);
  }

  staticKey = { id, width, height, blur, media: image };
  return backdropCanvas;
}

/**
 * Blur the original frame and use it as the backdrop. The blur runs on a
 * downscaled copy and is then upscaled — visually equivalent, several times
 * cheaper than filtering a full-resolution frame every pass.
 */
function drawBlurredSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLVideoElement | HTMLCanvasElement,
  crop: CropRect,
  width: number,
  height: number,
  blur: number,
): void {
  const scale = Math.min(1, 480 / Math.max(width, height));
  if (scale >= 0.98) {
    // Already small: filter in place.
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    const pad = Math.ceil(blur * 2);
    ctx.drawImage(
      source,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -pad,
      -pad,
      width + pad * 2,
      height + pad * 2,
    );
    ctx.restore();
    return;
  }

  const sw = Math.max(2, Math.round(width * scale));
  const sh = Math.max(2, Math.round(height * scale));
  if (!smallCanvas) smallCanvas = document.createElement("canvas");
  if (smallCanvas.width !== sw || smallCanvas.height !== sh) {
    smallCanvas.width = sw;
    smallCanvas.height = sh;
  }
  const sctx = smallCanvas.getContext("2d")!;
  sctx.clearRect(0, 0, sw, sh);
  sctx.filter = `blur(${Math.max(0.5, blur * scale)}px)`;
  // Overscan so the blur kernel doesn't reveal transparent edges after scaling.
  const padX = sw * 0.05;
  const padY = sh * 0.05;
  sctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -padX,
    -padY,
    sw + padX * 2,
    sh + padY * 2,
  );
  sctx.filter = "none";

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, width, height);
  ctx.restore();
}

/** Draw an image/video backdrop covering the frame (center crop). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
  blur: number,
): void {
  const mediaWidth =
    media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const mediaHeight =
    media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!mediaWidth || !mediaHeight) return;

  // A tiny overscan hides the soft edge introduced by the blur filter.
  const overscan = blur > 0 ? 1.04 : 1;
  const scale =
    Math.max(width / mediaWidth, height / mediaHeight) * overscan;
  const drawW = mediaWidth * scale;
  const drawH = mediaHeight * scale;

  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(media, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  ctx.restore();
}

// Cache the parsed backdrop gradient for the current size + id.
let cachedGradient: {
  id: BackdropId;
  width: number;
  height: number;
  gradient: CanvasGradient;
} | null = null;

/** Draw the backdrop onto the canvas. */
function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  backdropId: BackdropId,
  width: number,
  height: number,
): void {
  const backdrop = backdropById(backdropId);
  if (!backdrop.css) return;

  const css = backdrop.css;
  if (css.startsWith("radial-gradient") || css.startsWith("linear-gradient")) {
    if (
      !cachedGradient ||
      cachedGradient.id !== backdropId ||
      cachedGradient.width !== width ||
      cachedGradient.height !== height
    ) {
      const gradient = parseGradient(ctx, css, width, height);
      if (gradient) {
        cachedGradient = { id: backdropId, width, height, gradient };
      }
    }
    if (cachedGradient && cachedGradient.id === backdropId) {
      ctx.fillStyle = cachedGradient.gradient;
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }

  ctx.fillStyle = css;
  ctx.fillRect(0, 0, width, height);
}

function parseGradient(
  ctx: CanvasRenderingContext2D,
  css: string,
  width: number,
  height: number,
): CanvasGradient | null {
  const radialMatch = css.match(/radial-gradient\(([^)]+)\)/);
  if (radialMatch) {
    const parts = radialMatch[1].split(",").map((p) => p.trim());
    const positionPart = parts[0];
    const colorParts = parts.slice(1);

    let cx = width / 2;
    let cy = height / 2;
    let rx = width;
    let ry = height;

    const atMatch = positionPart.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
    if (atMatch) {
      cx = (parseFloat(atMatch[1]) / 100) * width;
      cy = (parseFloat(atMatch[2]) / 100) * height;
    }
    const sizeMatch = positionPart.match(/^([\d.]+)%\s+([\d.]+)%/);
    if (sizeMatch) {
      rx = (parseFloat(sizeMatch[1]) / 100) * width;
      ry = (parseFloat(sizeMatch[2]) / 100) * height;
    }

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    addStops(gradient, colorParts);
    return gradient;
  }

  const linearMatch = css.match(/linear-gradient\(([^)]+)\)/);
  if (linearMatch) {
    const parts = linearMatch[1].split(",").map((p) => p.trim());
    const anglePart = parts[0];
    const colorParts = parts.slice(1);

    const angleMatch = anglePart.match(/([\d.]+)deg/);
    const angle = ((angleMatch ? parseFloat(angleMatch[1]) : 180) * Math.PI) / 180;

    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const cx = width / 2;
    const cy = height / 2;
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;

    const gradient = ctx.createLinearGradient(
      cx - dx * half,
      cy - dy * half,
      cx + dx * half,
      cy + dy * half,
    );
    addStops(gradient, colorParts);
    return gradient;
  }

  return null;
}

function addStops(gradient: CanvasGradient, colorParts: string[]): void {
  for (const cp of colorParts) {
    const match = cp.match(/^([#\w]+)\s+([\d.]+)%$/);
    if (match) {
      gradient.addColorStop(
        Math.min(1, Math.max(0, parseFloat(match[2]) / 100)),
        match[1],
      );
    }
  }
}
