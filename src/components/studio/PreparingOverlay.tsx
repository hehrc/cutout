import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useStudio } from "@/store/studio";

export function PreparingOverlay() {
  const prepare = useStudio((state) => state.prepare);

  return (
    <AnimatePresence>
      {prepare.active && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/95 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="w-full max-w-[520px]"
            initial={{ y: 18, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-10 flex items-center justify-between">
              <Logo />
              <span className="font-mono text-[10px] tracking-[0.22em] text-bone/40 uppercase">
                local session
              </span>
            </div>

            <div className="relative mb-6 overflow-hidden rounded-2xl border border-bone/10 bg-ink-soft p-5">
              <div className="flex items-center gap-4">
                <div className="checkerboard-sm relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-ink/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-bone">
                    {prepare.label}
                  </p>
                  <p className="mt-1 truncate text-[12px] text-bone/45">
                    {prepare.detail}
                  </p>
                </div>
                <span className="ml-auto font-mono text-[12px] text-bone/55 tabular-nums">
                  {Math.round(prepare.progress)}%
                </span>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-bone/10">
                <motion.div
                  className="h-full rounded-full bg-coral"
                  animate={{ width: `${prepare.progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
                <div
                  className="h-full w-24 bg-gradient-to-r from-transparent via-bone/10 to-transparent"
                  style={{ animation: "shimmer-sweep 2.4s linear infinite" }}
                />
              </div>
            </div>

            <ul className="space-y-2.5">
              {[
                { at: 20, label: "Read the video track", done: prepare.progress > 24 },
                { at: 55, label: "Build a local preview", done: prepare.progress > 62 },
                { at: 88, label: "Open the studio", done: prepare.progress > 94 },
              ].map((step) => (
                <li
                  key={step.label}
                  className="flex items-center gap-2.5 text-[12px] text-bone/45"
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border ${
                      step.done
                        ? "border-lime/30 bg-lime/15 text-lime"
                        : "border-bone/15 text-bone/25"
                    }`}
                  >
                    <Check className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  {step.label}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-center font-mono text-[10px] tracking-[0.16em] text-bone/25 uppercase">
              nothing is uploaded — ever
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
