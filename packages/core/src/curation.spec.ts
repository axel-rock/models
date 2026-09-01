import type { ModelCatalog, ModelDescriptor, PriceRate } from "./types.ts";
import { describe, expect, it } from "vitest";
import { unknownCapabilities } from "./defaults.ts";
import { validateOptions } from "./options.ts";
import {
  curateCatalogs,
  defineModelPolicy,
  defineModelPolicyFor,
  findLowestPricedModel,
  findModel,
  resolveModelPolicy,
  resolvePolicyDefaults,
} from "./curation.ts";

describe("model curation", () => {
  it("narrows and orders catalogs by exact IDs or provider-qualified keys", () => {
    const catalog = fixtureCatalog([
      fixtureModel("provider:first", "first"),
      fixtureModel("provider:second", "second"),
      fixtureModel("provider:third", "third"),
    ]);
    const [curated] = curateCatalogs([catalog], {
      include: ["third", "provider:first", "missing"],
    });
    expect(curated?.models.map((model) => model.id)).toEqual(["third", "first"]);
    expect(findModel([catalog], "provider:second")?.id).toBe("second");
  });

  it("compares decimal price rates without floating point conversion", () => {
    const catalog = fixtureCatalog([
      fixtureModel("provider:first", "first", price("0.00000011", 1)),
      fixtureModel("provider:second", "second", price("0.10", 1_000_000)),
      fixtureModel("provider:conditional", "conditional", {
        ...price("0.01", 1_000_000),
        condition: "only at night",
      }),
    ]);
    expect(findLowestPricedModel([catalog], "input-token")?.id).toBe("second");
  });

  it("narrows enum choices and rejects values outside the application policy", () => {
    const model = {
      ...fixtureModel("provider:first", "first"),
      options: [
        {
          key: "reasoning.effort",
          kind: "enum" as const,
          label: "Effort",
          description: "Reasoning effort.",
          group: "reasoning" as const,
          support: { status: "supported" as const, evidence: [] },
          values: ["low", "medium", "high", "max"] as const,
          defaultValue: "max",
        },
        {
          key: "speed.mode",
          kind: "enum" as const,
          label: "Speed",
          description: "Serving speed.",
          group: "speed" as const,
          support: { status: "supported" as const, evidence: [] },
          values: ["standard", "fast"] as const,
        },
      ],
    };
    const [catalog] = curateCatalogs([fixtureCatalog([model])], {
      optionValues: {
        "reasoning.effort": ["low", "medium", "high"],
        "speed.mode": [],
      },
    });
    const curated = catalog?.models[0];
    expect(curated?.options).toMatchObject([
      { key: "reasoning.effort", values: ["low", "medium", "high"] },
    ]);
    expect(curated?.options[0]?.defaultValue).toBeUndefined();
    expect(validateOptions(curated?.options ?? [], { "reasoning.effort": "max" }).ok).toBe(false);
  });

  it("resolves one policy for every selector presentation", () => {
    const second = {
      ...fixtureModel("provider:second", "second"),
      options: [
        {
          key: "reasoning.effort",
          kind: "enum" as const,
          label: "Effort",
          description: "Reasoning effort.",
          group: "reasoning" as const,
          support: { status: "supported" as const, evidence: [] },
          values: ["low", "medium", "high"] as const,
        },
      ],
    };
    const catalog = fixtureCatalog([fixtureModel("provider:first", "first"), second]);
    const policy = defineModelPolicy({
      models: {
        include: ["second"],
        recommendations: [
          { model: "second", label: "Recommended" },
          { model: "missing", label: "Unavailable" },
        ],
      },
      options: {
        groups: ["reasoning", "speed"],
        defaults: { "reasoning.effort": "medium" },
      },
    });
    const resolved = resolveModelPolicy([catalog], policy);

    expect(resolved.catalogs[0]?.models.map((model) => model.id)).toEqual(["second"]);
    expect(resolved.groups).toEqual(["reasoning", "speed"]);
    expect(resolved.recommendations).toEqual([{ model: "second", label: "Recommended" }]);
    expect(resolved.defaults).toEqual({ "reasoning.effort": "medium" });
    expect(resolvePolicyDefaults(second, resolved)).toEqual({ "reasoning.effort": "medium" });
    expect(resolved.diagnostics).toEqual([
      {
        kind: "recommendation",
        path: "models.recommendations[1].model",
        message: "No model matches missing.",
      },
    ]);
  });

  it("checks policies against literal catalog types", () => {
    const effort = {
      key: "reasoning.effort",
      kind: "enum" as const,
      label: "Effort",
      description: "Reasoning effort.",
      group: "reasoning" as const,
      support: { status: "supported" as const, evidence: [] },
      values: ["low", "medium"] as const,
    };
    const model = {
      ...fixtureModel("provider:typed", "typed"),
      key: "provider:typed" as const,
      id: "typed" as const,
      options: [effort] as const,
    };
    const catalog = { ...fixtureCatalog([model]), models: [model] as const } as const;
    const policy = defineModelPolicyFor([catalog] as const, {
      models: { include: ["provider:typed"] },
      options: {
        values: { "reasoning.effort": ["low"] },
        defaults: { "reasoning.effort": "medium" },
      },
    });
    expect(policy.models.include).toEqual(["provider:typed"]);

    // @ts-expect-error The literal catalog has no model with this ID.
    defineModelPolicyFor([catalog] as const, { models: { include: ["missing"] } });
    defineModelPolicyFor([catalog] as const, {
      // @ts-expect-error The literal option does not accept this value.
      options: { values: { "reasoning.effort": ["max"] } },
    });
  });
});

function fixtureCatalog(models: readonly ModelDescriptor[]): ModelCatalog {
  const source = {
    kind: "generated-snapshot" as const,
    url: "https://example.test/models",
    retrievedAt: "2026-09-01T00:00:00.000Z",
  };
  return {
    schemaVersion: 1,
    provider: "provider",
    fetchedAt: source.retrievedAt,
    source,
    models,
  };
}

function fixtureModel(key: `${string}:${string}`, id: string, rate?: PriceRate): ModelDescriptor {
  return {
    key,
    provider: "provider",
    id,
    name: id,
    kind: "language",
    lifecycle: "production",
    capabilities: unknownCapabilities(),
    interfaces: [],
    prices: rate === undefined ? [] : [rate],
    routes: [],
    options: [],
    requirements: [],
    sources: [],
  };
}

function price(usd: string, per: number): PriceRate {
  return { unit: "input-token", usd, per, evidence: [] };
}
