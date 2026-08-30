import { describe, expect, it } from "vitest";
import { diffCatalogs } from "./catalog.ts";
import { unknownCapabilities } from "./defaults.ts";
import type { ModelCatalog, ModelDescriptor } from "./types.ts";

function model(id: string, name = id): ModelDescriptor<"openai"> {
  return {
    key: `openai:${id}`,
    provider: "openai",
    id,
    name,
    kind: "language",
    lifecycle: "unknown",
    capabilities: unknownCapabilities(),
    interfaces: ["openai-responses"],
    prices: [],
    routes: [],
    options: [],
    requirements: [],
    sources: [],
  };
}

function catalog(
  fetchedAt: string,
  models: readonly ModelDescriptor<"openai">[],
): ModelCatalog<"openai"> {
  return {
    schemaVersion: 1,
    provider: "openai",
    fetchedAt,
    source: { kind: "live-api", url: "https://api.openai.com/v1/models", retrievedAt: fetchedAt },
    models,
  };
}

describe("diffCatalogs", () => {
  it("reports additions, removals, and material changes", () => {
    const drift = diffCatalogs(
      catalog("2026-08-29T00:00:00.000Z", [model("old"), model("same", "Before")]),
      catalog("2026-08-30T00:00:00.000Z", [model("new"), model("same", "After")]),
    );
    expect(drift).toMatchObject({
      added: ["openai:new"],
      removed: ["openai:old"],
      changed: [{ key: "openai:same", fields: ["name"] }],
      hasChanges: true,
    });
  });
});
