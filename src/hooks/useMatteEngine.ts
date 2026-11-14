import { useCallback, useEffect, useRef, useState } from "react";
import type { InferenceSession } from "onnxruntime-web";
import {
  loadMatteModel,
  preprocessFrame,
  runInference,
  postprocessMatte,
  suggestThreshold,
  applyEdgeControls,
  mapMaskToSize,
  temporalSmooth,
  type SubjectLock,
} from "@/lib/matte";
import { compositeFrame } from "@/lib/compositor";
import { applyStrokes } from "@/lib/brush";
import { ASPECTS } from "@/lib/presets";
import { useEditor } from "@/store/editor";
import { usePlayer } from "@/components/studio/PlayerProvider";
import { useBackdropMedia } from "@/hooks/useBackdropMedia";
import type { MediaSource } from "@/types";

export type MatteStatus = "idle" | "loading" | "ready" | "error";

export interface MatteEngineValue {
  status: MatteStatus;
  progress: number;
  error: string | null;
  /** Matte passes per second (the mask refresh rate, not the display rate). */
  fps: number;
  /** True once the first matte frame has been composited. */
  firstFrame: boolean;
  attachVideo: (el: HTMLVideoElement | null) => void;
  attachCanvas: (el: HTMLCanvasElement | null) => void;
  reprocess: () => void;
}

const MODEL_INPUT = 320;
/** Minimum time between inference passes. */
const MIN_INFERENCE_INTERVAL_MS = 90;
/**
 * The preview never processes more than this many pixels. A 1080p or 4K source
 * is analysed and composited at ~720p and scaled up by CSS, which keeps the
 * editor responsive; the export still runs at full source resolution.
 */
const MAX_PREVIEW_EDGE = 1280;
const MAX_PREVIEW_PIXELS = 1280 * 720;
/**
 * Alpha work (edge controls, temporal smoothing, brush, putImageData) runs in
 * this smaller mask space. The model only produces 320×320 anyway, so doing
 * those passes at 720p was wasted work — and they were the main source of
 * per-frame main-thread hitches. The compositor scales the mask up when it
 * draws it, which the canvas does on the GPU.
 */
const MASK_MAX_EDGE = 480;

interface MaskSpace {
  sourceWidth: number;
  previewWidth: number;
  previewHeight: number;
  width: number;
  height: number;
}

function previewSize(width: number, height: number): { width: number; height: number } {
  if (!width || !height) return { width: 0, height: 0 };
  let scale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(width, height));
  const pixels = width * scale * height * scale;
  if (pixels > MAX_PREVIEW_PIXELS) {
    scale *= Math.sqrt(MAX_PREVIEW_PIXELS / pixels);
  }
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

