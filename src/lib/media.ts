import type { VideoMetadata } from "@/types";

export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/ogg",
  "video/x-matroska",
  "video/avi",
  "video/x-msvideo",
  "video/av1",
];

export const ACCEPT_ATTRIBUTE =
  "video/mp4,video/quicktime,video/webm,video/ogg,video/x-matroska,video/avi,.mp4,.m4v,.mov,.webm,.ogv,.mkv,.avi";

export const MAX_FILE_BYTES = 1.5 * 1024 * 1024 * 1024;

const EXTENSION_RE = /\.(mp4|m4v|mov|webm|ogv|ogg|mkv|avi)$/i;

export function isAcceptedVideo(file: File): boolean {
  if (file.type && ACCEPTED_VIDEO_TYPES.includes(file.type)) return true;
  return EXTENSION_RE.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatClock(seconds: number, withFrames = false): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const base = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  if (!withFrames) return base;
  const frames = Math.floor((safe % 1) * 30);
  return `${base}:${String(frames).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const safe = Math.round(seconds);
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function readVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      if (error) reject(error);
    };

    const timer = window.setTimeout(() => {
      finish(new Error("That video took too long to read. Try a smaller file."));
    }, 20_000);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.addEventListener(
      "loadedmetadata",
      () => {
        window.clearTimeout(timer);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const metadata = {
          duration,
          width: video.videoWidth || 0,
          height: video.videoHeight || 0,
        };
        finish();
        resolve(metadata);
      },
      { once: true },
    );

    video.addEventListener(
      "error",
      () => {
        window.clearTimeout(timer);
        finish(
          new Error(
            "This browser could not decode that file. Try MP4 (H.264) or WebM.",
          ),
        );
      },
      { once: true },
    );

    video.src = url;
  });
}

export async function capturePoster(url: string): Promise<string | undefined> {
  try {
    return await new Promise<string | undefined>((resolve) => {
      const video = document.createElement("video");
      let settled = false;

      const finish = (value?: string) => {
        if (settled) return;
        settled = true;
        video.removeAttribute("src");
        video.load();
        resolve(value);
      };

      const timer = window.setTimeout(() => finish(undefined), 6_000);

      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;

      function draw() {
        try {
          const canvas = document.createElement("canvas");
          const width = Math.min(video.videoWidth || 640, 960);
          const ratio = (video.videoHeight || 360) / (video.videoWidth || 640);
          canvas.width = width;
          canvas.height = Math.round(width * ratio);
          const context = canvas.getContext("2d");
          if (!context) {
            window.clearTimeout(timer);
            finish(undefined);
            return;
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL("image/jpeg", 0.82);
          window.clearTimeout(timer);
          finish(data);
        } catch {
          window.clearTimeout(timer);
          finish(undefined);
        }
      }

      video.addEventListener(
        "loadeddata",
        () => {
          const target = Math.min(
            0.12,
            Number.isFinite(video.duration) ? video.duration / 2 : 0.12,
          );
          if (Math.abs(video.currentTime - target) < 0.01) {
            draw();
            return;
          }
          video.currentTime = target;
        },
        { once: true },
      );

      video.addEventListener("seeked", draw, { once: true });

      video.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          finish(undefined);
        },
        { once: true },
      );

      video.src = url;
    });
  } catch {
    return undefined;
  }
}
