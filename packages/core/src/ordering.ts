import { pricePerMillion } from "./pricing.ts";
import type { ModelDescriptor } from "./types.ts";

/** The fields ordering reads, so any descriptor-like object can be sorted. */
export type OrderableModel = Pick<ModelDescriptor, "id" | "name" | "prices" | "releasedAt"> &
  Partial<Pick<ModelDescriptor, "author">>;

interface ParsedModel<T extends OrderableModel> {
  readonly model: T;
  readonly author: string;
  /** Name words without version, size, date, or stage: "claude opus", "gpt mini". */
  readonly family: string;
  readonly version: readonly number[];
  readonly size: number;
  readonly standard: boolean;
  readonly released: number;
}

/** Words that mark a variant of the same model, not a family of its own. */
const currentWindow = 365 * 24 * 60 * 60 * 1000;

const variantWords = new Set(["beta", "exp", "experimental", "fast", "image", "preview"]);

/**
 * Order models the way a person browsing a provider would want them.
 *
 * 1. Providers stay in the order they first appear.
 * 2. Inside a provider, models are grouped into families by name ("claude
 *    opus", "gpt mini"), read from the ID with no per-model table, so a new
 *    name or a new dotted version needs no code change.
 * 3. Families are ranked by what the newest model in the family costs per
 *    token (output first, then input). Price is the only frontier signal every
 *    gateway exposes: the family that costs the most is the top tier.
 * 4. The list starts with the newest version of each current family, best
 *    tier first. Older versions follow, then retired families (no release in
 *    the provider's last year), each again best tier first, newest first.
 *
 * Ties fall back to release date, then to the name in natural order (so "Opus
 * 4.10" follows "Opus 4.9"). The input is not modified.
 */
export function sortModels<T extends OrderableModel>(models: readonly T[]): T[] {
  const providerOrder = new Map<string, number>();
  const parsed = models.map((model) => {
    const entry = parseModel(model);
    if (!providerOrder.has(entry.author)) providerOrder.set(entry.author, providerOrder.size);
    return entry;
  });

  const newestByFamily = new Map<string, ParsedModel<T>>();
  const latestRelease = new Map<string, number>();
  for (const entry of parsed) {
    const key = familyKey(entry);
    const current = newestByFamily.get(key);
    if (current === undefined || compareNewest(entry, current) < 0) newestByFamily.set(key, entry);
    latestRelease.set(entry.author, Math.max(latestRelease.get(entry.author) ?? 0, entry.released));
  }

  // A family is current while its newest model is within a year of the
  // provider's newest release. Retired lines (an old, pricey "turbo") then
  // cannot outrank today's models on price alone. Unknown dates count as current.
  const isCurrent = (entry: ParsedModel<T>) => {
    const newest = newestByFamily.get(familyKey(entry));
    return (
      newest === undefined ||
      newest.released === 0 ||
      (latestRelease.get(entry.author) ?? 0) - newest.released <= currentWindow
    );
  };
  const leads = (entry: ParsedModel<T>) => {
    const newest = newestByFamily.get(familyKey(entry));
    return (
      newest !== undefined &&
      isCurrent(entry) &&
      compareVersions(entry.version, newest.version) === 0
    );
  };
  const scoreOf = (entry: ParsedModel<T>) =>
    priceScore(newestByFamily.get(familyKey(entry))!.model);

  return parsed
    .toSorted(
      (left, right) =>
        (providerOrder.get(left.author) ?? 0) - (providerOrder.get(right.author) ?? 0) ||
        Number(leads(right)) - Number(leads(left)) ||
        Number(isCurrent(right)) - Number(isCurrent(left)) ||
        scoreOf(right)[0] - scoreOf(left)[0] ||
        scoreOf(right)[1] - scoreOf(left)[1] ||
        left.family.localeCompare(right.family) ||
        compareNewest(left, right),
    )
    .map((entry) => entry.model);
}

const familyKey = (entry: { author: string; family: string }) => `${entry.author}\0${entry.family}`;

/** Newest first: higher version, then larger size, then the standard model over its preview or fast variant, then later release. */
function compareNewest<T extends OrderableModel>(left: ParsedModel<T>, right: ParsedModel<T>) {
  return (
    compareVersions(right.version, left.version) ||
    right.size - left.size ||
    Number(right.standard) - Number(left.standard) ||
    right.released - left.released ||
    left.model.name.localeCompare(right.model.name, "en", { numeric: true })
  );
}

function compareVersions(left: readonly number[], right: readonly number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Output price per million tokens, then input; models without a price rank last. */
function priceScore(model: OrderableModel): readonly [number, number] {
  const output = Number(pricePerMillion(model.prices, "output-token") ?? Number.NaN);
  const input = Number(pricePerMillion(model.prices, "input-token") ?? Number.NaN);
  return [Number.isFinite(output) ? output : -1, Number.isFinite(input) ? input : -1];
}

function parseModel<T extends OrderableModel>(model: T): ParsedModel<T> {
  const [author = "", ...rest] = model.id.split("/");
  const name = (rest.length > 0 ? rest.join("/") : model.id).toLowerCase();
  const version: number[] = [];
  const family: string[] = [];
  let size = 0;
  let standard = true;
  let inVersion = false;
  for (const token of name.split(/[-_:@\s/]+/).filter(Boolean)) {
    const sized = /^(\d+(?:\.\d+)?)([bkm])$/.exec(token);
    if (sized !== null) {
      size = Number(sized[1]) * { b: 1e9, k: 1e3, m: 1e6 }[sized[2] as "b" | "k" | "m"];
      continue;
    }
    if (token === "latest") continue;
    if (variantWords.has(token)) {
      standard = false;
      continue;
    }
    // Dates ("20250514", "2507", "0528") are 4+ digit runs; releasedAt covers them.
    if (/^\d{4,}$/.test(token)) continue;
    // Split "gpt4o" into gpt, 4, o and "o3" into o, 3, so letters and digits sort apart.
    for (const part of token.match(/\d+(?:\.\d+)*|[a-z]+/g) ?? []) {
      if (/^\d/.test(part)) {
        // Only the first run of numbers is the version: "3-5" is 3.5, but the
        // "2" in "llama-3-instruct-2" is not.
        if (!inVersion && version.length > 0) continue;
        version.push(...part.split(".").map(Number));
        inVersion = true;
      } else {
        inVersion = false;
        family.push(part);
      }
    }
  }
  return {
    model,
    author: model.author ?? author,
    family: family.join(" "),
    version,
    size,
    standard,
    released: model.releasedAt === undefined ? 0 : Date.parse(model.releasedAt) || 0,
  };
}
