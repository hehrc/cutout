import { useState } from "react";
import { Check, Play, ShieldCheck } from "lucide-react";
import { PlantCutout } from "@/components/landing/PlantCutout";
import { cn } from "@/lib/cn";

const BACKGROUNDS = [
  {
    id: "alpha",
    label: "Transparent",
    swatch: "checkerboard-sm",
    layer: "transparent",
  },
  {
    id: "aurora",
    label: "Aurora",
    swatch: "",
    layer:
      "radial-gradient(120% 120% at 18% 12%, #8d7bff 0%, #6c5ce7 32%, #1b1440 68%, #0b0b0f 100%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    swatch: "",
    layer:
      "linear-gradient(145deg, #ffb37a 0%, #ff5a36 46%, #a3240c 100%)",
  },
  {
    id: "mint",
    label: "Mint",
    swatch: "",
    layer:
      "radial-gradient(110% 110% at 80% 20%, #c7f464 0%, #2ed3a0 38%, #0e2a22 100%)",
  },
] as const;

export function CutoutPreview() {
  const [active, setActive] = useState<string>("alpha");

  return (
    <div className="card-dark flex h-full flex-col p-3 sm:p-4">
      <div className="relative flex-1 overflow-hidden rounded-[18px]">
        <div className="checkerboard absolute inset-0" />

        {BACKGROUNDS.map((item) =>
          item.layer === "transparent" ? null : (
            <div
              key={item.id}
              aria-hidden="true"
              className="absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ backgroundImage: item.layer, opacity: active === item.id ? 1 : 0 }}
            />
          ),
        )}

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/22 to-transparent"
        />

        <PlantCutout className="absolute bottom-[26px] left-1/2 w-[64%] max-w-[370px] -translate-x-1/2 drop-shadow-[0_30px_40px_rgba(0,0,0,0.18)]" />

        {/* Viewport chrome */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/28 px-2.5 py-1.5 backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 rounded-full bg-lime"
              style={{ animation: "pulse-dot 2.2s ease-in-out infinite" }}
            />
            <span className="font-mono text-[9px] tracking-[0.18em] text-white/80 uppercase">
              live cutout
            </span>
          </div>
          <span className="rounded-full border border-white/12 bg-black/28 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.16em] text-white/70 uppercase backdrop-blur-md">
            alpha
          </span>
        </div>

        {/* Background swatches */}
        <div className="absolute top-16 right-3.5 flex flex-col gap-2">
          {BACKGROUNDS.map((item) => {
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-pressed={selected}
                aria-label={`Preview ${item.label} background`}
                className={cn(
                  "group relative grid h-10 w-10 place-items-center overflow-hidden rounded-[10px] border transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  selected
                    ? "scale-105 border-white/70 shadow-[0_0_0_3px_rgba(255,90,54,0.36)]"
                    : "border-white/20 opacity-80 hover:opacity-100",
                )}
                style={
                  item.layer === "transparent"
                    ? undefined
                    : { backgroundImage: item.layer }
                }
              >
                {item.layer === "transparent" && (
                  <span className="checkerboard-sm absolute inset-0" />
                )}
                {selected && (
                  <span className="relative grid h-4 w-4 place-items-center rounded-full bg-coral text-[#1a0c07]">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
                <span className="pointer-events-none absolute right-12 hidden whitespace-nowrap rounded-md bg-black/75 px-2 py-1 font-mono text-[9px] tracking-wide text-white/85 group-hover:block">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fake transport bar */}
        <div className="absolute inset-x-3.5 bottom-3.5 flex items-center gap-3 rounded-xl border border-white/12 bg-black/32 px-3 py-2 backdrop-blur-md">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-ink">
            <Play className="ml-px h-3 w-3 fill-current" />
          </span>
          <span className="font-mono text-[10px] text-white/70 tabular-nums">00:03</span>
          <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/18">
            <span className="absolute inset-y-0 left-0 w-[46%] rounded-full bg-coral" />
            <span className="absolute top-1/2 left-[46%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/80 bg-coral" />
          </span>
          <span className="font-mono text-[10px] text-white/45 tabular-nums">00:06</span>
        </div>

        {/* Corner marks */}
        <span className="pointer-events-none absolute top-3 left-3 h-4 w-4 border-t border-l border-white/25" />
        <span className="pointer-events-none absolute top-3 right-3 h-4 w-4 border-t border-r border-white/25" />
        <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/25" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-4 w-4 border-r border-b border-white/25" />
      </div>

      <div className="flex flex-col gap-3 px-1 pt-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-bone/85">
            Cut once. Restyle forever.
          </p>
          <p className="mt-0.5 text-[11px] text-bone/40">
            Stills preview — your clip gets the same alpha channel.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-lime/20 bg-lime/8 px-2.5 py-1 font-mono text-[9px] tracking-[0.12em] text-lime/80 uppercase">
          <ShieldCheck className="h-3 w-3" />
          0 b uploaded
        </span>
      </div>
    </div>
  );
}
