import { motion } from "motion/react";
import { ArrowRight, Check, Play, Sparkles } from "lucide-react";
import { CutoutPreview } from "@/components/landing/CutoutPreview";
import { UploadCard } from "@/components/landing/UploadCard";
import { SAMPLES } from "@/lib/samples";
import { useStudio } from "@/store/studio";

interface HeroProps {
  onPick: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ onPick }: HeroProps) {
  const openSample = useStudio((state) => state.openSample);

  return (
    <section id="top" className="relative overflow-hidden pt-[126px] pb-14 sm:pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 h-[540px] w-[840px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,90,54,0.20),transparent)] blur-2xl" />
        <div
          className="absolute top-24 -left-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(108,92,231,0.22),transparent)] blur-2xl"
          style={{ animation: "halo-drift 16s ease-in-out infinite" }}
        />
        <div
          className="absolute top-[420px] -right-24 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(255,90,54,0.14),transparent)] blur-2xl"
          style={{ animation: "halo-drift 21s ease-in-out infinite reverse" }}
        />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(246,243,236,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(246,243,236,0.18) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage:
              "radial-gradient(ellipse 70% 55% at 50% 22%, black 0%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 55% at 50% 22%, black 0%, transparent 75%)",
          }}
        />
      </div>

      <div className="content-max shell-pad relative">
        <motion.div
          className="mx-auto max-w-[1000px] text-center"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
          }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
            }}
            className="flex justify-center"
          >
            <span className="eyebrow">
              <Sparkles className="h-3.5 w-3.5 text-coral" />
              local-first video cutouts
              <span className="ml-1 rounded-full bg-lime/15 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-lime">
                no cloud
              </span>
            </span>
          </motion.div>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 22 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
            }}
            className="mt-7 font-display text-[clamp(48px,7.4vw,92px)] leading-[0.94] font-medium tracking-[-0.045em] text-bone"
          >
            Cut the background.
            <br />
            Keep the{" "}
            <span className="relative inline-block italic text-coral">
              moment
              <svg
                aria-hidden="true"
                viewBox="0 0 320 26"
                className="absolute -bottom-2 left-0 w-full text-coral/40"
              >
                <path
                  d="M3 18 C 78 7, 210 5, 317 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
            }}
            className="mx-auto mt-8 max-w-[640px] text-[15px] leading-relaxed text-bone/55 sm:text-[16px]"
          >
            Studio-grade video background removal that runs{" "}
            <span className="text-bone/82">entirely in this tab</span>. No
            accounts, no credits, no watermark — and your footage never leaves
            your device.
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
            }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <button type="button" onClick={onPick} className="btn btn-primary w-full sm:w-auto">
              Choose a video
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void openSample(SAMPLES[0])}
              className="btn btn-ghost w-full sm:w-auto"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-bone/12">
                <Play className="ml-px h-2.5 w-2.5 fill-current" />
              </span>
              Try a 6-second sample
            </button>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.7, delay: 0.12 } },
            }}
            className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-semibold text-bone/38"
          >
            {["No uploads", "No watermark", "Free + pro features unlocked"].map(
              (item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-lime/80" strokeWidth={3} />
                  {item}
                </span>
              ),
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="mt-12 grid items-stretch gap-3.5 lg:grid-cols-[1.04fr_0.96fr] lg:gap-4"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.22, ease: EASE }}
        >
          <div className="min-h-[500px]">
            <CutoutPreview />
          </div>
          <UploadCard onPick={onPick} />
        </motion.div>

        <div className="relative mt-12 overflow-hidden">
          <div className="flex items-center justify-center gap-6 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div
              className="flex min-w-max items-center gap-6"
              style={{ animation: "marquee-slide 26s linear infinite" }}
            >
              {[...Array(2)].map((_, group) => (
                <div key={group} className="flex items-center gap-6">
                  {[
                    "MP4",
                    "MOV",
                    "WEBM",
                    "MKV",
                    "AVI",
                    "OGG",
                    "UP TO 4K",
                    "AUDIO PRESERVED",
                    "ALPHA EXPORT",
                  ].map((label) => (
                    <span key={`${group}-${label}`} className="flex items-center gap-6">
                      <span className="font-mono text-[10px] tracking-[0.18em] text-bone/26 uppercase">
                        {label}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-bone/20" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
