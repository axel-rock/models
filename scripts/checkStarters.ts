import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const directory = mkdtempSync(resolve(tmpdir(), "models-starters-"));
try {
  for (const name of ["sveltekit", "vanilla", "ai-sdk"]) {
    const starter = resolve(directory, name);
    mkdirSync(starter);
    execFileSync("tar", [
      "-xzf",
      resolve("apps/gallery/public/distribution/starters", `${name}.tar.gz`),
      "-C",
      starter,
    ]);
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: starter,
      stdio: "pipe",
    });
    if (name === "sveltekit")
      execFileSync("npm", ["run", "check"], { cwd: starter, stdio: "inherit" });
    if (name !== "ai-sdk") execFileSync("npm", ["run", "build"], { cwd: starter, stdio: "pipe" });
    else execFileSync("npm", ["start"], { cwd: starter, stdio: "inherit" });
    console.log(`${name}: published-package starter passed`);
  }
} finally {
  if (process.env.MODELS_KEEP_STARTERS === "1") console.log(`Starter browser proof: ${directory}`);
  else rmSync(directory, { recursive: true, force: true });
}
