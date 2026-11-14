import type * as Ort from "onnxruntime-web";

type OrtModule = typeof import("onnxruntime-web");

const MODEL_URL = "/models/u2netp.onnx";
const INPUT_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let ortModule: OrtModule | null = null;
let session: Ort.InferenceSession | null = null;
let loading: Promise<Ort.InferenceSession> | null = null;

/** Load the U²-Netp ONNX model via ONNX Runtime Web (WASM, single-threaded, SIMD when available). */
export async function loadMatteModel(progress?: (p: number) => void): Promise<Ort.InferenceSession> {
  if (session) return session;
  if (loading) return loading;

  loading = (async () => {
    // Pull the runtime in on demand: the landing page never pays for it.
    const ort = await import("onnxruntime-web");
    ortModule = ort;

    ort.env.wasm.wasmPaths = "/ort/";
    // Multi-threaded WASM needs SharedArrayBuffer, which requires a
    // cross-origin-isolated page. The Vite dev server's worker handling stalls
    // the threaded runtime, so dev stays single-threaded.
    const isolated =
      !import.meta.env.DEV &&
      typeof crossOriginIsolated !== "undefined" &&
      crossOriginIsolated;
    ort.env.wasm.numThreads = isolated
      ? Math.min(4, Math.max(1, navigator.hardwareConcurrency || 1))
      : 1;
    ort.env.wasm.simd = true;
    // Run the session in ORT's proxy worker so a slow inference pass never
    // blocks scrolling, painting, or the transport. This matters most in
    // single-threaded environments without SharedArrayBuffer.
    ort.env.wasm.proxy = true;

    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`Model fetch failed (${response.status})`);

    const total = Number(response.headers.get("content-length")) || 0;
    let bytes: Uint8Array;

    if (response.body && total > 0) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        progress?.(Math.min(0.92, received / total) * 0.92);
      }
      bytes = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    progress?.(0.94);
    const sess = await ort.InferenceSession.create(bytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });

    session = sess;
    progress?.(1);
    return sess;
  })().catch((err) => {
    // Clear the cached promise so "Retry" actually starts a fresh attempt
    // instead of replaying the same rejection.
    loading = null;
    throw err;
  });

  return loading;
}

// Reused scratch resources. The preview and the exporter both run passes
// sequentially (never overlapping), so one buffer each is enough and avoids
// per-frame allocations and GC hitches.
let inputCanvas: HTMLCanvasElement | null = null;
let inputCtx: CanvasRenderingContext2D | null = null;
let inputFloat: Float32Array | null = null;

let postCanvas: HTMLCanvasElement | null = null;
let postCtx: CanvasRenderingContext2D | null = null;
let postImage: ImageData | null = null;

// Shared alpha planes for morph/blur passes, keyed by pixel count.
let poolSize = 0;
const pool: Uint8ClampedArray[] = [];
function scratchPlane(index: number, size: number): Uint8ClampedArray {
  if (poolSize !== size) {
    pool.length = 0;
    poolSize = size;
  }
  return (pool[index] ??= new Uint8ClampedArray(size));
}

/** Preprocess a video frame (HTMLVideoElement or canvas) to model input tensor. */
export function preprocessFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  targetSize = INPUT_SIZE,
): Float32Array {
  if (!inputCanvas) inputCanvas = document.createElement("canvas");
  if (inputCanvas.width !== targetSize || inputCanvas.height !== targetSize) {
    inputCanvas.width = targetSize;
    inputCanvas.height = targetSize;
    inputCtx = null;
  }
  if (!inputCtx) {
    inputCtx = inputCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  const ctx = inputCtx;

  const srcW = "videoWidth" in source ? source.videoWidth : source.width;
  const srcH = "videoHeight" in source ? source.videoHeight : source.height;
  const scale = Math.min(targetSize / srcW, targetSize / srcH);
  const dw = Math.round(srcW * scale);
  const dh = Math.round(srcH * scale);
  const dx = (targetSize - dw) / 2;
  const dy = (targetSize - dh) / 2;

  // Letterbox with a neutral gray so the aspect ratio is preserved.
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.drawImage(source, dx, dy, dw, dh);

  const { data } = ctx.getImageData(0, 0, targetSize, targetSize);
  const length = 3 * targetSize * targetSize;
  if (!inputFloat || inputFloat.length !== length) {
    inputFloat = new Float32Array(length);
  }
  const input = inputFloat;
  const plane = targetSize * targetSize;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    input[p] = (r - MEAN[0]) / STD[0];
    input[p + plane] = (g - MEAN[1]) / STD[1];
    input[p + 2 * plane] = (b - MEAN[2]) / STD[2];
  }

  return input;
}

