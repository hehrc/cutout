import type { SampleClip } from "@/types";

export const SAMPLES: SampleClip[] = [
  {
    id: "plant",
    name: "Potted plant",
    note: "Organic shape · transparency test",
    url: "/samples/plant.mp4",
    poster: "/samples/plant.jpg",
    duration: 6,
    width: 1280,
    height: 720,
    size: 385_688,
    accent: "#2ed3a0",
  },
  {
    id: "aurora",
    name: "Aurora drift",
    note: "Deep space · thin ring edges",
    url: "/samples/aurora.mp4",
    poster: "/samples/aurora.jpg",
    duration: 6,
    width: 1280,
    height: 720,
    size: 274_665,
    accent: "#8d7bff",
  },
  {
    id: "bloom",
    name: "Peach bloom",
    note: "Warm petals · soft gradients",
    url: "/samples/bloom.mp4",
    poster: "/samples/bloom.jpg",
    duration: 6,
    width: 1280,
    height: 720,
    size: 407_374,
    accent: "#ff8a5c",
  },
  {
    id: "mint",
    name: "Mint signal",
    note: "Hard facets · crisp corners",
    url: "/samples/mint.mp4",
    poster: "/samples/mint.jpg",
    duration: 6,
    width: 1280,
    height: 720,
    size: 357_540,
    accent: "#2ed3a0",
  },
];

export function findSample(id: string): SampleClip | undefined {
  return SAMPLES.find((sample) => sample.id === id);
}
