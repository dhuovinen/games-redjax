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
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core"],
          babylonLoaders: ["@babylonjs/loaders"],
          babylonMaterials: ["@babylonjs/materials"],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
