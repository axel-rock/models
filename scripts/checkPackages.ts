import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const packages = ["core", "providers", "elements", "ai-sdk"];
const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "models-packages-"));

try {
  for (const packageName of packages) {
    const packageDirectory = resolve("packages", packageName);
    const manifest = JSON.parse(
      readFileSync(resolve(packageDirectory, "package.json"), "utf8"),
    ) as { readonly name: string };
    const output = execFileSync(
      "npm",
      ["pack", packageDirectory, "--pack-destination", temporaryDirectory, "--json"],
      { encoding: "utf8" },
    );
    const result = JSON.parse(output) as readonly [{ readonly filename: string }];
    const archive = resolve(temporaryDirectory, result[0].filename);
    console.log(`Checking ${manifest.name}`);
    execFileSync("pnpm", ["exec", "attw", archive, "--profile", "esm-only"], {
      stdio: "inherit",
    });
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
