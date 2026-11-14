import { create } from "zustand";
import { capturePoster, isAcceptedVideo, MAX_FILE_BYTES, readVideoMetadata } from "@/lib/media";
import type { MediaSource, SampleClip, StudioMode } from "@/types";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `source-${Date.now()}`;
}

interface PrepareState {
  active: boolean;
  progress: number;
  label: string;
  detail: string;
}

interface StudioStore {
  mode: StudioMode;
  source: MediaSource | null;
  prepare: PrepareState;
  error: string | null;
  openFile: (file: File) => Promise<void>;
  openSample: (sample: SampleClip) => Promise<void>;
  exitStudio: () => void;
  clearError: () => void;
}

const idlePrepare: PrepareState = {
  active: false,
  progress: 0,
  label: "",
  detail: "",
};

export const useStudio = create<StudioStore>()((set, get) => {
  const beginPrepare = (label: string, detail: string) =>
    set({
      prepare: { active: true, progress: 6, label, detail },
      error: null,
    });

  const tickProgress = () => {
    let value = get().prepare.progress;
    const timer = window.setInterval(() => {
      value = Math.min(93, value + (94 - value) * 0.16 + 0.6);
      set((state) =>
        state.prepare.active
          ? { prepare: { ...state.prepare, progress: value } }
          : {},
      );
    }, 110);
    return () => window.clearInterval(timer);
  };

  const commit = async (source: MediaSource) => {
    set({ prepare: { ...get().prepare, progress: 100 } });
    await wait(420);
    set({
      source,
      mode: "studio",
      prepare: idlePrepare,
    });
  };

  return {
    mode: "landing",
    source: null,
    prepare: idlePrepare,
    error: null,

    openFile: async (file: File) => {
      if (!isAcceptedVideo(file)) {
        set({
          error: "That doesn’t look like a video. Use MP4, MOV, WebM, OGG, MKV, or AVI.",
        });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        set({ error: "That file is over 1.5 GB. Try a shorter clip or a smaller export." });
        return;
      }

      beginPrepare("Preparing your studio", file.name);
      const url = URL.createObjectURL(file);
      const stop = tickProgress();

      try {
        const [metadata, poster] = await Promise.all([
          readVideoMetadata(url),
          capturePoster(url),
          wait(1_050),
        ]);

        stop();

        if (!metadata.width || !metadata.height) {
          throw new Error("We couldn’t read a video track in that file.");
        }

        const previous = get().source;
        if (previous?.ownedUrl) URL.revokeObjectURL(previous.url);

        await commit({
          id: newId(),
          name: file.name.replace(/\.[a-z0-9]+$/i, "") || "Untitled clip",
          url,
          poster,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
          size: file.size,
          kind: "video",
          ownedUrl: true,
        });
      } catch (error) {
        stop();
        URL.revokeObjectURL(url);
        set({
          prepare: idlePrepare,
          error:
            error instanceof Error
              ? error.message
              : "That file could not be opened. Try another video.",
        });
      }
    },

    openSample: async (sample: SampleClip) => {
      beginPrepare("Loading the sample", `${sample.name} · ${sample.note}`);
      const stop = tickProgress();

      try {
        let metadata = {
          duration: sample.duration,
          width: sample.width,
          height: sample.height,
        };
        try {
          metadata = await readVideoMetadata(sample.url);
        } catch {
          // Keep the declared metadata if the browser refuses a second read.
        }
        await wait(850);
        stop();

        const previous = get().source;
        if (previous?.ownedUrl) URL.revokeObjectURL(previous.url);

        await commit({
          id: newId(),
          name: sample.name,
          url: sample.url,
          poster: sample.poster,
          duration: metadata.duration || sample.duration,
          width: metadata.width || sample.width,
          height: metadata.height || sample.height,
          size: sample.size,
          kind: "video",
          sampleId: sample.id,
          ownedUrl: false,
        });
      } catch {
        stop();
        set({
          prepare: idlePrepare,
          error: "The sample could not be loaded. Try uploading your own clip.",
        });
      }
    },

    exitStudio: () => {
      const { source } = get();
      if (source?.ownedUrl) URL.revokeObjectURL(source.url);
      set({ mode: "landing", source: null, prepare: idlePrepare, error: null });
    },

    clearError: () => set({ error: null }),
  };
});
