import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { optionSources } from "../packages/providers/src/index.ts";

interface OverlaySnapshot {
  readonly schemaVersion: 1;
  readonly checkedAt: string;
  readonly sources: Readonly<Record<string, { readonly digest: string }>>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = resolve(root, "catalog", "overlays.json");
const shouldWrite = process.argv.includes("--write");
const urls = [...new Set(optionSources().map((source) => source.url))].sort();
const sources = Object.fromEntries(
  await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { headers: { "user-agent": "models-catalog-check/0.1" } });
      if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
      return [url, { digest: revision(await response.text()) }] as const;
    }),
  ),
);

if (shouldWrite) {
  const snapshot: OverlaySnapshot = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    sources,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated ${urls.length} official documentation fingerprints`);
} else {
  const previous = JSON.parse(await readFile(path, "utf8")) as OverlaySnapshot;
  const changed = urls.filter((url) => previous.sources[url]?.digest !== sources[url]?.digest);
  const removed = Object.keys(previous.sources).filter((url) => sources[url] === undefined);
  if (changed.length > 0 || removed.length > 0) {
    for (const url of changed) console.error(`Documentation changed: ${url}`);
    for (const url of removed) console.error(`Documentation source removed: ${url}`);
    process.exitCode = 1;
  } else {
    console.log(`Current documentation: ${urls.length} fingerprints`);
  }
}

function revision(html: string): string {
  const material = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const datedRevision = /Last updated (\d{4}-\d{2}-\d{2}) UTC/i.exec(material)?.[1];
  if (datedRevision !== undefined) return `last-updated:${datedRevision}`;
  return createHash("sha256").update(material).digest("hex");
}
