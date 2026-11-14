import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";
import type { AspectId, BackdropId, ExportPresetId } from "@/lib/presets";
import { ASPECTS } from "@/lib/presets";
import { compositeFrame } from "@/lib/compositor";
import { applyStrokes, type BrushStroke } from "@/lib/brush";
import type { BackdropMedia } from "@/lib/backdrop";
import { loadBackdropElement, seekMedia } from "@/lib/backdrop";
import { exportSize, isExportSupported } from "@/lib/export-meta";
import {
  applyEdgeControls,
  loadMatteModel,
  mapMaskToSource,
  postprocessMatte,
  preprocessFrame,
  runInference,
  temporalSmooth,
  type SubjectLock,
} from "@/lib/matte";

const VIDEO_BITRATE: Record<ExportPresetId, number> = {
  "720p": 5_000_000,
  "1080p": 10_000_000,
  "4k": 38_000_000,
};

const AUDIO_BITRATE = 160_000;
const MODEL_INPUT = 320;
const AUDIO_SAMPLE_CHUNK = 1024;

export type ExportPhase = "preparing" | "audio" | "video" | "muxing" | "done";

export interface ExportProgress {
  phase: ExportPhase;
  /** Completed video frames. */
  frame: number;
  /** Total video frames. */
  frames: number;
  /** 0–1 overall progress. */
  ratio: number;
}

export interface ExportRequest {
  /** The preview video element (already loaded with the source). */
  video: HTMLVideoElement;
  /** URL the source can be re-fetched from, for audio decoding. */
  sourceUrl: string;
  /** Where to start in the source, in seconds. */
  start?: number;
  /** How many seconds to render. */
  duration?: number;
  preset: ExportPresetId;
  aspect: AspectId;
  backdrop: BackdropId;
  /** Image/video backdrop to load and composite behind the subject. */
  backdropMedia?: BackdropMedia | null;
  backdropBlur?: number;
  /** Matte corrections painted on the stage. */
  strokes?: BrushStroke[];
  feather: number;
  threshold: number;
  expand: number;
  /** Keep the main subject and drop stray background blobs. */
  subjectLock?: boolean;
  /** Include the original audio track when the browser can encode it. */
  audio: boolean;
  /** Called as the render advances. */
  onProgress?: (progress: ExportProgress) => void;
  /** Abort the render between frames. */
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  frames: number;
  duration: number;
  hasAudio: boolean;
  /** True when a transparent canvas was flattened to a solid color. */
  flattened: boolean;
  /** File extension matching the negotiated container. */
  extension: "mp4" | "webm";
  container: "MP4" | "WebM";
}

/** Pick an H.264 level that can carry the requested size. */
function avcCodec(width: number, height: number): string {
  const pixels = width * height;
  if (pixels > 1920 * 1088) return "avc1.640033"; // High 5.1
  if (pixels > 1280 * 720) return "avc1.640028"; // High 4.0
  return "avc1.64001f"; // High 3.1
}

/** Pick a VP9 level from the frame size. */
function vp9Codec(width: number, height: number): string {
  const pixels = width * height;
  const level = pixels > 1920 * 1088 ? "51" : pixels > 1280 * 720 ? "41" : "31";
  return `vp09.00.${level}.08`;
}

interface MuxSink {
  addVideo(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  addAudio(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  finalize(): void;
  buffer(): ArrayBuffer;
  mime: string;
  extension: "mp4" | "webm";
  container: "MP4" | "WebM";
}

interface ExportPlan {
  video: VideoEncoderConfig;
  audio: AudioEncoderConfig | null;
  createSink(audio: { sampleRate: number; channels: number } | null): MuxSink;
}

interface QueuedAudioChunk {
  chunk: EncodedAudioChunk;
  meta?: EncodedAudioChunkMetadata;
}

const AUDIO_CODECS = {
  mp4: { config: "mp4a.40.2", muxer: "aac" },
  webm: { config: "opus", muxer: "A_OPUS" },
} as const;

async function resolvePlan(
  width: number,
  height: number,
  preset: ExportPresetId,
  audio: AudioSource | null,
): Promise<ExportPlan> {
  const bitrate = VIDEO_BITRATE[preset];

  // Prefer MP4/H.264, but only when the audio track can be AAC-encoded too.
  const mp4Video: VideoEncoderConfig = {
    codec: avcCodec(width, height),
    width,
    height,
    bitrate,
    framerate: 30,
    latencyMode: "quality",
    avc: { format: "avc" },
  };
  const mp4Supported = await VideoEncoder.isConfigSupported(mp4Video)
    .then((result) => Boolean(result.supported))
    .catch(() => false);

  let mp4AudioSupported = true;
  if (audio) {
    mp4AudioSupported = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODECS.mp4.config,
      sampleRate: audio.sampleRate,
      numberOfChannels: audio.channels,
      bitrate: AUDIO_BITRATE,
    })
      .then((result) => Boolean(result.supported))
      .catch(() => false);
  }

