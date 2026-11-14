export const BACKDROPS = [
  { id: "transparent", label: "Transparent", kind: "none", css: null },
  { id: "ink", label: "Ink", kind: "color", css: "#0b0b0f" },
  { id: "paper", label: "Paper", kind: "color", css: "#fcfaf5" },
  { id: "coral", label: "Coral", kind: "color", css: "#ff5a36" },
  { id: "iris", label: "Iris", kind: "color", css: "#6c5ce7" },
  { id: "lime", label: "Lime", kind: "color", css: "#c7f464" },
  {
    id: "aurora",
    label: "Aurora",
    kind: "gradient",
    css: "radial-gradient(120% 120% at 20% 10%, #8d7bff 0%, #6c5ce7 38%, #1b1440 72%, #0b0b0f 100%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    kind: "gradient",
    css: "linear-gradient(145deg, #ffb37a 0%, #ff5a36 50%, #a3240c 100%)",
  },
  {
    id: "mint",
    label: "Mint",
    kind: "gradient",
    css: "radial-gradient(110% 110% at 80% 20%, #c7f464 0%, #2ed3a0 42%, #0e2a22 100%)",
  },
  { id: "blur", label: "Blur source", kind: "blur", css: null },
  { id: "image", label: "Image", kind: "image", css: null },
  { id: "video", label: "Video", kind: "video", css: null },
] as const;

export type BackdropId = (typeof BACKDROPS)[number]["id"];
export type BackdropKind = (typeof BACKDROPS)[number]["kind"];

export const ASPECTS = [
  { id: "source", label: "Source", hint: "Original", ratio: null },
  { id: "16:9", label: "16:9", hint: "Landscape", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", hint: "Vertical", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", hint: "Square", ratio: 1 },
  { id: "4:5", label: "4:5", hint: "Portrait", ratio: 4 / 5 },
  { id: "4:3", label: "4:3", hint: "Classic", ratio: 4 / 3 },
] as const;

export type AspectId = (typeof ASPECTS)[number]["id"];

export const EXPORT_PRESETS = [
  { id: "720p", label: "720p", hint: "HD", pixels: "1280 × 720", note: "Fastest render" },
  { id: "1080p", label: "1080p", hint: "Full HD", pixels: "1920 × 1080", note: "Best balance" },
  { id: "4k", label: "4K", hint: "Ultra HD", pixels: "3840 × 2160", note: "Master copy" },
] as const;

export type ExportPresetId = (typeof EXPORT_PRESETS)[number]["id"];

/** Resolve a backdrop descriptor by id. */
export function backdropById(id: BackdropId) {
  return BACKDROPS.find((option) => option.id === id) ?? BACKDROPS[0];
}