/** Run inference on a preprocessed frame, return raw probability map (H x W). */
export async function runInference(
  sess: Ort.InferenceSession,
  input: Float32Array,
  targetSize = INPUT_SIZE,
): Promise<Float32Array> {
  if (!ortModule) throw new Error("Matte runtime is not loaded");
  const ort = ortModule;

  const tensor = new ort.Tensor("float32", input, [1, 3, targetSize, targetSize]);
  const feeds: Record<string, Ort.Tensor> = {};
  feeds[sess.inputNames[0]] = tensor;

  const results = await sess.run(feeds);
  const output = results[sess.outputNames[0]] as Ort.Tensor;

  // Output shape: [1, 1, H, W] -> squeeze to [H, W]
  const [, , h, w] = output.dims;
  const probs = new Float32Array(h * w);
  probs.set(output.data as Float32Array);
  return probs;
}

/**
 * Where the main subject sits in a frame, in normalized model space (0–1).
 * The preview and the exporter pass this back on the next frame so the matte
 * stays locked to the same subject instead of jumping between blobs.
 */
export interface SubjectLock {
  cx: number;
  cy: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Fraction of the frame covered by the selected subject. */
  area: number;
}

export interface MatteOptions {
  /** Alpha threshold as a percentage (0–100). */
  threshold: number;
  /**
   * Keep the main subject. Connected components drop stray background blobs
   * and specks, while a center prior + previous-frame lock keep the selection
   * stable between frames.
   */
  subjectLock?: boolean;
  /** Subject lock from the previous frame, used for temporal continuity. */
  previous?: SubjectLock | null;
}

export interface MatteResult {
  image: ImageData;
  /** Lock for this frame, or null when subject selection is disabled. */
  subject: SubjectLock | null;
  /** Percentage threshold the mask was built with. */
  threshold: number;
}

interface Component {
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

// Scratch buffers for connected-component analysis, keyed by model pixel count.
let labelSize = 0;
let labelsBuf: Int32Array | null = null;
let coreBuf: Uint8Array | null = null;
let stackBuf: Int32Array | null = null;
let fillBuf: Uint8Array | null = null;
let queueBuf: Int32Array | null = null;

function ensureLabelBuffers(size: number): void {
  if (labelSize === size && labelsBuf) return;
  labelSize = size;
  labelsBuf = new Int32Array(size);
  coreBuf = new Uint8Array(size);
  stackBuf = new Int32Array(size);
  fillBuf = new Uint8Array(size);
  queueBuf = new Int32Array(size);
}

/**
 * Pick the main subject from a probability map and return a binary plane that
 * covers it (plus significant attached parts). Small specks, isolated
 * background blobs far from the subject, and enclosed background holes are
 * resolved here rather than being left to the alpha ramp.
 */
function selectSubject(
  probs: Float32Array,
  width: number,
  height: number,
  low: number,
  previous: SubjectLock | null,
): { mask: Uint8Array; subject: SubjectLock | null } | null {
  const n = width * height;
  ensureLabelBuffers(n);
  const labels = labelsBuf!;
  const core = coreBuf!;
  const stack = stackBuf!;

  for (let i = 0; i < n; i++) {
    core[i] = probs[i] > low ? 1 : 0;
    labels[i] = 0;
  }

  const comps: Component[] = [];
  let nextLabel = 0;
  const minArea = Math.max(10, Math.round(n * 0.0006));

  for (let start = 0; start < n; start++) {
    if (!core[start] || labels[start]) continue;
    const label = ++nextLabel;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;

    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (sp > 0) {
      const p = stack[--sp];
      const x = p % width;
      const y = (p - x) / width;
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const q = p - 1;
        if (core[q] && !labels[q]) {
          labels[q] = label;
          stack[sp++] = q;
        }
      }
      if (x + 1 < width) {
        const q = p + 1;
        if (core[q] && !labels[q]) {
          labels[q] = label;
          stack[sp++] = q;
        }
      }
      if (y > 0) {
        const q = p - width;
        if (core[q] && !labels[q]) {
          labels[q] = label;
          stack[sp++] = q;
        }
      }
      if (y + 1 < height) {
        const q = p + width;
        if (core[q] && !labels[q]) {
          labels[q] = label;
          stack[sp++] = q;
        }
      }
    }

    if (area < minArea) continue;
    comps.push({
      label,
      area,
      minX,
      minY,
      maxX,
      maxY,
      cx: sumX / area,
      cy: sumY / area,
    });
  }

