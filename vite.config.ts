import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * ONNX Runtime Web resolves its WASM loader at runtime (e.g.
 * `/ort/ort-wasm-simd-threaded.jsep.mjs?import`). Vite's dev middleware only
 * transforms files in the module graph, so requests for public files carrying
 * an `import` query fail. Serve the ORT loader/wasm directly from /public in
 * dev; in production these are plain static assets.
 */
function ortPublicDev(): Plugin {
  return {
    name: "cutout-ort-public-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? "";
        const pathname = raw.split("?")[0];
        if (!pathname.startsWith("/ort/")) return next();

        const file = path.join(server.config.root, "public", pathname);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();

        const ext = path.extname(file);
        res.setHeader(
          "Content-Type",
          ext === ".mjs" || ext === ".js"
            ? "text/javascript; charset=utf-8"
            : "application/wasm",
        );
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * ORT imports its wasm binary as an asset, which duplicates the copy we serve
 * from /public/ort (we point `wasmPaths` there explicitly). Drop the bundled
 * copy so the dist doesn't carry ~24 MB twice.
 */
function dropBundledOrtWasm(): Plugin {
  return {
    name: "cutout-drop-bundled-ort-wasm",
    apply: "build",
    generateBundle(_options, bundle) {
      for (const key of Object.keys(bundle)) {
        if (key.endsWith(".wasm") && key.includes("ort-wasm")) {
          delete bundle[key];
        }
      }
    },
  };
}

/**
 * Cross-origin isolation unlocks SharedArrayBuffer, which ONNX Runtime uses to
 * run inference on several WASM threads. Static hosts that can't send these
 * headers still work — the engine falls back to a single thread.
 */
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react(), tailwindcss(), ortPublicDev(), dropBundledOrtWasm()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    // Prevent Vite from pre-bundling ORT: its WASM loader is imported at runtime
    // from /ort/ and pre-bundling appends a `?import` query that breaks the
    // dynamic import of files served from /public.
    exclude: ["onnxruntime-web"],
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    port: 4173,
    headers: crossOriginIsolationHeaders,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
