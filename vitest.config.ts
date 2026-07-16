import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vitest resolves via Vite, not tsc — it doesn't read tsconfig's "paths" at all, so the same two
// aliases have to be repeated here (the kit's README is explicit that "paths" doesn't merge across
// configs; this is that same rule applied to a test runner instead of a second tsconfig). spatch-kit
// itself now lives outside this project, at ../spatch-kit — see tsconfig.json / metro.config.js.
export default defineConfig({
  resolve: {
    alias: {
      "@spatch-kit": fileURLToPath(new URL("../spatch-kit", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The core is plain TypeScript. It runs in node with no React Native
    // transform, no jsdom, and no emulator — that is the whole point of
    // building this layer first.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