  if (mp4Supported && mp4AudioSupported) {
    return {
      video: mp4Video,
      audio: audio
        ? {
            codec: AUDIO_CODECS.mp4.config,
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.channels,
            bitrate: AUDIO_BITRATE,
          }
        : null,
      createSink: (audioConfig) => {
        const target = new Mp4Target();
        const muxer = new Mp4Muxer({
          target,
          video: { codec: "avc", width, height, frameRate: 30 },
          audio: audioConfig
            ? {
                codec: "aac",
                numberOfChannels: audioConfig.channels,
                sampleRate: audioConfig.sampleRate,
              }
            : undefined,
          fastStart: "in-memory",
        });
        return {
          addVideo: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          addAudio: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          finalize: () => muxer.finalize(),
          buffer: () => target.buffer,
          mime: "video/mp4",
          extension: "mp4",
          container: "MP4",
        };
      },
    };
  }

  // WebM/VP9 + Opus needs no proprietary codecs.
  const webmVideo: VideoEncoderConfig = {
    codec: vp9Codec(width, height),
    width,
    height,
    bitrate: Math.round(bitrate * 0.8),
    framerate: 30,
    latencyMode: "quality",
  };
  const webmSupported = await VideoEncoder.isConfigSupported(webmVideo)
    .then((result) => Boolean(result.supported))
    .catch(() => false);
  if (!webmSupported) {
    throw new Error("This browser cannot encode H.264 or VP9 at the selected size.");
  }

  let webmAudio = audio !== null;
  if (audio) {
    webmAudio = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODECS.webm.config,
      sampleRate: audio.sampleRate,
      numberOfChannels: audio.channels,
      bitrate: AUDIO_BITRATE,
    })
      .then((result) => Boolean(result.supported))
      .catch(() => false);
  }

  return {
    video: webmVideo,
    audio:
      audio && webmAudio
        ? {
            codec: AUDIO_CODECS.webm.config,
            sampleRate: audio.sampleRate,
            numberOfChannels: audio.channels,
            bitrate: AUDIO_BITRATE,
          }
        : null,
    createSink: (audioConfig) => {
      const target = new WebmTarget();
      const muxer = new WebmMuxer({
        target,
        video: { codec: "V_VP9", width, height, frameRate: 30 },
        audio: audioConfig
          ? {
              codec: AUDIO_CODECS.webm.muxer,
              numberOfChannels: audioConfig.channels,
              sampleRate: audioConfig.sampleRate,
            }
          : undefined,
      });
      return {
        addVideo: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        addAudio: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        finalize: () => muxer.finalize(),
        buffer: () => target.buffer,
        mime: "video/webm",
        extension: "webm",
        container: "WebM",
      };
    },
  };
}

interface AudioSource {
  buffer: AudioBuffer;
  sampleRate: number;
  channels: number;
}

/**
 * Render the current edit to a video file entirely on device:
 * decode frame → segment → composite at output resolution → encode → mux.
 */
