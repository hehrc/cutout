export type StudioMode = "landing" | "studio";

export interface MediaSource {
  id: string;
  name: string;
  url: string;
  poster?: string;
  duration: number;
  width: number;
  height: number;
  size: number;
  kind: "video";
  sampleId?: string;
  /** True when `url` is an object URL that must be revoked. */
  ownedUrl: boolean;
}

export interface SampleClip {
  id: string;
  name: string;
  note: string;
  url: string;
  poster: string;
  duration: number;
  width: number;
  height: number;
  size: number;
  accent: string;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}
