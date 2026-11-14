import {
  ArrowLeft,
  Download,
  Lock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { formatBytes, formatDuration } from "@/lib/media";
import { usePlayer } from "@/components/studio/PlayerProvider";
import { useEditor } from "@/store/editor";
import { useStudio } from "@/store/studio";

export function TopBar() {
  const source = useStudio((state) => state.source);
  const exitStudio = useStudio((state) => state.exitStudio);
  const setTool = useEditor((state) => state.setTool);
  const { muted, toggleMute } = usePlayer();

  if (!source) return null;

  return (
    <header className="flex min-h-[58px] shrink-0 items-center gap-1.5 border-b border-stage-line bg-paper px-2 pt-[env(safe-area-inset-top)] pb-1 sm:gap-3 sm:px-4 sm:pb-0">
      <button
        type="button"
        onClick={exitStudio}
        aria-label="Back to Cutout Studio home"
        className="group flex h-10 items-center gap-1.5 rounded-full px-2 text-ink transition-colors hover:bg-ink/6 sm:h-9"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
        <span className="hidden text-[12px] font-semibold sm:inline">Home</span>
      </button>

      <div className="hidden items-center gap-3 sm:flex">
        <Logo tone="dark" subtitle={false} />
        <span className="h-5 w-px bg-stage-line" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate text-[12.5px] leading-tight font-semibold text-ink sm:text-[13px]">
          {source.name}
        </p>
        <p className="mt-0.5 hidden truncate font-mono text-[9.5px] leading-none tracking-[0.04em] text-muted-dark sm:block">
          {source.width}×{source.height} · {formatDuration(source.duration)} ·{" "}
          {formatBytes(source.size)}
          {source.sampleId ? " · sample" : ""}
        </p>
      </div>

      <span className="hidden items-center gap-1.5 rounded-full border border-ink/10 bg-ink/[0.03] px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] text-muted-dark uppercase md:inline-flex">
        <Lock className="h-2.5 w-2.5" />
        on this device
      </span>

      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute preview" : "Mute preview"}
        aria-pressed={!muted}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink/70 transition-colors hover:bg-ink/6 hover:text-ink sm:h-9 sm:w-9"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={() => setTool("export")}
        className="btn btn-ink h-10 shrink-0 px-3.5 text-[12px] sm:h-9 sm:px-4"
      >
        <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        Export
      </button>
    </header>
  );
}
