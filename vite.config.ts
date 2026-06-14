import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@world": resolve(__dirname, "src/world"),
      "@entities": resolve(__dirname, "src/entities"),
      "@ui": resolve(__dirname, "src/ui"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    target: "es2020",
    // Babylon core is legitimately ~5 MB in one chunk; splitting its internals
    // risks runtime circular-dependency errors, so it stays a single cacheable
    // vendor chunk. App code is already split out separately (~12 KB gzip).
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined; // app code chunk
          if (id.includes("@babylonjs/materials")) return "babylonMaterials";
          if (id.includes("@babylonjs/loaders")) return "babylonLoaders";
          if (id.includes("@babylonjs/core")) return "babylon";
          return "vendor"; // any other third-party dep
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
