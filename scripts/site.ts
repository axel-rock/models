import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { createHash } from "node:crypto";
import { build } from "vite";
import { packageArtifacts } from "./packageArtifacts.ts";
import { exampleDocument } from "../apps/gallery/src/examples.ts";
import { brandIcons, monochromeBrandIcons } from "../packages/elements/src/generated/brandIcons.ts";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "apps/gallery/public/distribution");
await mkdir(output, { recursive: true });
await build({
  configFile: false,
  publicDir: false,
  resolve: { alias: { "@models/core": resolve(root, "packages/core/src/index.ts") } },
  build: {
    outDir: output,
    emptyOutDir: true,
    minify: false,
    target: "es2022",
    lib: {
      entry: resolve(root, "apps/gallery/browser.ts"),
      formats: ["es"],
      fileName: () => "models.js",
    },
  },
});
const license = await readFile(resolve(root, "LICENSE"), "utf8");
const lobe = license.replace("Copyright (c) 2026 Axel", "Copyright (c) 2023 LobeHub");
const zod = await readFile(resolve(root, "packages/providers/node_modules/zod/LICENSE"), "utf8");
const notices = `${license}\n\nBundled icons: LobeHub\n${lobe}\n\nBundled validation: Zod\n${zod}\n\nBrand names and logos are trademarks of their owners. Inclusion does not imply endorsement.\n`;
const runtimePath = resolve(output, "models.js");
await writeFile(
  runtimePath,
  `/*\n${notices.replaceAll("*/", "* /")}\n*/\n${await readFile(runtimePath, "utf8")}`,
);
await writeFile(resolve(output, "LICENSES.txt"), notices);
const names: Readonly<Record<string, string>> = {
  aionlabs: "Aion Labs",
  bytedance: "ByteDance",
  deepseek: "DeepSeek",
  minimax: "MiniMax",
  nvidia: "NVIDIA",
  stepfun: "StepFun",
  arcee: "Arcee",
  bedrock: "Amazon Bedrock",
  bfl: "Black Forest Labs",
  fishaudio: "Fish Audio",
  ibm: "IBM",
  kwaipilot: "Kwai Pilot",
  moonshot: "Moonshot AI",
  nousresearch: "Nous Research",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  xai: "xAI",
  xiaomimimo: "Xiaomi MiMo",
  zai: "Z.ai",
};
const icons = [];
for (const [id, svg] of Object.entries(brandIcons)) {
  await mkdir(resolve(output, "icons/color"), { recursive: true });
  await mkdir(resolve(output, "icons/monochrome"), { recursive: true });
  await writeFile(resolve(output, `icons/color/${id}.svg`), standaloneSvg(svg));
  await writeFile(
    resolve(output, `icons/monochrome/${id}.svg`),
    standaloneSvg(monochromeBrandIcons[id] ?? svg),
  );
  icons.push({
    id,
    name: names[id] ?? id[0]!.toUpperCase() + id.slice(1),
    color: `icons/color/${id}.svg`,
    monochrome: `icons/monochrome/${id}.svg`,
  });
}
await writeFile(
  resolve(output, "icons.json"),
  JSON.stringify({ license: "LICENSES.txt", icons }, null, 2),
);
const files: { path: string; content: string }[] = [];
async function copySource(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await copySource(path);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")) {
      let content = await readFile(path, "utf8");
      const coreImport = relative(dirname(path), resolve(root, "packages/core/src/index.ts"));
      content = content.replaceAll(
        '"@models/core"',
        JSON.stringify(coreImport.startsWith(".") ? coreImport : `./${coreImport}`),
      );
      const destination = `source/${relative(root, path)}`;
      await mkdir(dirname(resolve(output, destination)), { recursive: true });
      await writeFile(resolve(output, destination), content);
      files.push({ path: destination, content });
    }
  }
}
for (const name of ["core", "elements", "providers"])
  await copySource(resolve(root, `packages/${name}/src`));
await writeFile(
  resolve(output, "source.json"),
  JSON.stringify({
    description:
      "Original TypeScript sources. Preserve folder structure. Provider source uses zod; models.js already bundles it and needs no install.",
    license: "LICENSES.txt",
    files,
  }),
);
const runtime = await readFile(runtimePath);
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      runtime: {
        path: "models.js",
        bytes: runtime.length,
        sha256: createHash("sha256").update(runtime).digest("hex"),
      },
      examples: {
        minimal: "minimal.html",
        standalone: "standalone.html",
        composer: "composer.html",
        inspector: "inspector.html",
      },
      source: "source.json",
      uiSource: "ui-source.json",
      packages: "packages/index.json",
      icons: "icons.json",
      license: "LICENSES.txt",
    },
    null,
    2,
  ),
);

for (const tab of ["minimal", "standalone", "composer", "inspector"] as const) {
  await writeFile(resolve(output, `${tab}.html`), exampleDocument(tab));
}

function standaloneSvg(svg: string): string {
  return svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
}

await packageArtifacts(resolve(output, "packages"));
const uiFiles = files
  .filter((file) => file.path.startsWith("source/packages/elements/src/"))
  .map((file) => ({
    path: file.path.replace("source/packages/elements/src/", "ui/"),
    content: file.content.replaceAll(
      /"(?:\.\.\/)+core\/src\/index\.ts"/g,
      '"@axelrock/models/core"',
    ),
  }));
for (const file of uiFiles) {
  await mkdir(dirname(resolve(output, file.path)), { recursive: true });
  await writeFile(resolve(output, file.path), file.content);
}
await writeFile(
  resolve(output, "ui-source.json"),
  JSON.stringify({
    description:
      "Copy these UI source files, preserving paths. They import @axelrock/models/core. Use a TypeScript-capable bundler. Keep the license notices.",
    license: "LICENSES.txt",
    files: uiFiles,
  }),
);

await writeFile(
  resolve(output, "package-example.html"),
  exampleDocument("composer").replace(
    'import { defineModelsElements, vercelGatewayAdapter } from "./models.js";',
    'import { vercelGatewayAdapter } from "@axelrock/models/providers";\nimport { defineModelsElements } from "./ui/index.ts";',
  ),
);
