import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@models/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@models/providers": fileURLToPath(
        new URL("./packages/providers/src/index.ts", import.meta.url),
      ),
      "@models/elements": fileURLToPath(
        new URL("./packages/elements/src/index.ts", import.meta.url),
      ),
    },
  },
});
