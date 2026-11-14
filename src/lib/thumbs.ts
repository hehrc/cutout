/**
 * Grab evenly spaced frames from a local video for the timeline strip.
 * Everything happens on a detached <video> + canvas — no network, no worker.
 */
export function extractThumbnails(
  url: string,
  count = 12,
): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const frames: string[] = [];
    let index = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(frames);
    };

    const timer = window.setTimeout(finish, 15_000);

    const grab = () => {
      if (settled) return;
      try {
        const width = 180;
        const height = Math.max(
          60,
          Math.round(width * ((video.videoHeight || 9) / (video.videoWidth || 16))),
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(video, 0, 0, width, height);
          frames.push(canvas.toDataURL("image/jpeg", 0.6));
        }
      } catch {
        finish();
        return;
      }

      index += 1;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (index >= count || duration <= 0) {
        finish();
        return;
      }
      video.currentTime = Math.min(duration - 0.03, (duration * index) / count);
    };

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.addEventListener(
      "loadeddata",
      () => {
        grab();
      },
      { once: true },
    );
    video.addEventListener("seeked", grab);
    video.addEventListener("error", finish, { once: true });

    video.src = url;
  });
}
