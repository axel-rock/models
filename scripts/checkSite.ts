import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const output = resolve(import.meta.dirname, "../apps/gallery/dist/distribution");
const runtime = await readFile(resolve(output, "models.js"), "utf8");
const manifest = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8")) as {
  runtime: { sha256: string };
};
assert.equal(createHash("sha256").update(runtime).digest("hex"), manifest.runtime.sha256);
assert.doesNotMatch(runtime, /^import\s/m, "Browser file must not depend on external imports");
for (const notice of ["Copyright (c) 2026 Axel", "LobeHub", "Zod", "Permission is hereby granted"])
  assert.ok(runtime.includes(notice));
const { icons } = JSON.parse(await readFile(resolve(output, "icons.json"), "utf8")) as {
  icons: { id: string; color: string; monochrome: string }[];
};
assert.equal(new Set(icons.map((icon) => icon.id)).size, icons.length);
for (const icon of icons) {
  for (const variant of [icon.color, icon.monochrome]) {
    const svg = await readFile(resolve(output, variant), "utf8");
    assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /<script|onload=|(?:href|src)=["']https?:\/\//);
  }
}
const { files } = JSON.parse(await readFile(resolve(output, "source.json"), "utf8")) as {
  files: { path: string; content: string }[];
};
const paths = new Set(files.map((file) => resolve(output, file.path)));
for (const file of files) {
  assert.equal(await readFile(resolve(output, file.path), "utf8"), file.content);
  for (const match of file.content.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
    assert.ok(
      paths.has(resolve(output, file.path, "..", match[1]!)),
      `Missing import in ${file.path}: ${match[1]}`,
    );
  }
}
const clean = await mkdtemp(resolve(tmpdir(), "models-copy-check-"));
try {
  await writeFile(resolve(clean, "models.mjs"), runtime);
  const library = (await import(pathToFileURL(resolve(clean, "models.mjs")).href)) as Record<
    string,
    unknown
  >;
  for (const name of [
    "defineModelsElements",
    "selectModel",
    "vercelGatewayAdapter",
    "openRouterAdapter",
    "ModelsComposerElement",
  ])
    assert.ok(library[name], `Missing export: ${name}`);
  for (const tab of ["minimal", "standalone", "composer", "inspector"]) {
    const html = await readFile(resolve(output, `${tab}.html`), "utf8");
    assert.match(html, /from "\.\/models.js"/);
    assert.doesNotMatch(html, /@models\//);
    for (const id of ["catalog-retry", "catalog-status", "selection"])
      assert.ok(html.includes(`id="${id}"`));
  }
} finally {
  await rm(clean, { recursive: true, force: true });
}
console.log(
  `Verified independent browser module, ${files.length} source files, ${icons.length * 2} SVG assets, licenses, and four copyable examples.`,
);
