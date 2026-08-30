import { capability, defineModel, defineOptions, selectModel } from "@models/core";
import { describe, expect, it } from "vitest";
import { prepareAiSdkCall } from "./index.ts";

const source = {
  kind: "provider-docs" as const,
  url: "https://example.test/models",
  retrievedAt: "2026-08-30T00:00:00.000Z",
};
const options = defineOptions([
  {
    key: "reasoning.effort",
    kind: "enum",
    label: "Effort",
    description: "Reasoning effort.",
    group: "reasoning",
    support: capability("supported", [source]),
    values: ["low", "high"] as const,
    target: {
      kind: "provider-option",
      namespace: "example",
      path: ["reasoningEffort"],
    },
  },
] as const);
const model = defineModel({
  key: "example:reasoner",
  provider: "example",
  id: "reasoner",
  name: "Reasoner",
  kind: "language",
  lifecycle: "production",
  capabilities: {
    input: {},
    output: {},
    reasoning: capability("supported", [source]),
    tools: capability("unknown", [source]),
    structuredOutput: capability("unknown", [source]),
    promptCaching: capability("unknown", [source]),
  },
  interfaces: [],
  prices: [],
  routes: [],
  options,
  requirements: [],
  sources: [source],
} as const);

describe("prepareAiSdkCall", () => {
  it("keeps model construction and provider option mapping explicit", () => {
    const adapter = {
      id: "example" as const,
      name: "Example",
      catalogEndpoint: source.url,
      requiresAuthentication: false,
      discover: async () => ({
        schemaVersion: 1 as const,
        provider: "example" as const,
        fetchedAt: source.retrievedAt,
        source,
        models: [model],
      }),
      mapOptions: () => ({
        providerOptions: { example: { reasoningEffort: "high" } },
        requestOptions: {},
        warnings: [],
      }),
    };
    const result = prepareAiSdkCall(
      adapter,
      selectModel(model, { "reasoning.effort": "high" }),
      (id) => ({ id }),
    );
    expect(result).toEqual({
      model: { id: "reasoner" },
      callOptions: { providerOptions: { example: { reasoningEffort: "high" } } },
      warnings: [],
    });
    result.callOptions satisfies import("./index.ts").AiSdkCallOptions;
  });

  it("maps gateway reasoning to the portable AI SDK call setting", () => {
    const gatewayModel = defineModel({
      ...model,
      key: "vercel:reasoner",
      provider: "vercel",
    } as const);
    const adapter = {
      id: "vercel" as const,
      name: "Gateway",
      catalogEndpoint: source.url,
      requiresAuthentication: false,
      discover: async () => ({
        schemaVersion: 1 as const,
        provider: "vercel" as const,
        fetchedAt: source.retrievedAt,
        source,
        models: [],
      }),
      mapOptions: () => ({
        providerOptions: {},
        requestOptions: { reasoning: { effort: "high" } },
        warnings: [],
      }),
    };
    const result = prepareAiSdkCall(adapter, selectModel(gatewayModel, {}), (id) => ({ id }));
    expect(result.callOptions).toEqual({ reasoning: "high" });
  });
});