  if (!comps.length) return null;

  const prevPx = previous
    ? {
        minX: previous.minX * width,
        minY: previous.minY * height,
        maxX: previous.maxX * width,
        maxY: previous.maxY * height,
        cx: previous.cx * width,
        cy: previous.cy * height,
        area: previous.area * n,
      }
    : null;

  const score = (component: Component) => {
    const inset = Math.min(
      component.minX,
      component.minY,
      width - 1 - component.maxX,
      height - 1 - component.maxY,
    );
    // A subject that touches the frame edge is unlikely to be the subject of a
    // cutout, but a real subject may fill the frame. Only penalize a component
    // that is mostly a thin border band.
    const edgePenalty = inset <= 1 && component.area < n * 0.02 ? 0.45 : 1;
    const dist = Math.hypot(
      component.cx / width - 0.5,
      component.cy / height - 0.5,
    );
    const center = 1 - Math.min(1, dist / 0.7071);
    let value = component.area * (0.52 + 0.8 * center) * edgePenalty;
    if (prevPx) {
      const overlap =
        Math.max(0, Math.min(component.maxX, prevPx.maxX) - Math.max(component.minX, prevPx.minX)) *
        Math.max(0, Math.min(component.maxY, prevPx.maxY) - Math.max(component.minY, prevPx.minY));
      const prevArea = (prevPx.maxX - prevPx.minX) * (prevPx.maxY - prevPx.minY) || 1;
      if (overlap / prevArea > 0.12) value *= 1.9;
    }
    return value;
  };

  let best = comps[0];
  let bestScore = score(best);
  for (let i = 1; i < comps.length; i++) {
    const value = score(comps[i]);
    if (value > bestScore) {
      bestScore = value;
      best = comps[i];
    }
  }

  // Hysteresis: if the previous subject is still present with a comparable
  // area, keep it instead of jumping to a slightly larger blob this frame.
  if (prevPx) {
    let previousMatch: Component | null = null;
    let previousScore = -1;
    for (const component of comps) {
      const ix = Math.max(
        0,
        Math.min(component.maxX, prevPx.maxX) - Math.max(component.minX, prevPx.minX),
      );
      const iy = Math.max(
        0,
        Math.min(component.maxY, prevPx.maxY) - Math.max(component.minY, prevPx.minY),
      );
      if (ix > 0 && iy > 0) {
        const ratio = (ix * iy) / Math.max(1, component.area);
        if (ratio > previousScore) {
          previousScore = ratio;
          previousMatch = component;
        }
      }
    }
    if (
      previousMatch &&
      previousMatch.area >= best.area * 0.55 &&
      previousMatch.area >= prevPx.area * 0.35
    ) {
      best = previousMatch;
    }
  }

  // Keep the chosen component and any substantial part that sits with it
  // (a split limb, a held prop) or overlaps the previous subject. The padding
  // is deliberately tight: a wide radius would drag nearby lamps or petals
  // into the cutout.
  const keepLabel = new Uint8Array(nextLabel + 1);
  const pad = Math.round(Math.min(width, height) * 0.05);
  for (const component of comps) {
    if (component === best) {
      keepLabel[component.label] = 1;
      continue;
    }
    if (component.area < best.area * 0.1) continue;
    const nearBest =
      component.minX <= best.maxX + pad &&
      component.maxX >= best.minX - pad &&
      component.minY <= best.maxY + pad &&
      component.maxY >= best.minY - pad;
    const nearPrevious = prevPx
      ? component.minX <= prevPx.maxX + pad &&
        component.maxX >= prevPx.minX - pad &&
        component.minY <= prevPx.maxY + pad &&
        component.maxY >= prevPx.minY - pad
      : false;
    if (nearBest || nearPrevious) keepLabel[component.label] = 1;
  }