export async function renderExport(request: ExportRequest): Promise<ExportResult> {
  if (!isExportSupported()) {
    throw new Error("This browser does not expose WebCodecs video encoding.");
  }

  const video = request.video;
  const signal = request.signal;
  const fps = 30;

  const duration = Math.max(
    0.1,
    request.duration ?? (Number.isFinite(video.duration) ? video.duration : 0),
  );
  const start = Math.min(
    Math.max(0, request.start ?? 0),
    Math.max(0, (Number.isFinite(video.duration) ? video.duration : duration) - 0.05),
  );

  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const { width, height } = exportSize(request.preset, request.aspect, sourceWidth, sourceHeight);
  const frames = Math.max(1, Math.round(duration * fps));

  const report = (phase: ExportPhase, frame: number, extra = 0) => {
    const ratio =
      phase === "done"
        ? 1
        : phase === "muxing"
          ? 0.98 + (extra || 0) * 0.02
          : phase === "audio"
            ? extra * 0.08
            : 0.08 + (frame / frames) * 0.9;
    request.onProgress?.({ phase, frame, frames, ratio: Math.min(1, ratio) });
  };

  report("preparing", 0);

  // Keep the decoder quiet while we drive it and strip any looping.
  const wasLooping = video.loop;
  video.pause();
  video.loop = false;

  const session = await loadMatteModel();
  throwIfAborted(signal);

  // ---- Audio: decode once so the plan knows the real sample rate. ----
  let audioSource: AudioSource | null = null;
  if (request.audio) {
    report("audio", 0, 0.1);
    audioSource = await decodeAudio(request.sourceUrl).catch((err) => {
      console.warn("[export] Audio track skipped", err);
      return null;
    });
  }
  throwIfAborted(signal);

  const plan = await resolvePlan(width, height, request.preset, audioSource);
  throwIfAborted(signal);

  // Re-encode the decoded audio to the container's codec.
  let audioChunks: QueuedAudioChunk[] = [];
  let audioConfig: { sampleRate: number; channels: number } | null = null;
  if (audioSource && plan.audio) {
    const encoded = await encodeAudioChunks(audioSource, start, duration, plan.audio, signal, (p) =>
      report("audio", 0, p),
    );
    if (encoded) {
      audioChunks = encoded;
      audioConfig = { sampleRate: audioSource.sampleRate, channels: audioSource.channels };
    }
  }
  throwIfAborted(signal);

  // Load the chosen image/video backdrop once; a video is seeked per frame so
  // the render matches what the preview shows.
  const backdropElement = request.backdropMedia
    ? await loadBackdropElement(request.backdropMedia).catch((err) => {
        console.warn("[export] Backdrop media skipped", err);
        return null;
      })
    : null;
  if (backdropElement instanceof HTMLVideoElement) {
    backdropElement.pause();
  }
  throwIfAborted(signal);

  // ---- Muxer + video encoder ----
  const sink = plan.createSink(audioConfig);

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => sink.addVideo(chunk, meta),
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error(String(err));
    },
  });
  encoder.configure(plan.video);

  for (const entry of audioChunks) {
    sink.addAudio(entry.chunk, entry.meta);
  }

  // ---- Frame loop ----
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = sourceWidth;
  frameCanvas.height = sourceHeight;
  const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true })!;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;

  const aspectRatio =
    request.aspect === "source"
      ? sourceWidth / Math.max(1, sourceHeight)
      : (ASPECTS.find((option) => option.id === request.aspect)?.ratio ??
        sourceWidth / Math.max(1, sourceHeight));

  // Neither MP4 nor WebCodecs VP9 carries an alpha channel here; a transparent
  // canvas is flattened onto ink so the subject doesn't sit on pure black.
  const flattened = request.backdrop === "transparent";
  const backdrop: BackdropId = flattened ? "ink" : request.backdrop;

  let previousAlpha: ImageData | null = null;
  let previousSubject: SubjectLock | null = null;
  const keyEvery = Math.max(1, Math.round(fps * 2));

  try {
    for (let i = 0; i < frames; i++) {
      throwIfAborted(signal);
      if (encoderError) throw encoderError;

      const time = Math.min(
        start + i / fps,
        (video.duration || start + duration) - 0.001,
      );
      await seekVideo(video, time);
      throwIfAborted(signal);

      frameCtx.drawImage(video, 0, 0, sourceWidth, sourceHeight);

      const input = preprocessFrame(frameCanvas, MODEL_INPUT);
      const probs = await runInference(session, input, MODEL_INPUT);
      const matte = postprocessMatte(probs, MODEL_INPUT, MODEL_INPUT, {
        threshold: request.threshold,
        subjectLock: request.subjectLock !== false,
        previous: previousSubject,
      });
      previousSubject = matte.subject;
      const resized = mapMaskToSource(matte.image, sourceWidth, sourceHeight);
      const controlled = applyEdgeControls(resized, {
        feather: request.feather,
        expand: request.expand,
      });
      const smoothed = temporalSmooth(controlled, previousAlpha, 0.72);
      previousAlpha = smoothed;
      const brushed = applyStrokes(
        smoothed,
        request.strokes ?? [],
        time,
        aspectRatio,
      );

      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = brushed.width;
      maskCanvas.height = brushed.height;
      maskCanvas.getContext("2d")!.putImageData(brushed, 0, 0);

      if (backdropElement instanceof HTMLVideoElement) {
        await seekMedia(backdropElement, i / fps).catch(() => undefined);
        throwIfAborted(signal);
      }

      compositeFrame({
        source: frameCanvas,
        mask: maskCanvas,
        target: outputCanvas,
        backdrop,
        backdropMedia: backdropElement,
        backdropBlur: request.backdropBlur ?? 0,
        aspectRatio,
        outputWidth: width,
        outputHeight: height,
      });

      const timestamp = Math.round((i * 1_000_000) / fps);
      const frame = new VideoFrame(outputCanvas, {
        timestamp,
        duration: Math.round(1_000_000 / fps),
      });
      encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();

      if (encoder.encodeQueueSize > 4) {
        await waitForEncoderDrain(encoder);
      }

      if (i % 3 === 0 || i === frames - 1) report("video", i + 1);
    }

    report("muxing", frames, 0.1);
    await encoder.flush();
  } catch (err) {
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      // Already closed.
    }
    video.loop = wasLooping;
    throw err;
  }

  encoder.close();
  if (encoderError) throw encoderError;

  sink.finalize();
  video.loop = wasLooping;

  report("muxing", frames, 1);
  report("done", frames);

  return {
    blob: new Blob([sink.buffer()], { type: sink.mime }),
    width,
    height,
    frames,
    duration,
    hasAudio: Boolean(audioConfig),
    flattened,
    extension: sink.extension,
    container: sink.container,
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Render cancelled", "AbortError");
  }
}

