import { useState } from "react";
import { motion } from "motion/react";
import { ScanLine, Sparkles, UploadCloud, Wand2 } from "lucide-react";
import { PlantCutout } from "@/components/landing/PlantCutout";

const STEPS = [
  {
    number: "01",
    icon: UploadCloud,
    title: "Drop your clip",
    copy: "Pick a video and it decodes right here. No queue, no server, no file-size roulette.",
  },
  {
    number: "02",
    icon: ScanLine,
    title: "The local engine cuts",
    copy: "An on-device matte separates your subject frame by frame, with temporal smoothing to kill the jitter.",
  },
  {
    number: "03",
    icon: Wand2,
    title: "Style and export",
    copy: "Swap the backdrop, refine the edge, trim the timeline, then render up to 4K with the audio intact.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function HowItWorks() {
  const [position, setPosition] = useState(58);

  return (
    <section id="how" className="relative py-20 sm:py-28">
      <div className="content-max shell-pad">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[620px]">
            <span className="eyebrow border-bone/12 bg-transparent">
              <Sparkles className="h-3.5 w-3.5 text-coral" />
              the flow
            </span>
            <h2 className="mt-6 font-display text-[clamp(36px,4.6vw,58px)] leading-[0.98] font-medium tracking-[-0.04em] text-bone">
              Three moves.
              <br />
              <span className="text-bone/42">Zero round trips.</span>
            </h2>
          </div>
          <p className="max-w-[340px] text-[13px] leading-relaxed text-bone/42 md:pb-2">
            Most background removers upload your footage, queue it, and hand it
            back with a watermark. This one does the work in your browser.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.article
                key={step.number}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: EASE }}
                className="group relative overflow-hidden rounded-[20px] border border-bone/9 bg-ink-soft p-6 transition-colors duration-300 hover:border-bone/18"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-bone/28">
                    {step.number}
                  </span>
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-bone/10 bg-bone/4 text-bone/55 transition-colors duration-300 group-hover:border-coral/25 group-hover:bg-coral/10 group-hover:text-coral">
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                </div>
                <h3 className="mt-8 font-display text-[24px] leading-tight font-medium tracking-[-0.02em] text-bone">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-bone/42">
                  {step.copy}
                </p>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -bottom-12 h-28 w-28 rounded-full bg-coral/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mt-4 grid overflow-hidden rounded-[24px] border border-bone/9 bg-ink-soft lg:grid-cols-[0.78fr_1.22fr]"
        >
          <div className="flex flex-col justify-between gap-10 p-7 sm:p-9">
            <div>
              <span className="font-mono text-[9px] tracking-[0.2em] text-bone/30 uppercase">
                alpha, not approximation
              </span>
              <h3 className="mt-4 font-display text-[clamp(28px,3vw,40px)] leading-[1.02] font-medium tracking-[-0.03em] text-bone">
                A real transparency channel.
              </h3>
              <p className="mt-4 max-w-[360px] text-[13px] leading-relaxed text-bone/45">
                The cutout is an actual alpha matte — not a blurred square or a
                fake green screen. Drag the divider to see what survives.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-bone/8 pt-5">
              {[
                ["30 fps", "live preview target"],
                ["4K", "local export"],
                ["0", "bytes uploaded"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-[22px] leading-none text-bone">
                    {value}
                  </p>
                  <p className="mt-1.5 text-[9px] leading-tight tracking-[0.08em] text-bone/32 uppercase">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden border-t border-bone/8 lg:border-t-0 lg:border-l">
            {/* Before */}
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#ffb37a_0%,#ff5a36_46%,#a3240c_100%)]">
              <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_20%_10%,rgba(255,255,255,.22),transparent)]" />
              <PlantCutout className="absolute bottom-8 left-1/2 w-[56%] max-w-[320px] -translate-x-1/2 opacity-95" />
            </div>

            {/* After */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            >
              <div className="checkerboard absolute inset-0" />
              <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_65%_20%,rgba(108,92,231,.24),transparent)]" />
              <PlantCutout className="absolute bottom-8 left-1/2 w-[56%] max-w-[320px] -translate-x-1/2 drop-shadow-[0_24px_24px_rgba(0,0,0,.18)]" />
            </div>

            <span className="pointer-events-none absolute top-5 left-5 rounded-full border border-white/22 bg-black/30 px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] text-white/85 uppercase backdrop-blur-md">
              before
            </span>
            <span className="pointer-events-none absolute top-5 right-5 rounded-full border border-lime/30 bg-black/30 px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] text-lime uppercase backdrop-blur-md">
              after · alpha
            </span>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white/90 shadow-[0_0_16px_rgba(0,0,0,.45)]"
              style={{ left: `${position}%` }}
            >
              <span className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-ink/80 text-bone backdrop-blur-md">
                <span className="font-mono text-[10px] tracking-tight">‹›</span>
              </span>
            </div>

            <input
              type="range"
              min={4}
              max={96}
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
              aria-label="Compare original footage with the local cutout"
              className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
