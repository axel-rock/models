import { build } from "vite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";

const packages = ["models"];
const archives: string[] = [];
const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "models-packages-"));

try {
  for (const packageName of packages) {
    const packageDirectory = resolve("packages", packageName);
    const manifest = JSON.parse(
      readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
    ) as { readonly name: string };
    const result = JSON.parse(
      execFileSync("pnpm", ["pack", "--pack-destination", temporaryDirectory, "--json"], {
        cwd: packageDirectory,
        encoding: "utf8",
      }),
    ) as { filename: string };
    const archive = resolve(temporaryDirectory, result.filename);
    archives.push(archive);
    console.log(`Checking ${manifest.name}`);
    execFileSync("pnpm", ["exec", "attw", archive, "--profile", "esm-only"], {
      stdio: "inherit",
    });
  }
  const dependencies = Object.fromEntries(
    archives.map((archive) => {
      const manifest = JSON.parse(
        execFileSync("tar", ["-xOf", archive, "package/package.json"], { encoding: "utf8" }),
      ) as { name: string; dependencies?: Record<string, string> };
      if (
        Object.values(manifest.dependencies ?? {}).some((value) => value.startsWith("workspace:"))
      )
        throw new Error("Workspace dependency leaked into package");
      return [manifest.name, `file:${archive}`];
    }),
  );
  writeFileSync(
    resolve(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies }),
  );
  execFileSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"],
    { cwd: temporaryDirectory, stdio: "pipe" },
  );
  writeFileSync(
    resolve(temporaryDirectory, "consumer.mjs"),
    `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as root from "@axelrock/models";
import { validateOptions } from "@axelrock/models/core";
import { vercelGatewayAdapter } from "@axelrock/models/providers";
import * as bridge from "@axelrock/models/ai-sdk";
const catalog = await vercelGatewayAdapter.discover({ fetch: async () => Response.json({ data: [{ id: "openai/test", name: "Test model", type: "language" }] }) });
assert.equal(catalog.models[0].id, "openai/test");
assert.equal(typeof validateOptions, "function");
assert.equal(root.validateOptions, validateOptions);
assert.throws(() => createRequire(import.meta.url).resolve("ai"), { code: "MODULE_NOT_FOUND" });
assert.ok(Object.keys(bridge).length > 0);
console.log("Isolated package consumer passed.");`,
  );
  execFileSync(process.execPath, [resolve(temporaryDirectory, "consumer.mjs")], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });
  const ui = JSON.parse(
    readFileSync(resolve("apps/gallery/public/distribution/ui-source.json"), "utf8"),
  ) as { files: { path: string; content: string }[] };
  for (const file of ui.files) {
    const path = resolve(temporaryDirectory, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
  }
  execFileSync(
    resolve("node_modules/.bin/tsc"),
    [
      "--noEmit",
      "--strict",
      "--target",
      "es2024",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--allowImportingTsExtensions",
      resolve(temporaryDirectory, "ui/index.ts"),
    ],
    { cwd: temporaryDirectory, stdio: "inherit" },
  );
  console.log("Copied UI type-checks against the packaged core.");
  writeFileSync(
    resolve(temporaryDirectory, "index.html"),
    readFileSync(resolve("apps/gallery/public/distribution/package-example.html")),
  );
  await build({
    root: temporaryDirectory,
    configFile: false,
    publicDir: false,
    logLevel: "warn",
    build: { target: "es2022" },
  });
  console.log("Copied UI and package example build without workspace aliases.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
