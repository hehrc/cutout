import { motion } from "motion/react";
import {
  Brush,
  Cpu,
  Layers3,
  MonitorUp,
  Sparkles,
  Timer,
  Waves,
} from "lucide-react";

const FEATURES = [
  {
    icon: Cpu,
    tag: "local inference",
    title: "On-device matte",
    copy: "Segmentation runs in a browser worker — no inference API, no per-frame billing, no footage leaving the tab.",
  },
  {
    icon: Waves,
    tag: "temporal smoothing",
    title: "Edges that hold still",
    copy: "A motion-aware mask filter and guided upsampling stop the shimmer that gives cheap cutouts away.",
  },
  {
    icon: Layers3,
    tag: "background suite",
    title: "Any backdrop you want",
    copy: "Transparent, solid, gradient, your own still, or a second video composited behind the subject.",
  },
  {
    icon: Brush,
    tag: "manual control",
    title: "Refine with a brush",
    copy: "Keep or erase by hand, then dial in feather, threshold, and edge expansion to taste.",
  },
  {
    icon: Timer,
    tag: "frame accurate",
    title: "A timeline, not a guess",
    copy: "Scrub, trim in and out, step a frame at a time, and wipe between source and result.",
  },
  {
    icon: MonitorUp,
    tag: "webcodecs",
    title: "Export up to 4K",
    copy: "Render locally in 720p, 1080p, or 4K with the original audio track synchronized and intact.",
  },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export function FeatureGrid() {
  return (
    <section id="product" className="relative py-20 sm:py-28">
      <div className="content-max shell-pad">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[660px]">
            <span className="eyebrow border-bone/12 bg-transparent">
              <Sparkles className="h-3.5 w-3.5 text-coral" />
              the toolkit
            </span>
            <h2 className="mt-6 font-display text-[clamp(36px,4.6vw,58px)] leading-[0.98] font-medium tracking-[-0.04em] text-bone">
              A background suite,
              <br />
              <span className="text-bone/42">not a one-trick filter.</span>
            </h2>
          </div>
          <p className="max-w-[340px] text-[13px] leading-relaxed text-bone/42 md:pb-2">
            Everything the paid tiers gate — transparency, custom backdrops,
            brush work, 4K export — is part of the studio. No upgrade button.
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-70px" }}
                transition={{ duration: 0.5, delay: (index % 3) * 0.07, ease: EASE }}
                className="group relative flex min-h-[228px] flex-col overflow-hidden rounded-[20px] border border-bone/9 bg-ink-soft p-6 transition-colors duration-300 hover:border-bone/18"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-bone/10 bg-bone/4 text-bone/65 transition-colors duration-300 group-hover:border-coral/25 group-hover:bg-coral/10 group-hover:text-coral">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="font-mono text-[8px] tracking-[0.16em] text-bone/24 uppercase">
                    {feature.tag}
                  </span>
                </div>

                <h3 className="mt-7 font-display text-[22px] leading-tight font-medium tracking-[-0.02em] text-bone">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-bone/40">
                  {feature.copy}
                </p>

                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -bottom-10 h-24 w-24 rounded-full bg-coral/8 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
