import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PlayerProvider, usePlayer } from "@/components/studio/PlayerProvider";
import { Stage } from "@/components/studio/Stage";
import { QuickBar } from "@/components/studio/QuickBar";
import { Timeline } from "@/components/studio/Timeline";
import { ToolPanels } from "@/components/studio/ToolPanels";
import { ToolRail } from "@/components/studio/ToolRail";
import { TopBar } from "@/components/studio/TopBar";
import { useEditor } from "@/store/editor";
import { useStudio } from "@/store/studio";

export function StudioShell() {
  const source = useStudio((state) => state.source);
  if (!source) return null;
  return (
    <PlayerProvider source={source}>
      <Shell />
    </PlayerProvider>
  );
}

function Shell() {
  const panelOpen = useEditor((state) => state.panelOpen);
  const setPanelOpen = useEditor((state) => state.setPanelOpen);
  const { toggle, step, toggleMute } = usePlayer();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='slider']",
        )
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key === "Escape") {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, step, toggleMute, setPanelOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <TopBar />

      <div className="relative flex min-h-0 flex-1">
        <div className="hidden shrink-0 md:block">
          <ToolRail />
        </div>

        <aside className="hidden w-[296px] shrink-0 overflow-hidden border-r border-stage-line bg-paper lg:block">
          <ToolPanels />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="md:hidden">
            <ToolRail orientation="horizontal" />
          </div>
          <Stage />
          <QuickBar />
          <Timeline />
        </div>
      </div>

      <AnimatePresence>
        {panelOpen && (
          <>
            <motion.button
              key="scrim"
              type="button"
              aria-label="Close tool panel"
              onClick={() => setPanelOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[2px] lg:hidden"
            />
            <motion.aside
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden overscroll-contain rounded-t-[22px] border-t border-stage-line bg-paper shadow-[0_-24px_80px_-30px_rgba(20,16,8,0.45)] lg:hidden"
              aria-label="Tool panel"
            >
              <div className="flex shrink-0 justify-center py-2">
                <span className="h-1 w-10 rounded-full bg-ink/15" />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ToolPanels onClose={() => setPanelOpen(false)} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
