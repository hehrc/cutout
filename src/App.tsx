import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LandingPage } from "@/components/landing/LandingPage";
import { PreparingOverlay } from "@/components/studio/PreparingOverlay";
import { StudioShell } from "@/components/studio/StudioShell";
import { useStudio } from "@/store/studio";

export default function App() {
  const mode = useStudio((state) => state.mode);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [mode]);

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {mode === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <LandingPage />
          </motion.div>
        ) : (
          <motion.div
            key="studio"
            className="h-dvh overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <StudioShell />
          </motion.div>
        )}
      </AnimatePresence>

      <PreparingOverlay />
    </>
  );
}
