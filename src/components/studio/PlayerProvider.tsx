import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { MediaSource } from "@/types";
import { useEditor } from "@/store/editor";

interface PlayerValue {
  attach: (element: HTMLVideoElement | null) => void;
  /** The live preview element, used by the export renderer. */
  video: HTMLVideoElement | null;
  playing: boolean;
  ready: boolean;
  muted: boolean;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  step: (frames: number) => void;
  toggleMute: () => void;
}

const PlayerContext = createContext<PlayerValue | null>(null);
/**
 * The playback clock lives in its own context so a moving playhead only
 * re-renders the small time readouts instead of the whole studio tree. The
 * provider pushes it at ~15 Hz — enough for a smooth scrubber, far cheaper than
 * 60 Hz React updates.
 */
const PlayerClockContext = createContext<number>(0);

export function usePlayer(): PlayerValue {
  const value = useContext(PlayerContext);
  if (!value) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return value;
}

/** Current playhead time in seconds. Re-renders only the caller. */
export function usePlayerTime(): number {
  return useContext(PlayerClockContext);
}

interface PlayerProviderProps {
  source: MediaSource;
  children: ReactNode;
}

const FRAME = 1 / 30;
const CLOCK_INTERVAL_MS = 66;

export function PlayerProvider({ source, children }: PlayerProviderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [clock, setClock] = useState(0);
  const [duration, setDuration] = useState(source.duration || 0);

  const trimStart = useEditor((state) => state.trimStart);
  const trimEnd = useEditor((state) => state.trimEnd);
  const trimRef = useRef({ start: 0, end: 0 });
  trimRef.current = { start: trimStart, end: trimEnd };

  const attach = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    setVideo(element);
  }, []);

  useEffect(() => {
    setClock(0);
    setReady(false);
    setPlaying(false);
    setDuration(source.duration || 0);
    // A new clip starts with a clean timeline and no painted corrections.
    useEditor.getState().resetEdits();
  }, [source.url, source.duration]);

  useEffect(() => {
    if (!video) return;

    video.muted = true;
    setMuted(true);

    const onLoaded = () => {
      setReady(true);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
      const { start } = trimRef.current;
      if (start > 0 && video.currentTime < start) {
        video.currentTime = start;
      }
      video.play().catch(() => {
        // Autoplay can be blocked; the transport still works.
      });
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setClock(video.duration || 0);
    };
    // Native timeupdate fires ~4×/s; the rAF loop below supplies the smooth
    // updates while playing.
    const onTime = () => setClock(video.currentTime);
    const onVolume = () => setMuted(video.muted);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("volumechange", onVolume);

    if (video.readyState >= 1) {
      onLoaded();
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("volumechange", onVolume);
    };
  }, [video]);

  useEffect(() => {
    if (!playing || !video) return;
    let frame = 0;
    let lastPush = 0;
    const loop = (now: number) => {
      const { start, end } = trimRef.current;
      const max = Number.isFinite(video.duration) ? video.duration : end;
      const stop = end > 0 ? Math.min(end, max) : 0;
      if (stop > start + 0.05 && video.currentTime >= stop - 0.02) {
        video.currentTime = start;
        lastPush = now;
        setClock(start);
      } else if (now - lastPush >= CLOCK_INTERVAL_MS) {
        lastPush = now;
        setClock(video.currentTime);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, video]);

  const startFromTrim = useCallback((element: HTMLVideoElement) => {
    const { start, end } = trimRef.current;
    const max = Number.isFinite(element.duration) ? element.duration : 0;
    const stop = end > 0 ? Math.min(end, max || end) : max;
    if (
      element.currentTime < start ||
      (stop > start + 0.05 && element.currentTime >= stop - 0.02) ||
      (max > 0 && element.currentTime >= max - 0.02)
    ) {
      element.currentTime = Math.min(start, Math.max(0, max - 0.01));
    }
  }, []);

  const play = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    startFromTrim(element);
    void element.play().catch(() => undefined);
  }, [startFromTrim]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      startFromTrim(el);
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [startFromTrim]);

  const seek = useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      const max = Number.isFinite(el.duration) ? el.duration : (source.duration || 0);
      const next = Math.min(Math.max(0, seconds), Math.max(0, max - 0.02));
      el.currentTime = next;
      setClock(next);
    },
    [source.duration],
  );

  const step = useCallback(
    (frames: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.pause();
      seek(el.currentTime + frames * FRAME);
    },
    [seek],
  );

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  const value = useMemo<PlayerValue>(
    () => ({
      attach,
      video,
      playing,
      ready,
      muted,
      duration,
      play,
      pause,
      toggle,
      seek,
      step,
      toggleMute,
    }),
    [
      attach,
      video,
      playing,
      ready,
      muted,
      duration,
      play,
      pause,
      toggle,
      seek,
      step,
      toggleMute,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerClockContext.Provider value={clock}>
        {children}
      </PlayerClockContext.Provider>
    </PlayerContext.Provider>
  );
}
