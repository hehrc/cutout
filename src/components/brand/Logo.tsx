import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  markOnly?: boolean;
  subtitle?: boolean;
  tone?: "light" | "dark";
}

export function Logo({
  className,
  markOnly = false,
  subtitle = true,
  tone = "light",
}: LogoProps) {
  const dark = tone === "dark";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 shrink-0">
        <rect
          width="40"
          height="40"
          rx="11"
          fill={dark ? "var(--ink)" : "var(--bone)"}
        />
        <path
          d="M20 8.5a11.5 11.5 0 1 0 8.2 19.6l-3.3-3.3a6.8 6.8 0 1 1 0-9.6l3.3-3.3A11.5 11.5 0 0 0 20 8.5Z"
          fill={dark ? "var(--bone)" : "var(--ink)"}
        />
        <circle cx="28.6" cy="10.6" r="3.6" fill="var(--coral)" />
      </svg>
      {!markOnly && (
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[23px] leading-none font-semibold tracking-[-0.03em]">
            cutout
          </span>
          {subtitle && (
            <span className="font-mono text-[9px] leading-none font-medium tracking-[0.24em] text-current/55 uppercase">
              studio
            </span>
          )}
        </span>
      )}
    </span>
  );
}
