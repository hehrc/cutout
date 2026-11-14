import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  FileVideo2,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { formatDuration } from "@/lib/media";
import { SAMPLES } from "@/lib/samples";
import { useStudio } from "@/store/studio";
import { cn } from "@/lib/cn";

interface UploadCardProps {
  onPick: () => void;
}

export function UploadCard({ onPick }: UploadCardProps) {
  const dragCounter = useRef(0);
  const [dragActive, setDragActive] = useState(false);
  const openFile = useStudio((state) => state.openFile);
  const openSample = useStudio((state) => state.openSample);
  const error = useStudio((state) => state.error);
  const clearError = useStudio((state) => state.clearError);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void openFile(file);
  };

  return (
    <div className="card-dark flex h-full flex-col p-3 sm:p-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a video: open the file picker, or drop a file here"
        onClick={onPick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPick();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragCounter.current += 1;
          setDragActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
        className={cn(
          "group relative flex min-h-[286px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[18px] border border-dashed px-6 py-10 text-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          dragActive
            ? "border-coral bg-coral/10"
            : "border-bone/16 bg-bone/[0.018] hover:border-bone/32 hover:bg-bone/[0.032]",
        )}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-coral/18 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ opacity: dragActive ? 1 : 0.4 }}
        />

        <span
          className={cn(
            "relative grid h-16 w-16 place-items-center rounded-2xl border transition-all duration-300",
            dragActive
              ? "scale-105 border-coral/40 bg-coral text-[#1a0c07]"
              : "border-bone/12 bg-bone/6 text-bone/75 group-hover:-translate-y-1 group-hover:border-bone/20 group-hover:text-bone",
          )}
        >
          <UploadCloud className="h-6 w-6" strokeWidth={1.7} />
        </span>

        <h3 className="relative mt-6 font-display text-[27px] leading-tight font-medium tracking-[-0.02em] text-bone">
          {dragActive ? "Let it go — we’ve got it" : "Drop a clip right here"}
        </h3>
        <p className="relative mt-2 max-w-[280px] text-[13px] leading-relaxed text-bone/48">
          Or pick a video from your device. It opens straight into the studio —
          no upload, no queue.
        </p>

        <span className="btn btn-primary pointer-events-none relative mt-6 h-11 px-5 text-[13px]">
          <FileVideo2 className="h-4 w-4" />
          Choose a video
        </span>

        <p className="relative mt-4 font-mono text-[9px] tracking-[0.12em] text-bone/28 uppercase">
          mp4 · mov · webm · mkv · ogv — up to 1.5 gb
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-coral/25 bg-coral/10 px-3 py-2.5 text-[12px] text-coral-soft"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <p className="flex-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="rounded-md p-0.5 text-coral-soft/70 hover:text-coral-soft"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-4 px-1">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-[0.1em] text-bone/38 uppercase">
            Or test a sample
          </p>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-bone/28 uppercase">
            <ShieldCheck className="h-3 w-3" />
            local files
          </span>
        </div>

        <div className="space-y-1.5">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => void openSample(sample)}
              className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-bone/[0.025] p-2 text-left transition-all duration-200 hover:border-bone/12 hover:bg-bone/[0.055]"
            >
              <img
                src={sample.poster}
                alt=""
                loading="lazy"
                className="h-10 w-16 shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-bone/82">
                  {sample.name}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-bone/38">
                  {sample.note}
                </span>
              </span>
              <span className="font-mono text-[10px] text-bone/30 tabular-nums">
                {formatDuration(sample.duration)}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-bone/30 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-coral" />
            </button>
          ))}
        </div>
      </div>

      <p className="mt-auto px-1 pt-4 font-mono text-[9px] leading-relaxed tracking-[0.08em] text-bone/22 uppercase">
        Decoding happens in this tab. Nothing is sent anywhere.
      </p>
    </div>
  );
}
