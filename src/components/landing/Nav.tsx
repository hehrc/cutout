import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

interface NavProps {
  onPick: () => void;
}

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Privacy", href: "#privacy" },
];

export function Nav({ onPick }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-bone/10 bg-ink/78 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="content-max shell-pad flex h-[72px] items-center justify-between gap-6">
        <a
          href="#top"
          className="shrink-0 rounded-lg"
          aria-label="Cutout Studio home"
        >
          <Logo />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-bone/62 transition-colors hover:bg-bone/5 hover:text-bone"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="mr-1 hidden items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-bone/35 uppercase lg:flex">
            <span
              className="h-1.5 w-1.5 rounded-full bg-lime"
              style={{ animation: "pulse-dot 2.4s ease-in-out infinite" }}
            />
            running local
          </span>
          <button
            type="button"
            onClick={onPick}
            className="btn btn-primary h-10 px-4 text-[13px]"
          >
            <span className="hidden sm:inline">Open studio</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-bone/12 text-bone/80 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-bone/10 bg-ink/95 px-6 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-bone/75 hover:bg-bone/5 hover:text-bone"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
