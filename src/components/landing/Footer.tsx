import { ArrowUpRight, Lock } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

interface FooterProps {
  onPick: () => void;
}

interface FooterLink {
  label: string;
  href: string;
  action?: boolean;
}

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Studio",
    links: [
      { label: "Open the editor", href: "#top", action: true },
      { label: "Backdrop control", href: "#product" },
      { label: "Timeline & export", href: "#product" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Privacy", href: "#privacy" },
      { label: "Supported formats", href: "#top" },
    ],
  },
];

export function Footer({ onPick }: FooterProps) {
  return (
    <footer className="relative border-t border-bone/10 pt-14 pb-8">
      <div className="content-max shell-pad">
        <div className="grid gap-10 md:grid-cols-[1.4fr_0.6fr_0.6fr] lg:gap-16">
          <div>
            <Logo />
            <p className="mt-5 max-w-[340px] text-[12.5px] leading-relaxed text-bone/42">
              A video background remover that never meets a server. Cut,
              restyle, and export up to 4K — straight from your browser.
            </p>
            <button
              type="button"
              onClick={onPick}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-bone/16 px-4 py-2 text-[12px] font-semibold text-bone/80 transition-colors hover:border-bone/30 hover:text-bone"
            >
              Choose a video
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="font-mono text-[9px] tracking-[0.18em] text-bone/30 uppercase">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.action ? (
                      <button
                        type="button"
                        onClick={onPick}
                        className="text-left text-[12.5px] text-bone/55 transition-colors hover:text-bone"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[12.5px] text-bone/55 transition-colors hover:text-bone"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-bone/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-bone/30">
            © {new Date().getFullYear()} Cutout Studio. Made for the open web.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[8.5px] tracking-[0.12em] text-bone/28 uppercase">
              <Lock className="h-3 w-3" />
              0 trackers · 0 cookies · 0 uploads
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-bone/20 sm:block" />
            <span className="font-mono text-[8.5px] tracking-[0.12em] text-bone/28 uppercase">
              webgl2 · webcodecs · mediapipe
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
