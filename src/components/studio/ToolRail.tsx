import {
  Crop,
  Download,
  Layers3,
  Lock,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TOOL_META, useEditor, type ToolId } from "@/store/editor";

const TOOLS: Array<{ id: ToolId; icon: typeof Layers3 }> = [
  { id: "background", icon: Layers3 },
  { id: "refine", icon: SlidersHorizontal },
  { id: "frame", icon: Crop },
  { id: "export", icon: Download },
];

interface ToolRailProps {
  orientation?: "vertical" | "horizontal";
}

export function ToolRail({ orientation = "vertical" }: ToolRailProps) {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const vertical = orientation === "vertical";

  return (
    <nav
      aria-label="Editor tools"
      className={cn(
        "flex bg-paper-deep/45",
        vertical
          ? "w-[74px] shrink-0 flex-col items-center gap-1 border-r border-stage-line py-3"
          : "shrink-0 snap-x items-center gap-1 overflow-x-auto border-b border-stage-line px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
      {TOOLS.map((item) => {
        const Icon = item.icon;
        const active = tool === item.id;
        const meta = TOOL_META[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTool(item.id)}
            aria-pressed={active}
            title={meta.label}
            className={cn(
              "group relative flex items-center rounded-xl transition-all duration-200",
              vertical
                ? "w-[60px] flex-col gap-1.5 px-1 py-2.5"
                : "shrink-0 snap-start gap-2 px-3 py-2.5",
              active
                ? "bg-ink text-paper shadow-[0_8px_22px_-12px_rgba(11,11,15,0.7)]"
                : "text-muted-dark hover:bg-ink/6 hover:text-ink",
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                vertical ? "h-[18px] w-[18px]" : "h-4 w-4",
              )}
              strokeWidth={active ? 2 : 1.8}
            />
            <span
              className={cn(
                "font-semibold",
                vertical
                  ? "text-[9px] tracking-[0.04em]"
                  : "text-[12px] whitespace-nowrap",
              )}
            >
              {meta.label}
            </span>
          </button>
        );
      })}

      {vertical && (
        <span className="mt-auto flex flex-col items-center gap-1.5 pt-4 text-muted-dark/70">
          <Lock className="h-3 w-3" />
          <span className="font-mono text-[8px] tracking-[0.14em] uppercase">
            local
          </span>
        </span>
      )}
    </nav>
  );
}
