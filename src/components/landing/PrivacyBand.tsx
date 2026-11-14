import { motion } from "motion/react";
import {
  ArrowUpRight,
  Cpu,
  FileVideo2,
  Fingerprint,
  Lock,
  MonitorUp,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

interface PrivacyBandProps {
  onPick: () => void;
}

const POINTS = [
  {
    icon: WifiOff,
    title: "No upload, at any file size",
    copy: "Your video is read from disk into memory. There is no upload endpoint in this app.",
  },
  {
    icon: Fingerprint,
    title: "No account, no fingerprint",
    copy: "No sign-in, no cookies, no analytics, no device fingerprint. Open the tab and work.",
  },
  {
    icon: Lock,
    title: "The matte stays yours",
    copy: "Segmentation, compositing, and encoding all run in this browser tab — and nowhere else.",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

export function PrivacyBand({ onPick }: PrivacyBandProps) {
  return (
    <section id="privacy" className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute top-1/3 -left-40 h-[480px] w-[480px] rounded-full bg-[radial-gradient(closest-side,rgba(199,244,100,0.10),transparent)] blur-2xl" />
        <div className="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(108,92,231,0.14),transparent)] blur-2xl" />
      </div>

      <div className="content-max shell-pad relative grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <span className="eyebrow border-bone/12 bg-transparent">
            <ShieldCheck className="h-3.5 w-3.5 text-lime" />
            privacy by architecture
          </span>

          <h2 className="mt-6 font-display text-[clamp(38px,5vw,64px)] leading-[0.96] font-medium tracking-[-0.045em] text-bone">
            The cloud isn’t
            <br />
            <span className="italic text-lime">in this loop.</span>
          </h2>

          <p className="mt-6 max-w-[460px] text-[14px] leading-relaxed text-bone/50">
            Most tools say “your files are safe” and then upload them anyway.
            Cutout Studio has nothing to upload to — the matte is computed by
            your GPU, in the tab you already have open.
          </p>

          <ul className="mt-9 space-y-4">
            {POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-bone/10 bg-bone/4 text-lime/85">
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-bone/88">
                      {point.title}
                    </p>
                    <p className="mt-1 max-w-[360px] text-[11.5px] leading-relaxed text-bone/40">
                      {point.copy}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={onPick}
            className="btn btn-ghost mt-9 h-11"
          >
            Open the studio
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
          className="card-dark relative overflow-hidden p-6 sm:p-7"
        >
          <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-lime/10 blur-3xl" />

          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[9px] tracking-[0.2em] text-bone/35 uppercase">
              session diagram
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/20 bg-lime/8 px-2.5 py-1 font-mono text-[8.5px] tracking-[0.12em] text-lime/85 uppercase">
              <span
                className="h-1.5 w-1.5 rounded-full bg-lime"
                style={{ animation: "pulse-dot 2.2s ease-in-out infinite" }}
              />
              sealed locally
            </span>
          </div>

          <div className="relative mt-6 rounded-2xl border border-dashed border-lime/22 bg-ink/40 p-4 sm:p-5">
            <span className="absolute -top-2.5 left-4 bg-ink-soft px-2 font-mono text-[8px] tracking-[0.16em] text-lime/60 uppercase">
              this browser tab
            </span>

            <div className="space-y-0">
              <DiagramNode
                icon={FileVideo2}
                step="01"
                title="Your clip"
                detail="Read from disk · stays in memory"
              />
              <Connector />
              <DiagramNode
                icon={Cpu}
                step="02"
                title="Local matte engine"
                detail="WebGL2 + on-device segmentation"
                accent
              />
              <Connector />
              <DiagramNode
                icon={MonitorUp}
                step="03"
                title="Styled export"
                detail="WebCodecs · MP4 or WebM · audio kept"
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-bone/8 pt-4">
              {[
                ["0 B", "uploaded"],
                ["0", "requests"],
                ["1", "device"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-[20px] leading-none text-bone">
                    {value}
                  </p>
                  <p className="mt-1 font-mono text-[8px] tracking-[0.1em] text-bone/30 uppercase">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[10.5px] leading-relaxed text-bone/32">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-lime/60" />
            Turn off your network after opening the tab — cutting and export
            still work.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function DiagramNode({
  icon: Icon,
  step,
  title,
  detail,
  accent = false,
}: {
  icon: typeof Cpu;
  step: string;
  title: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-bone/8 bg-bone/[0.025] p-3">
      <span
        className={
          accent
            ? "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-coral/15 text-coral"
            : "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bone/6 text-bone/60"
        }
      >
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-bone/85">{title}</p>
        <p className="mt-0.5 truncate font-mono text-[9px] text-bone/32">
          {detail}
        </p>
      </div>
      <span className="font-mono text-[8.5px] text-bone/22">{step}</span>
    </div>
  );
}

function Connector() {
  return (
    <div className="ml-[30px] h-3 w-px bg-gradient-to-b from-lime/30 to-bone/10" />
  );
}
