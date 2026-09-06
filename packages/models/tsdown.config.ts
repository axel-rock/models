import { resolve } from "node:path";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    core: "../core/src/index.ts",
    providers: "../providers/src/index.ts",
    "ai-sdk": "../ai-sdk/src/index.ts",
  },
  alias: { "@models/core": resolve(import.meta.dirname, "../core/src/index.ts") },
  deps: { alwaysBundle: [/^@models\//], neverBundle: ["zod", "ai"] },
  dts: true,
  clean: true,
  format: "esm",
});
