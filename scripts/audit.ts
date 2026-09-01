import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface AuditSnapshot {
  readonly schemaVersion: 1;
  readonly checkedAt: string;
  readonly providers: Readonly<Record<string, ProviderInventory>>;
}

interface ProviderInventory {
  readonly url: string;
  readonly modelCount: number;
  readonly shape: readonly string[];
  readonly enums: Readonly<Record<string, readonly string[]>>;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(root, "catalog", "schema-inventory.json");
const shouldWrite = process.argv.includes("--write");
const endpoints = {
  openrouter: "https://openrouter.ai/api/v1/models?output_modalities=all",
  vercel: "https://ai-gateway.vercel.sh/v1/models",
} as const;

const providers = Object.fromEntries(
  await Promise.all(
    Object.entries(endpoints).map(async ([provider, url]) => {
      const response = await fetch(url, { headers: { "user-agent": "models-catalog-audit/0.1" } });
      if (!response.ok) {
        throw new Error(`${provider} schema audit returned HTTP ${response.status}`);
      }
      const value: unknown = await response.json();
      return [provider, inventory(url, value, provider)] as const;
    }),
  ),
);

if (shouldWrite) {
  const snapshot: AuditSnapshot = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    providers,
  };
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated public schema inventory for ${Object.keys(providers).length} gateways`);
} else {
  const previous = JSON.parse(await readFile(snapshotPath, "utf8")) as AuditSnapshot;
  if (JSON.stringify(previous.providers) !== JSON.stringify(providers)) {
    for (const provider of Object.keys(providers).sort()) {
      const before = previous.providers[provider];
      const after = providers[provider];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        console.error(`Provider schema changed: ${provider}`);
        reportChanges(before, after);
      }
    }
    process.exitCode = 1;
  } else {
    console.log(`Current public schema inventory: ${Object.keys(providers).length} gateways`);
  }
}

function inventory(url: string, value: unknown, provider: string): ProviderInventory {
  const models = arrayValue(recordValue(value)?.["data"]);
  const shape = new Set<string>();
  for (const model of models) {
    collectShape(model, "model", shape, 0);
  }
  return {
    url,
    modelCount: models.length,
    shape: [...shape].sort(),
    enums:
      provider === "vercel"
        ? {
            modelTypes: strings(models.map((model) => recordValue(model)?.["type"])),
            reasoningTypes: strings(
              models.flatMap((model) =>
                arrayValue(recordValue(model)?.["reasoning_options"]).map(
                  (option) => recordValue(option)?.["type"],
                ),
              ),
            ),
            reasoningValues: strings(
              models.flatMap((model) =>
                arrayValue(recordValue(model)?.["reasoning_options"]).flatMap((option) =>
                  arrayValue(recordValue(option)?.["values"]),
                ),
              ),
            ),
            supportedParameters: strings(
              models.flatMap((model) => arrayValue(recordValue(model)?.["supported_parameters"])),
            ),
            tags: strings(models.flatMap((model) => arrayValue(recordValue(model)?.["tags"]))),
          }
        : {
            inputModalities: strings(
              models.flatMap((model) =>
                arrayValue(recordValue(recordValue(model)?.["architecture"])?.["input_modalities"]),
              ),
            ),
            outputModalities: strings(
              models.flatMap((model) =>
                arrayValue(
                  recordValue(recordValue(model)?.["architecture"])?.["output_modalities"],
                ),
              ),
            ),
            reasoningEfforts: strings(
              models.flatMap((model) =>
                arrayValue(recordValue(recordValue(model)?.["reasoning"])?.["supported_efforts"]),
              ),
            ),
            supportedParameters: strings(
              models.flatMap((model) => arrayValue(recordValue(model)?.["supported_parameters"])),
            ),
          },
  };
}

function collectShape(value: unknown, path: string, output: Set<string>, depth: number): void {
  if (depth > 7) {
    output.add(`${path}:depth-limit`);
    return;
  }
  if (Array.isArray(value)) {
    output.add(`${path}[]`);
    for (const item of value) collectShape(item, `${path}[]`, output, depth + 1);
    return;
  }
  const record = recordValue(value);
  if (record !== undefined) {
    for (const key of Object.keys(record).sort()) {
      collectShape(record[key], `${path}.${key}`, output, depth + 1);
    }
    return;
  }
  output.add(`${path}:${value === null ? "null" : typeof value}`);
}

function reportChanges(
  before: ProviderInventory | undefined,
  after: ProviderInventory | undefined,
): void {
  if (before === undefined || after === undefined) return;
  const added = after.shape.filter((path) => !before.shape.includes(path));
  const removed = before.shape.filter((path) => !after.shape.includes(path));
  for (const path of added.slice(0, 30)) console.error(`  added shape: ${path}`);
  for (const path of removed.slice(0, 30)) console.error(`  removed shape: ${path}`);
  for (const [name, values] of Object.entries(after.enums)) {
    const previous = before.enums[name] ?? [];
    const additions = values.filter((value) => !previous.includes(value));
    const removals = previous.filter((value) => !values.includes(value));
    if (additions.length > 0) console.error(`  ${name} added: ${additions.join(", ")}`);
    if (removals.length > 0) console.error(`  ${name} removed: ${removals.join(", ")}`);
  }
}

function arrayValue(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(values: readonly unknown[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string"))].sort();
}
