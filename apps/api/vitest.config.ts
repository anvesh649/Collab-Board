import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.spec.ts"],
    // Starts one throwaway PostgreSQL 18 container for the whole run and migrates it.
    globalSetup: ["test/global-setup.ts"],
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
  // esbuild (Vitest's default) drops decorator metadata, which Nest's injection needs.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
