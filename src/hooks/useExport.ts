import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "@/store/editor";
import { useStudio } from "@/store/studio";
import { usePlayer } from "@/components/studio/PlayerProvider";
import { isExportSupported } from "@/lib/export-meta";
import type { ExportProgress, ExportResult } from "@/lib/exporter";

export type ExportStatus = "idle" | "running" | "done" | "error";

export interface ExportDownload {
  url: string;
  name: string;
  size: number;
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
  flattened: boolean;
  extension: "mp4" | "webm";
  container: "MP4" | "WebM";
}

export interface ExportValue {
  supported: boolean;
  status: ExportStatus;
  progress: ExportProgress | null;
  download: ExportDownload | null;
  error: string | null;
  start: () => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/** Drive a full local render: matte, composite, encode, mux, download. */
export function useExport(): ExportValue {
  const source = useStudio((state) => state.source);
  const { video, pause } = usePlayer();
  const {
    exportPreset: preset,
    aspect,
    backdrop,
    backdropMedia,
    backdropBlur,
    strokes,
    trimStart,
    trimEnd,
    feather,
    threshold,
    expand,
    subjectLock,
    keepAudio,
    setExporting,
  } = useEditor();

  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [download, setDownload] = useState<ExportDownload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const downloadRef = useRef<ExportDownload | null>(null);
  downloadRef.current = download;

  const revoke = useCallback(() => {
    const current = downloadRef.current;
    if (current) URL.revokeObjectURL(current.url);
    downloadRef.current = null;
    setDownload(null);
  }, []);

  useEffect(() => () => revoke(), [revoke]);

  const reset = useCallback(() => {
    if (status === "running") return;
    revoke();
    setStatus("idle");
    setProgress(null);
    setError(null);
  }, [revoke, status]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    if (!source || !video || status === "running") return;

    const controller = new AbortController();
    abortRef.current = controller;

    pause();
    revoke();
    setStatus("running");
    setProgress({ phase: "preparing", frame: 0, frames: 0, ratio: 0 });
    setError(null);
    setExporting(true);

    try {
      const end = trimEnd > 0 ? Math.min(trimEnd, source.duration) : source.duration;
      const start = Math.min(Math.max(0, trimStart), Math.max(0, end - 0.1));
      const duration = Math.max(0.1, end - start);

      // Keep the muxers and renderer out of the initial bundle.
      const { renderExport } = await import("@/lib/exporter");
      const result: ExportResult = await renderExport({
        video,
        sourceUrl: source.url,
        start,
        duration,
        preset,
        aspect,
        backdrop,
        backdropMedia,
        backdropBlur,
        strokes,
        feather,
        threshold,
        expand,
        subjectLock,
        audio: keepAudio,
        signal: controller.signal,
        onProgress: (next) => setProgress(next),
      });

      const url = URL.createObjectURL(result.blob);
      const next: ExportDownload = {
        url,
        name: `${slug(source.name)}-cutout-${preset}.${result.extension}`,
        size: result.blob.size,
        width: result.width,
        height: result.height,
        duration: result.duration,
        hasAudio: result.hasAudio,
        flattened: result.flattened,
        extension: result.extension,
        container: result.container,
      };
      downloadRef.current = next;
      setDownload(next);
      setStatus("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        setProgress(null);
      } else {
        console.error("[export] Render failed", err);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
      setExporting(false);
    }
  }, [
    source,
    video,
    pause,
    revoke,
    setExporting,
    status,
    preset,
    aspect,
    backdrop,
    backdropMedia,
    backdropBlur,
    strokes,
    trimStart,
    trimEnd,
    feather,
    threshold,
    expand,
    subjectLock,
    keepAudio,
  ]);

  return {
    supported: isExportSupported(),
    status,
    progress,
    download,
    error,
    start,
    cancel,
    reset,
  };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "clip"
  );
}