function maskSize(width: number, height: number): { width: number; height: number } {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, MASK_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

export function useMatteEngine(source: MediaSource | null): MatteEngineValue {
  const { playing, ready } = usePlayer();
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const {
    feather,
    threshold,
    expand,
    subjectLock,
    backdrop,
    backdropMedia,
    backdropBlur,
    strokes,
    strokeRevision,
    aspect,
    autoEdgeRevision,
    exporting,
  } = useEditor();
  const backdropElement = useBackdropMedia(backdropMedia);

  const [status, setStatus] = useState<MatteStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [firstFrame, setFirstFrame] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<InferenceSession | null>(null);
  const prevAlphaRef = useRef<ImageData | null>(null);
  /** Preview-resolution alpha mask kept as a canvas so compositing is cheap. */
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** The exact frame the current mask belongs to. */
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Raw probability map for the stored frame, so edge tweaks need no inference. */
  const probsRef = useRef<Float32Array | null>(null);
  /** Subject lock carried between frames for temporal continuity. */
  const subjectRef = useRef<SubjectLock | null>(null);
  /**
   * Cached base alpha (postprocess → upscale → contrast → expand) for the
   * current probability map. Feather-only changes reuse it, so the softness
   * slider never re-runs the expensive upscale/readback.
   */
  const baseRef = useRef<{
    probs: Float32Array;
    key: string;
    image: ImageData;
  } | null>(null);
  /** Alternating alpha buffers so temporal smoothing always has a distinct previous frame. */
  const alphaA = useRef<ImageData | null>(null);
  const alphaB = useRef<ImageData | null>(null);
  const alphaOut = useRef<ImageData | null>(null);
  const useSecond = useRef(false);
  /** One scheduled rebuild per animation frame, no matter how fast the slider moves. */
  const rebuildTimer = useRef<number | null>(null);
  /** Resolutions of the stored frame, reused by cache rebuilds. */
  const spaceRef = useRef<MaskSpace | null>(null);
  const hasMaskRef = useRef(false);
  const firstFrameRef = useRef(false);
  const lastTimeRef = useRef(-1);
  const busyRef = useRef(false);
  /** A refine/stroke change arrived mid-pass; replay it when the pass ends. */
  const pendingRef = useRef(false);
  /** "Auto edge" was requested before the first probability map existed. */
  const autoPendingRef = useRef(false);
  const lastRunRef = useRef(0);
  const frameCountRef = useRef(0);
  const fpsWindowRef = useRef(0);

  // Keep the latest settings available to the stable callbacks.
  const settingsRef = useRef({
    feather,
    threshold,
    expand,
    subjectLock,
    backdrop,
    backdropElement,
    backdropBlur,
    strokes,
  });
  settingsRef.current = {
    feather,
    threshold,
    expand,
    subjectLock,
    backdrop,
    backdropElement,
    backdropBlur,
    strokes,
  };

  const ratioRef = useRef<number | undefined>(undefined);
  ratioRef.current = source
    ? aspect === "source"
      ? source.width / Math.max(1, source.height)
      : (ASPECTS.find((option) => option.id === aspect)?.ratio ??
        source.width / Math.max(1, source.height))
    : undefined;

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const attachCanvas = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  /** Composite the stored frame with its own mask. */
  const render = useCallback(() => {
    const frame = frameCanvasRef.current;
    const target = canvasRef.current;
    const mask = maskCanvasRef.current;

    if (!frame || !target || !mask || !hasMaskRef.current) return;
    if (!frame.width || !frame.height) return;

    // Composite only as many pixels as the stage actually shows (capped by the
    // preview frame and a 2× DPR). Rendering a 1280×720 bitmap into a ~1000 px
    // stage was the single most expensive part of every matte pass.
    const dpr =
      typeof window !== "undefined"
        ? Math.min(2, window.devicePixelRatio || 1)
        : 1;
    const displayW = target.clientWidth ? target.clientWidth * dpr : frame.width;
    const displayH = target.clientHeight ? target.clientHeight * dpr : frame.height;
    const frameRatio = frame.width / frame.height;
    const cropRatio =
      ratioRef.current && ratioRef.current > 0 ? ratioRef.current : frameRatio;
    let outW = Math.min(frame.width, displayW);
    let outH = outW / cropRatio;
    if (outH > displayH) {
      outH = displayH;
      outW = outH * cropRatio;
    }
    outW = Math.max(2, Math.round(outW));
    outH = Math.max(2, Math.round(outH));

    compositeFrame({
      source: frame,
      mask,
      target,
      backdrop: settingsRef.current.backdrop,
      backdropMedia: settingsRef.current.backdropElement,
      backdropBlur: settingsRef.current.backdropBlur,
      aspectRatio: ratioRef.current,
      outputWidth: outW,
      outputHeight: outH,
    });
  }, []);

  const renderRef = useRef(render);
  renderRef.current = render;

  /**
   * Build the alpha mask from a probability map and paint the stage. Used by
   * both the inference pass and cache rebuilds, so tweaking feather/threshold,
   * painting a stroke, or hitting "Auto edge" never waits for the model.
   */
  const paintMask = useCallback(
    (probs: Float32Array, time: number, smooth: boolean): boolean => {
      const space = spaceRef.current;
      if (!space) return false;
      const settings = settingsRef.current;
      const edgeScale = space.width / space.sourceWidth;
      const feather = Math.max(0, settings.feather * edgeScale);

      // Refresh the base mask only when something that shapes the silhouette
      // changed. Feather is applied afterwards, so dragging softness stays
      // cheap while threshold/expand/lock still update immediately.
      const key = `${settings.threshold}|${settings.subjectLock ? 1 : 0}|${
        settings.expand
      }|${space.width}x${space.height}`;
      let base = baseRef.current;
      if (!base || base.probs !== probs || base.key !== key) {
        const matte = postprocessMatte(probs, MODEL_INPUT, MODEL_INPUT, {
          threshold: settings.threshold,
          subjectLock: settings.subjectLock,
          // Hysteresis only applies between consecutive frames. A rebuild of
          // the same probability map (feather/threshold/expand/stroke change)
          // must be deterministic, otherwise moving a slider and putting it
          // back would land on a slightly different silhouette.
          previous: smooth ? subjectRef.current : null,
        });
        // Only advance the subject lock on real inference frames.
        if (smooth) subjectRef.current = matte.subject;

        let resized = mapMaskToSize(matte.image, space.width, space.height);
        if (resized === matte.image) {
          // Square outputs map 1:1 and would alias the shared postprocess
          // buffer; keep an owned copy so the cache stays valid.
          const copy = new ImageData(space.width, space.height);
          copy.data.set(matte.image.data);
          resized = copy;
        }

        // Feather/expand are expressed in source pixels; convert them to the
        // smaller mask space so the UI value matches the visible result.
        const controlled = applyEdgeControls(resized, {
          feather: 0,
          expand: settings.expand * edgeScale,
        });
        base = { probs, key, image: controlled };
        baseRef.current = base;
      }

      const size = (ref: { current: ImageData | null }) => {
        let image = ref.current;
        if (!image || image.width !== space.width || image.height !== space.height) {
          image = new ImageData(space.width, space.height);
          ref.current = image;
        }
        return image;
      };

      useSecond.current = !useSecond.current;
      const current = size(useSecond.current ? alphaB : alphaA);
      current.data.set(base.image.data);
      if (feather > 0) {
        applyEdgeControls(current, {
          feather,
          expand: 0,
          contrast: false,
        });
      }

      const smoothed = smooth
        ? temporalSmooth(current, prevAlphaRef.current, 0.72)
        : current;
      prevAlphaRef.current = smooth ? smoothed : null;

      // Brush corrections are painted in output-crop space, so they stay
      // locked to the subject as the aspect ratio changes. They go on a
      // separate buffer so the temporal history keeps the unpainted matte.
      const out = size(alphaOut);
      out.data.set(smoothed.data);
      const alpha = applyStrokes(
        out,
        settings.strokes,
        time,
        ratioRef.current,
      );

      let maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) {
        maskCanvas = document.createElement("canvas");
        maskCanvasRef.current = maskCanvas;
      }
      if (maskCanvas.width !== alpha.width || maskCanvas.height !== alpha.height) {
        maskCanvas.width = alpha.width;
        maskCanvas.height = alpha.height;
      }
      maskCanvas.getContext("2d")!.putImageData(alpha, 0, 0);
      hasMaskRef.current = true;

      renderRef.current();
      if (!firstFrameRef.current) {
        firstFrameRef.current = true;
        setFirstFrame(true);
      }
      return true;
    },
    [],
  );

  /** Rebuild the mask from the stored probabilities (no model pass). */
  const rebuild = useCallback((): boolean => {
    const probs = probsRef.current;
    const video = videoRef.current;
    if (!probs || !video) return false;
    return paintMask(probs, video.currentTime, false);
  }, [paintMask]);

  /**
   * Coalesce rebuild requests to one per frame. A fast drag fires dozens of
   * input events; rebuilding synchronously for each one made the slider feel
   * heavy on slower devices.
   */
  const scheduleRebuild = useCallback(() => {
    if (rebuildTimer.current !== null) return;
    rebuildTimer.current = window.requestAnimationFrame(() => {
      rebuildTimer.current = null;
      prevAlphaRef.current = null;
      if (!rebuild()) void inferRef.current();
    });
  }, [rebuild]);

  /** Run one segmentation pass and refresh the stored mask. */
  const inferOnce = useCallback(async () => {
    const video = videoRef.current;
    const session = sessionRef.current;

    if (!video || !session) return;
    if (busyRef.current) {
      // While paused there is no rAF loop to pick the change up, so remember
      // it and replay once the in-flight pass finishes. During playback the
      // loop already re-runs continuously.
      if (!playingRef.current) pendingRef.current = true;
      return;
    }
    if (video.readyState < 2) return;
    if (typeof document !== "undefined" && document.hidden) return;
    // The exporter has its own pass loop; never compete for the same video.
    if (useEditor.getState().exporting) return;

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    if (!srcW || !srcH) return;
    const preview = previewSize(srcW, srcH);
    if (!preview.width || !preview.height) return;
    const maskSpace = maskSize(preview.width, preview.height);

    const now = performance.now();
    if (now - lastRunRef.current < MIN_INFERENCE_INTERVAL_MS) return;
    lastRunRef.current = now;

    const currentTime = video.currentTime;
    // Drop the temporal history on big seeks so we don't ghost the old frame.
    if (lastTimeRef.current >= 0 && Math.abs(currentTime - lastTimeRef.current) > 0.28) {
      prevAlphaRef.current = null;
      subjectRef.current = null;
    }
    lastTimeRef.current = currentTime;

    spaceRef.current = {
      sourceWidth: srcW,
      previewWidth: preview.width,
      previewHeight: preview.height,
      width: maskSpace.width,
      height: maskSpace.height,
    };

    busyRef.current = true;
    try {
      // Snapshot the analyzed frame at preview resolution and keep it:
      // displaying the mask over a *different* frame causes a ghost halo while
      // the subject moves.
      let frameCanvas = frameCanvasRef.current;
      if (!frameCanvas) {
        frameCanvas = document.createElement("canvas");
        frameCanvasRef.current = frameCanvas;
      }
      if (frameCanvas.width !== preview.width || frameCanvas.height !== preview.height) {
        frameCanvas.width = preview.width;
        frameCanvas.height = preview.height;
      }
      frameCanvas
        .getContext("2d", { willReadFrequently: true })!
        .drawImage(video, 0, 0, preview.width, preview.height);

      const capturedTime = currentTime;
      const input = preprocessFrame(frameCanvas, MODEL_INPUT);
      const probs = await runInference(session, input, MODEL_INPUT);
      probsRef.current = probs;

      if (autoPendingRef.current) {
        autoPendingRef.current = false;
        useEditor.getState().setRefine({ threshold: suggestThreshold(probs) });
      }

      paintMask(probs, capturedTime, true);

      // Track a rolling inference-rate estimate.
      frameCountRef.current += 1;
      const start = fpsWindowRef.current;
      if (!start) {
        fpsWindowRef.current = now;
      } else if (now - start >= 800) {
        setFps(Math.round((frameCountRef.current * 1000) / (now - start)));
        frameCountRef.current = 0;
        fpsWindowRef.current = now;
      }
    } catch (err) {
      console.error("Matte processing failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        window.setTimeout(() => void inferRef.current(), 0);
      }
    }
  }, [paintMask]);

  const inferRef = useRef(inferOnce);
  inferRef.current = inferOnce;

  const reprocess = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  // Load the model once a source exists (and again after a retry).
  useEffect(() => {
    if (!source) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    sessionRef.current = null;
    prevAlphaRef.current = null;
    probsRef.current = null;
    subjectRef.current = null;
    spaceRef.current = null;
    baseRef.current = null;
    pendingRef.current = false;
    autoPendingRef.current = false;
    hasMaskRef.current = false;
    firstFrameRef.current = false;
    setFirstFrame(false);
    setStatus("loading");
    setProgress(0);
    setError(null);

    loadMatteModel((p) => {
      if (!cancelled) setProgress(p);
    })
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        setStatus("ready");
        setProgress(1);
      })
      .catch((err) => {
        console.error("[useMatteEngine] Failed to load matte model", err);
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [source, reloadKey]);

  // While playing: run the segmentation pass back-to-back. Each pass also
  // paints its own frame, so the preview stays aligned with the matte.
  useEffect(() => {
    if (!playing || !ready || status !== "ready") return;
    let raf = 0;
    const loop = () => {
      void inferRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, ready, status]);

  // While paused, refresh the mask after seeks. During an export the renderer
  // drives the same video element, so the preview must stay idle.
  useEffect(() => {
    if (status !== "ready" || !ready || playing || exporting) return;
    const video = videoRef.current;
    const refresh = () => {
      prevAlphaRef.current = null;
      subjectRef.current = null;
      probsRef.current = null;
      baseRef.current = null;
      void inferRef.current();
    };
    const handle = window.setTimeout(refresh, 40);
    video?.addEventListener("seeked", refresh);
    return () => {
      window.clearTimeout(handle);
      video?.removeEventListener("seeked", refresh);
    };
  }, [playing, ready, status, exporting]);

  // Refine controls change the alpha itself. Rebuild from the cached
  // probability map so the stage updates instantly, even at ~1 fps inference.
  useEffect(() => {
    if (status !== "ready") return;
    scheduleRebuild();
  }, [feather, threshold, expand, subjectLock, status, scheduleRebuild]);

  // Painted corrections only change alpha: rebuild from the cached map, or
  // re-infer once if the cache is empty.
  useEffect(() => {
    if (status !== "ready" || !strokeRevision) return;
    const timer = window.setTimeout(scheduleRebuild, 40);
    return () => window.clearTimeout(timer);
  }, [strokeRevision, status, scheduleRebuild]);

  useEffect(() => {
    return () => {
      if (rebuildTimer.current !== null) {
        cancelAnimationFrame(rebuildTimer.current);
        rebuildTimer.current = null;
      }
    };
  }, []);

  // "Auto edge": measure the current frame and set the threshold from Otsu's
  // method. If no pass has run yet, apply it right after the first one.
  useEffect(() => {
    if (!autoEdgeRevision) return;
    const probs = probsRef.current;
    if (probs) {
      useEditor.getState().setRefine({ threshold: suggestThreshold(probs) });
    } else {
      autoPendingRef.current = true;
      void inferRef.current();
    }
  }, [autoEdgeRevision]);

  // Backdrop and aspect only change how the frame is assembled: re-composite
  // immediately instead of waiting for the next model pass.
  useEffect(() => {
    renderRef.current();
  }, [backdrop, aspect, status, backdropElement, backdropBlur]);

  // The exporter drives the same video element, leaving the preview mask stale.
  // Refresh once it hands control back so the stage matches the timeline again.
  useEffect(() => {
    if (exporting || status !== "ready" || !ready || playing) return;
    prevAlphaRef.current = null;
    probsRef.current = null;
    baseRef.current = null;
    const handle = window.setTimeout(() => void inferRef.current(), 80);
    return () => window.clearTimeout(handle);
  }, [exporting, status, ready, playing]);

  return {
    status,
    progress,
    error,
    fps,
    firstFrame,
    attachVideo,
    attachCanvas,
    reprocess,
  };
}
