import type { ModelCatalog, ModelDescriptor, ProviderId, SourceReference } from "./types.ts";

/** A material change between two provider catalog snapshots. */
export interface ModelChange {
  readonly key: string;
  readonly fields: readonly string[];
}

/** A deterministic catalog drift report. */
export interface CatalogDrift {
  readonly provider: ProviderId;
  readonly previousFetchedAt: string;
  readonly nextFetchedAt: string;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly ModelChange[];
  readonly hasChanges: boolean;
}

/** Compare two catalogs and report additions, removals, and material changes. */
export function diffCatalogs(previous: ModelCatalog, next: ModelCatalog): CatalogDrift {
  if (previous.provider !== next.provider) {
    throw new TypeError("Catalogs from different providers cannot be compared.");
  }

  const previousByKey = new Map(previous.models.map((model) => [model.key, model]));
  const nextByKey = new Map(next.models.map((model) => [model.key, model]));
  const added = [...nextByKey.keys()].filter((key) => !previousByKey.has(key)).sort();
  const removed = [...previousByKey.keys()].filter((key) => !nextByKey.has(key)).sort();
  const changed: ModelChange[] = [];

  for (const [key, nextModel] of nextByKey) {
    const previousModel = previousByKey.get(key);
    if (previousModel === undefined) {
      continue;
    }
    const fields = changedFields(previousModel, nextModel);
    if (fields.length > 0) {
      changed.push({ key, fields });
    }
  }

  changed.sort((left, right) => left.key.localeCompare(right.key));
  return {
    provider: previous.provider,
    previousFetchedAt: previous.fetchedAt,
    nextFetchedAt: next.fetchedAt,
    added,
    removed,
    changed,
    hasChanges: added.length > 0 || removed.length > 0 || changed.length > 0,
  };
}

/** Return whether a catalog exceeds a caller-selected freshness window. */
export function isCatalogStale(catalog: ModelCatalog, now: Date, maxAgeMs: number): boolean {
  const fetchedAt = Date.parse(catalog.fetchedAt);
  return !Number.isFinite(fetchedAt) || now.getTime() - fetchedAt > maxAgeMs;
}

/** Build a source reference for a fetched provider response. */
export function liveApiSource(url: string, retrievedAt: string): SourceReference {
  return { kind: "live-api", url, retrievedAt };
}

function changedFields(previous: ModelDescriptor, next: ModelDescriptor): string[] {
  const fields: Array<keyof ModelDescriptor> = [
    "name",
    "description",
    "kind",
    "author",
    "lifecycle",
    "releasedAt",
    "contextWindow",
    "maxOutputTokens",
    "capabilities",
    "interfaces",
    "prices",
    "routes",
    "options",
    "constraints",
    "requirements",
  ];
  return fields.filter(
    (field) => stableSerialize(previous[field]) !== stableSerialize(next[field]),
  );
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "raw" && key !== "retrievedAt")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  );
}
