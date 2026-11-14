# Cutout Studio

A fully local, in-browser video background remover. No uploads, no accounts,
no credits, no watermark — the editing and rendering loop runs entirely in the
browser tab.

**Status: feature-complete.** The studio ships with the local segmentation
matte, image/video/blur backdrops, a keep/erase brush, timeline trimming,
before/after comparison, and a frame-accurate on-device render at up to 4K with
audio.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run preview  # serve the production build
```

## What works

- Drag-and-drop or file-picker upload with local validation (MP4, MOV, WebM,
  OGG, MKV, AVI; up to 1.5 GB)
- Original sample clips with poster frames and audio
- On-device metadata and poster extraction during the preparation overlay
- Studio playback with autoplay-muted, sound toggle, frame stepping, and
  keyboard shortcuts (`Space`, `←`/`→`, `M`)
- Timeline scrubbing with frames extracted locally from the clip
- Timeline trimming with draggable in/out handles; playback and export both
  respect the trim range
- Before/after comparison: drag the split handle to see the original frame
  beside the composited cutout
- Aspect-ratio framing (source, 16:9, 9:16, 1:1, 4:5, 4:3)
- Canvas backdrops: transparent checker, solids, gradients, and a blurred
  version of the original scene
- Local image and video backdrops, center-cropped to the frame with an
  adjustable backdrop blur; video backdrops are seeked per exported frame
- Local segmentation matte (U²-Netp via ONNX Runtime Web, WASM SIMD) with
  temporal smoothing, model-download progress, and a retry path
- Live edge controls: feather, threshold, and true-pixel dilation/erosion
- Keep/erase brush painted on the preview; corrections hold for ±0.35 s around
  the painted frame and are rasterized into both the preview and export masks
- Aspect-aware compositing, preview at source resolution and export at
  720p / 1080p / 4K
- Smooth, fringe-aware preview: each composited frame is the exact frame the
  matte was computed from
- Local export: seeks the source frame by frame, runs the matte, applies brush
  corrections, composites the backdrop, and encodes with WebCodecs, then muxes
  in the tab
- Container negotiation: MP4 / H.264 + AAC when the browser supports it,
  WebM / VP9 + Opus otherwise — no upload, no server, no watermark
- Original audio is decoded, trimmed to the render range, and re-encoded
  (video-only output when the browser has no audio encoder)
- Multi-threaded WASM inference in production when the host sends
  `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` (single thread otherwise)
- Fully responsive studio with a mobile tool sheet
- Generated sample media and original vector artwork; icons from Lucide (ISC)

## Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS v4 with a custom token layer
- Zustand for editor and media state
- Motion for React for transitions
- Lucide icons
- ONNX Runtime Web with a bundled U²-Netp model for on-device segmentation
- WebCodecs (`VideoEncoder` / `AudioEncoder`) with `mp4-muxer` and `webm-muxer`

## Privacy

There is no backend and no analytics. Files are read from disk into memory;
object URLs are revoked when you leave the studio. The landing copy and UI are
original to this project.

## Layout

```
src/
  components/brand/     logo
  components/landing/   nav, hero, preview, upload, sections, footer
  components/studio/    shell, top bar, rail, panels, stage, timeline
  hooks/                matte engine, backdrop media, export orchestration
  lib/                  media, matte, compositor, brush, exporter, presets
  store/                studio session + editor settings
  styles/               tokens and global styles
public/samples/         generated sample clips, posters, and their vector sources
public/models/          bundled U²-Netp ONNX model
public/ort/             ONNX Runtime Web WASM assets
```
