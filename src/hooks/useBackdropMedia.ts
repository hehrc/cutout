import { useEffect, useState } from "react";
import type { BackdropElement, BackdropMedia } from "@/lib/backdrop";
import { loadBackdropImage } from "@/lib/backdrop";

/**
 * Keep a live image/video element for the selected backdrop. The element is
 * handed to the compositor; videos loop softly behind the cutout.
 */
export function useBackdropMedia(media: BackdropMedia | null): BackdropElement | null {
  const [element, setElement] = useState<BackdropElement | null>(null);

  useEffect(() => {
    if (!media) {
      setElement(null);
      return;
    }

    let cancelled = false;
    setElement(null);

    if (media.kind === "image") {
      loadBackdropImage(media.url)
        .then((image) => {
          if (!cancelled) setElement(image);
        })
        .catch(() => {
          if (!cancelled) setElement(null);
        });
      return () => {
        cancelled = true;
      };
    }

    const video = document.createElement("video");
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    const onReady = () => {
      if (cancelled) return;
      void video.play().catch(() => undefined);
      setElement(video);
    };

    video.addEventListener("loadeddata", onReady, { once: true });

    video.src = media.url;
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onReady);
      cleanup();
    };
  }, [media?.kind, media?.url]);

  return element;
}