  for (let i = 0; i < n; i++) {
    const label = labels[i];
    core[i] = label && keepLabel[label] ? 1 : 0;
  }

  // Fill enclosed holes (background trapped inside the subject silhouette)
  // without bridging genuine gaps that connect to the frame border. Hole pixels
  // are tagged 2 and rendered fully opaque: the model gives them a low
  // probability, so the gate alone would punch a see-through hole in the
  // subject.
  const fill = fillBuf!;
  const queue = queueBuf!;
  fill.fill(0);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number) => {
    if (!core[index] && !fill[index]) {
      fill[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) enqueue(p - 1);
    if (x + 1 < width) enqueue(p + 1);
    if (y > 0) enqueue(p - width);
    if (y + 1 < height) enqueue(p + width);
  }
  let keptArea = 0;
  for (let i = 0; i < n; i++) {
    if (!core[i] && !fill[i]) core[i] = 2;
    if (core[i]) keptArea++;
  }

  if (!keptArea) return null;

  return {
    mask: core,
    subject: {
      cx: best.cx / width,
      cy: best.cy / height,
      minX: best.minX / width,
      minY: best.minY / height,
      maxX: best.maxX / width,
      maxY: best.maxY / height,
      area: keptArea / n,
    },
  };
}

/**
 * Turn the raw probability map into an anti-aliased alpha mask at model
 * resolution. The model already emits probabilities, so the threshold is
 * applied to the raw values — no per-frame min/max stretch that would amplify
 * noise on a frame where the subject is weak.
 *
 * With `subjectLock`, connected-component analysis keeps the main subject and
 * clears the rest, so a stray plant leaf or background highlight can't become
 * the "cutout".
 */
export function postprocessMatte(
  probs: Float32Array,
  width: number,
  height: number,
  options: MatteOptions,
): MatteResult {
  const thresh = Math.min(0.98, Math.max(0.02, options.threshold / 100));
  // Half-width of the soft transition band (in probability). Narrow enough to
  // keep edges crisp, wide enough to antialias them after upscaling.
  const band = 0.035;
  const low = Math.max(0.01, thresh - band);
  const high = thresh + band;
  const span = high - low || 1;

  const selection =
    options.subjectLock === false
      ? null
      : selectSubject(probs, width, height, low, options.previous ?? null);
  const keep = selection?.mask ?? null;

  if (!postCanvas || postCanvas.width !== width || postCanvas.height !== height) {
    postCanvas = document.createElement("canvas");
    postCanvas.width = width;
    postCanvas.height = height;
    postCtx = null;
    postImage = null;
  }
  if (!postCtx) {
    postCtx = postCanvas.getContext("2d", { willReadFrequently: true })!;
  }
  if (!postImage) postImage = postCtx.createImageData(width, height);
  const image = postImage;
  const data = image.data;

  for (let i = 0; i < probs.length; i++) {
    const kept = keep ? keep[i] : 1;
    if (!kept) {
      data[i * 4 + 3] = 0;
      continue;
    }
    if (kept === 2) {
      // Enclosed hole: part of the silhouette even though the model scored it
      // as background.
      data[i * 4 + 3] = 255;
      continue;
    }
    const t = Math.min(1, Math.max(0, (probs[i] - low) / span));
    // Smoothstep for a clean, antialiased edge.
    const alpha = Math.round(t * t * (3 - 2 * t) * 255);
    // Drop faint probability dust so it doesn't become a halo after upscaling.
    data[i * 4 + 3] = alpha < 12 ? 0 : alpha;
  }

  return {
    image,
    subject: selection?.subject ?? null,
    threshold: Math.round(thresh * 100),
  };
}

/**
 * Otsu's method over the probability histogram. Used by the "Auto edge"
 * action so the threshold adapts to the clip instead of guessing a fixed 50%.
 */
