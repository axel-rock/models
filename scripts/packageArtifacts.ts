import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(import.meta.dirname, "..");

/** Build versioned logic-package archives with resolved workspace dependencies. */
export async function packageArtifacts(destination: string): Promise<void> {
  await mkdir(destination, { recursive: true });
  execFileSync("pnpm", ["--filter", "@axelrock/models", "build"], { cwd: root, stdio: "pipe" });
  const packages = [];
  for (const name of ["models"]) {
    const directory = resolve(root, "packages", name);
    const manifest = JSON.parse(await readFile(resolve(directory, "package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    execFileSync("pnpm", ["pack", "--pack-destination", destination], {
      cwd: directory,
      stdio: "pipe",
    });
    const archive = `${manifest.name.replace("@", "").replace("/", "-")}-${manifest.version}.tgz`;
    const packed = JSON.parse(
      execFileSync("tar", ["-xOf", resolve(destination, archive), "package/package.json"], {
        encoding: "utf8",
      }),
    ) as { dependencies?: Record<string, string> };
    if (Object.values(packed.dependencies ?? {}).some((value) => value.startsWith("workspace:")))
      throw new Error(`Unresolved workspace dependency in ${manifest.name}`);
    packages.push({ name: manifest.name, version: manifest.version, archive });
  }
  await writeFile(
    resolve(destination, "index.json"),
    JSON.stringify({ status: "local-preview", packages }, null, 2),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await packageArtifacts(resolve(root, "dist/packages"));
  console.log("Prepared local package archives in dist/packages. Nothing was published.");
}
