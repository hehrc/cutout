export interface BackdropMedia {
  kind: "image" | "video";
  url: string;
  name: string;
}

export type BackdropElement = HTMLImageElement | HTMLVideoElement;

export function loadBackdropImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The backdrop image could not be decoded."));
    image.src = url;
  });
}

export function loadBackdropVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) {
        reject(error);
        return;
      }
      resolve(video);
    };
    const timer = window.setTimeout(
      () => finish(new Error("The backdrop video took too long to load.")),
      20_000,
    );

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    video.addEventListener(
      "loadeddata",
      () => {
        void video.play().catch(() => undefined);
        finish();
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => finish(new Error("The backdrop video could not be decoded.")),
      { once: true },
    );

    video.src = url;
  });
}

export function loadBackdropElement(media: BackdropMedia): Promise<BackdropElement> {
  return media.kind === "image"
    ? loadBackdropImage(media.url)
    : loadBackdropVideo(media.url);
}

/** Seek a video and wait until the frame at that time is decoded. */
export function seekMedia(video: HTMLVideoElement, time: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const target = duration
    ? Math.min(Math.max(0, time), Math.max(0, duration - 0.001))
    : Math.max(0, time);

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
      requestAnimationFrame(() => resolve());
    };
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("The backdrop video did not seek in time."));
    }, 10_000);

    video.addEventListener("seeked", onSeeked);
    video.currentTime = target;
  });
}