export function suggestThreshold(probs: Float32Array): number {
  const bins = 64;
  const histogram = new Uint32Array(bins);
  for (let i = 0; i < probs.length; i++) {
    const value = Math.min(1, Math.max(0, probs[i]));
    histogram[Math.min(bins - 1, (value * bins) | 0)]++;
  }

  const total = probs.length;
  let sum = 0;
  for (let bin = 0; bin < bins; bin++) sum += bin * histogram[bin];

  let weightBackground = 0;
  let sumBackground = 0;
  let bestVariance = -1;
  let bestMeanBackground = 0;
  let bestMeanForeground = 0;
  for (let bin = 0; bin < bins; bin++) {
    weightBackground += histogram[bin];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += bin * histogram[bin];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);
    if (between > bestVariance) {
      bestVariance = between;
      bestMeanBackground = meanBackground;
      bestMeanForeground = meanForeground;
    }
  }

  // U²-Net output is nearly binary, so many split points share the same
  // between-class variance. The midpoint of the two class means is the useful
  // threshold; taking the first optimal split would always pick near-zero and
  // keep the background.
  const midpoint = (bestMeanBackground + bestMeanForeground) / 2;
  const value = ((midpoint + 0.5) / bins) * 100;
  return Math.round(Math.min(75, Math.max(25, value)));
}

/**
 * Apply edge controls at the final resolution:
 *  - expand: morph the alpha outward (dilate) or inward (erode) by real pixels
 *  - feather: separable box blur (true output pixels)
 */
export function applyEdgeControls(
  alpha: ImageData,
  options: { feather: number; expand: number; contrast?: boolean },
): ImageData {
  const { feather, expand } = options;

  // Re-establish a crisp edge after the 320px mask has been upscaled: narrow
  // the alpha ramp while keeping its 50% contour in place. Skipped when the
  // caller already cached a contrasted + expanded base mask.
  if (options.contrast !== false) contrastAlpha(alpha);

  if (expand !== 0) {
    morphAlpha(alpha, Math.round(Math.abs(expand)), expand > 0);
  }

  if (feather > 0) {
    boxBlurAlpha(alpha, Math.max(1, Math.round(feather * 0.5)));
  }

  return alpha;
}

/** Compress the alpha ramp into a narrower band (an S-curve around 50%). */
function contrastAlpha(image: ImageData): void {
  const data = image.data;
  for (let i = 3; i < data.length; i += 4) {
    const t = (data[i] / 255 - 0.3) / 0.4;
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
    data[i] = Math.round(clamped * clamped * (3 - 2 * clamped) * 255);
  }
}

/** Separable sliding-window max (dilate) or min (erode) on the alpha plane. */
function morphAlpha(image: ImageData, radius: number, dilate: boolean): void {
  if (radius <= 0) return;

  const w = image.width;
  const h = image.height;
  const data = image.data;
  const size = w * h;

  const src = scratchPlane(0, size);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) src[p] = data[i + 3];

  const tmp = scratchPlane(1, size);
  const out = scratchPlane(2, size);

  for (let y = 0; y < h; y++) {
    morphLine(src, tmp, y * w, 1, w, radius, dilate);
  }
  for (let x = 0; x < w; x++) {
    morphLine(tmp, out, x, w, h, radius, dilate);
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    data[i + 3] = out[p];
  }
}

function morphLine(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  offset: number,
  stride: number,
  count: number,
  radius: number,
  dilate: boolean,
): void {
  // Monotonic deque of indexes, kept in [head, tail).
  const deque = new Int32Array(count);
  let head = 0;
  let tail = 0;
  let next = 0;

  for (let i = 0; i < count; i++) {
    const high = Math.min(count - 1, i + radius);
    while (next <= high) {
      const value = src[offset + next * stride];
      while (tail > head) {
        const back = src[offset + deque[tail - 1] * stride];
        if (dilate ? back <= value : back >= value) tail--;
        else break;
      }
      deque[tail++] = next;
      next++;
    }

    const low = i - radius;
    while (deque[head] < low) head++;

    dst[offset + i * stride] = src[offset + deque[head] * stride];
  }
}