/** Seek the video and wait until the frame at that time is actually painted. */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const max = Number.isFinite(video.duration) ? video.duration : time;
  const target = Math.min(Math.max(0, time), Math.max(0, max - 0.001));

  if (Math.abs(video.currentTime - target) < 0.0005 && video.readyState >= 2) {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  return new Promise<void>((resolve, reject) => {
    let done = false;
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      window.clearTimeout(timer);
    };
    const onSeeked = () => {
      if (done) return;
      done = true;
      cleanup();
      // One rAF guarantees the decoded frame reached the element.
      requestAnimationFrame(() => resolve());
    };
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("The video did not seek in time."));
    }, 10000);

    video.addEventListener("seeked", onSeeked);
    video.currentTime = target;
  });
}

function waitForEncoderDrain(encoder: VideoEncoder): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      encoder.removeEventListener("dequeue", done);
      resolve();
    };
    encoder.addEventListener("dequeue", done);
  });
}

/** Decode the source file's audio track into an AudioBuffer. */
async function decodeAudio(url: string): Promise<AudioSource | null> {
  if (!("AudioContext" in window)) return null;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Audio source fetch failed (${response.status})`);
  const bytes = await response.arrayBuffer();

  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(bytes);
    if (!buffer.length) return null;
    return {
      buffer,
      sampleRate: buffer.sampleRate,
      channels: Math.min(2, buffer.numberOfChannels),
    };
  } finally {
    void context.close();
  }
}

async function encodeAudioChunks(
  source: AudioSource,
  start: number,
  duration: number,
  config: AudioEncoderConfig,
  signal: AbortSignal | undefined,
  onProgress: (ratio: number) => void,
): Promise<QueuedAudioChunk[] | null> {
  const support = await AudioEncoder.isConfigSupported(config).catch(() => null);
  if (!support?.supported) return null;

  const { buffer, sampleRate, channels } = source;
  const chunks: QueuedAudioChunk[] = [];
  let error: Error | null = null;

  const encoder = new AudioEncoder({
    output: (chunk, meta) => chunks.push({ chunk, meta }),
    error: (err) => {
      error = err instanceof Error ? err : new Error(String(err));
    },
  });
  encoder.configure(config);

  const firstSample = Math.floor(start * sampleRate);
  const totalSamples = Math.min(
    Math.round(duration * sampleRate),
    Math.max(0, buffer.length - firstSample),
  );
  const planes: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    planes.push(buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1)));
  }

  try {
    for (let offset = 0; offset < totalSamples; offset += AUDIO_SAMPLE_CHUNK) {
      throwIfAborted(signal);
      if (error) throw error;

      const count = Math.min(AUDIO_SAMPLE_CHUNK, totalSamples - offset);
      const data = new Float32Array(count * channels);
      for (let c = 0; c < channels; c++) {
        data.set(
          planes[c].subarray(firstSample + offset, firstSample + offset + count),
          c * count,
        );
      }

      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: count,
        numberOfChannels: channels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data,
      });
      encoder.encode(audioData);
      audioData.close();

      if (encoder.encodeQueueSize > 12) {
        await new Promise<void>((resolve) => {
          const drain = () => {
            encoder.removeEventListener("dequeue", drain);
            resolve();
          };
          encoder.addEventListener("dequeue", drain);
        });
      }

      if (offset % (AUDIO_SAMPLE_CHUNK * 24) === 0) {
        onProgress(Math.min(1, offset / Math.max(1, totalSamples)));
      }
    }

    await encoder.flush();
  } catch (err) {
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      // Already closed.
    }
    throw err;
  }

  encoder.close();
  if (error) throw error;
  return chunks;
}
