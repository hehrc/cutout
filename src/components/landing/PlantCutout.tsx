import { useId } from "react";

interface PlantCutoutProps {
  className?: string;
}

/**
 * Original vector still-life used as the landing-page "subject".
 * Drawn from scratch for Cutout Studio — no third-party artwork.
 */
export function PlantCutout({ className }: PlantCutoutProps) {
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const leaf = `leaf-${id}`;
  const pot = `pot-${id}`;
  const shadow = `shadow-${id}`;

  return (
    <svg
      viewBox="0 0 520 620"
      role="img"
      aria-label="Illustration of a potted plant with clean cut-out edges"
      className={className}
    >
      <defs>
        <linearGradient id={leaf} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#12805f" />
          <stop offset="0.55" stopColor="#2ed3a0" />
          <stop offset="1" stopColor="#c7f464" />
        </linearGradient>
        <linearGradient id={pot} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a63" />
          <stop offset="0.55" stopColor="#ff5a36" />
          <stop offset="1" stopColor="#c93315" />
        </linearGradient>
        <radialGradient id={shadow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.38" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`soft-${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <ellipse
        cx="262"
        cy="566"
        rx="132"
        ry="34"
        fill={`url(#${shadow})`}
        opacity="0.55"
      />

      <g style={{ filter: "drop-shadow(0 26px 26px rgba(0,0,0,.22))" }}>
        <g
          style={{
            transformOrigin: "260px 470px",
            animation: "float-soft 7s ease-in-out infinite",
          }}
        >
          {/* Stems */}
          <g
            stroke="#1a9a74"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.95"
          >
            <path d="M258 412 C 252 340 214 296 178 262" />
            <path d="M260 414 C 262 320 300 268 342 232" />
            <path d="M260 416 C 258 352 262 300 258 244" />
            <path d="M260 418 C 288 372 336 356 386 352" />
          </g>

          {/* Leaves */}
          <g fill={`url(#${leaf})`} stroke="#0d6b50" strokeWidth="2.5">
            <g transform="translate(178 262) rotate(-62) scale(0.92)">
              <path d="M0 0 C -30 -22 -38 -78 -6 -116 C 22 -88 26 -40 0 0 Z" />
              <path
                d="M0 -4 L -2 -96"
                stroke="#0d6b50"
                strokeWidth="2"
                fill="none"
                opacity="0.55"
              />
            </g>

            <g transform="translate(342 232) rotate(28) scale(1.08)">
              <path d="M0 0 C -34 -26 -44 -88 -8 -132 C 26 -98 30 -44 0 0 Z" />
              <path
                d="M0 -4 L 2 -110"
                stroke="#0d6b50"
                strokeWidth="2"
                fill="none"
                opacity="0.55"
              />
            </g>

            <g transform="translate(258 244) rotate(-4) scale(1.16)">
              <path d="M0 0 C -32 -28 -40 -92 -4 -138 C 28 -102 30 -46 0 0 Z" />
              <path
                d="M0 -4 L 0 -114"
                stroke="#0d6b50"
                strokeWidth="2"
                fill="none"
                opacity="0.55"
              />
            </g>

            <g transform="translate(386 352) rotate(74) scale(0.78)">
              <path d="M0 0 C -28 -22 -34 -76 -4 -112 C 22 -84 26 -38 0 0 Z" />
            </g>

            <g transform="translate(196 330) rotate(-92) scale(0.6)">
              <path d="M0 0 C -26 -20 -32 -70 -4 -104 C 22 -78 24 -36 0 0 Z" />
            </g>
          </g>

          {/* Pot */}
          <g>
            <rect
              x="176"
              y="386"
              width="168"
              height="34"
              rx="14"
              fill={`url(#${pot})`}
            />
            <path
              d="M188 416 H332 L316 534 C314.5 545 305 552 294 552 H226 C215 552 205.5 545 204 534 Z"
              fill={`url(#${pot})`}
            />
            <path
              d="M188 416 H332 L329 438 H191 Z"
              fill="#000"
              opacity="0.12"
            />
            <rect
              x="214"
              y="452"
              width="92"
              height="10"
              rx="5"
              fill="#fff"
              opacity="0.16"
            />
          </g>
        </g>
      </g>

      {/* Floating leaf clipping crumbs */}
      <circle cx="118" cy="196" r="5" fill="#c7f464" opacity="0.9" />
      <circle cx="402" cy="158" r="3.5" fill="#ff5a36" opacity="0.9" />
      <circle cx="366" cy="466" r="4" fill="#2ed3a0" opacity="0.8" />
    </svg>
  );
}