function boxBlurAlpha(image: ImageData, radius: number): void {
  const w = image.width;
  const h = image.height;
  const data = image.data;
  const size = w * h;
  const temp = scratchPlane(0, size);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    const window = radius * 2 + 1;
    for (let x = -radius; x <= radius; x++) {
      sum += data[(row + Math.min(w - 1, Math.max(0, x))) * 4 + 3];
    }
    temp[row] = sum / window;
    for (let x = 1; x < w; x++) {
      const right = Math.min(w - 1, x + radius);
      const left = Math.max(0, x - radius - 1);
      sum += data[(row + right) * 4 + 3] - data[(row + left) * 4 + 3];
      temp[row + x] = sum / window;
    }
  }

  // Vertical pass
  const out = scratchPlane(1, size);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    const window = radius * 2 + 1;
    for (let y = -radius; y <= radius; y++) {
      sum += temp[Math.min(h - 1, Math.max(0, y)) * w + x];
    }
    out[x] = sum / window;
    for (let y = 1; y < h; y++) {
      const bottom = Math.min(h - 1, y + radius);
      const top = Math.max(0, y - radius - 1);
      sum += temp[bottom * w + x] - temp[top * w + x];
      out[y * w + x] = sum / window;
    }
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    data[i + 3] = out[p];
  }
}

/**
 * Temporal smoothing: blend the current alpha with the previous mask to calm
 * edge flicker. The blend is motion-adaptive — pixels that changed a lot are
 * taken from the current pass, so moving subjects don't leave ghost edges.
 */
export function temporalSmooth(
  current: ImageData,
  previous: ImageData | null,
  strength = 0.72,
): ImageData {
  if (!previous || previous.width !== current.width || previous.height !== current.height) {
    return current;
  }

  const c = current.data;
  const p = previous.data;
  for (let i = 3; i < c.length; i += 4) {
    const diff = Math.abs(c[i] - p[i]);
    // At a large difference (a real edge moved) trust the new frame fully.
    const trust = Math.min(1, strength + ((1 - strength) * diff) / 96);
    c[i] = Math.round(c[i] * trust + p[i] * (1 - trust));
  }
  return current;
}

let maskSrcCanvas: HTMLCanvasElement | null = null;
let maskOutCanvas: HTMLCanvasElement | null = null;
let maskOutCtx: CanvasRenderingContext2D | null = null;

/**
 * Map a model-resolution (320×320, letterboxed) mask onto an arbitrary output
 * size. The inverse letterbox matters: stretching the square mask directly to a
 * wide frame would shift the subject vertically.
 *
 * Both the preview (capped resolution) and the exporter (full source
 * resolution) share this path, so preview controls line up with the render.
 */
export function mapMaskToSize(
  mask: ImageData,
  outW: number,
  outH: number,
): ImageData {
  const size = mask.width;
  if (outW <= 0 || outH <= 0) return mask;
  const scale = Math.min(size / outW, size / outH);
  const dw = Math.round(outW * scale);
  const dh = Math.round(outH * scale);
  const dx = Math.round((size - dw) / 2);
  const dy = Math.round((size - dh) / 2);

  if (dw === outW && dh === outH) return mask;

  if (
    !maskSrcCanvas ||
    maskSrcCanvas.width !== size ||
    maskSrcCanvas.height !== size
  ) {
    maskSrcCanvas = document.createElement("canvas");
    maskSrcCanvas.width = size;
    maskSrcCanvas.height = size;
  }
  maskSrcCanvas.getContext("2d")!.putImageData(mask, 0, 0);

  if (
    !maskOutCanvas ||
    maskOutCanvas.width !== outW ||
    maskOutCanvas.height !== outH
  ) {
    maskOutCanvas = document.createElement("canvas");
    maskOutCanvas.width = outW;
    maskOutCanvas.height = outH;
    maskOutCtx = null;
  }
  if (!maskOutCtx) {
    maskOutCtx = maskOutCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;
  }
  const ctx = maskOutCtx;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // The scratch canvas is reused across frames. Transparent source pixels do
  // not erase what is already there under source-over, so without this clear
  // every mask would accumulate the union of all earlier silhouettes.
  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(maskSrcCanvas, dx, dy, dw, dh, 0, 0, outW, outH);

  return ctx.getImageData(0, 0, outW, outH);
}

/** Backwards-compatible alias used by the exporter. */
export function mapMaskToSource(
  mask: ImageData,
  srcW: number,
  srcH: number,
): ImageData {
  return mapMaskToSize(mask, srcW, srcH);
}