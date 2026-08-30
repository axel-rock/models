import { describe, expect, it } from "vitest";
import { anthropicAdapter } from "./anthropic.ts";
import { googleAdapter } from "./google.ts";
import { openAiAdapter } from "./openai.ts";
import { openRouterAdapter } from "./openrouter.ts";
import { ProviderDiscoveryError } from "./shared.ts";
import { vercelGatewayAdapter } from "./vercel.ts";

describe("public gateway adapters", () => {
  it("normalizes OpenRouter capabilities, prices, and reasoning options", async () => {
    const catalog = await openRouterAdapter.discover({
      fetch: jsonFetch({
        data: [
          {
            id: "author/reasoner",
            name: "Reasoner",
            context_length: 128_000,
            architecture: {
              input_modalities: ["text", "image"],
              output_modalities: ["text"],
            },
            pricing: { prompt: "0.000001", completion: "0.000004" },
            supported_parameters: ["reasoning", "tools", "structured_outputs"],
            reasoning: {
              mandatory: true,
              default_enabled: true,
              supported_efforts: ["high", "low", "none"],
              default_effort: "high",
            },
            future_field: "preserved",
          },
        ],
      }),
    });
    const model = catalog.models[0];
    expect(model).toMatchObject({
      key: "openrouter:author/reasoner",
      contextWindow: { value: 128_000 },
      capabilities: {
        reasoning: { status: "supported" },
        tools: { status: "supported" },
        structuredOutput: { status: "supported" },
      },
    });
    expect(model?.prices).toContainEqual(
      expect.objectContaining({ unit: "input-token", usd: "0.000001" }),
    );
    expect(model?.options.map((option) => option.key)).toContain("reasoning.effort");
    expect(model?.options.find((option) => option.key === "reasoning.effort")).toMatchObject({
      values: ["high", "low"],
      defaultValue: "high",
    });
    expect(model?.options.some((option) => option.key === "reasoning.enabled")).toBe(false);
    expect(model?.raw).toMatchObject({ future_field: "preserved" });
  });

  it("combines Vercel gateway and upstream provider controls", async () => {
    const catalog = await vercelGatewayAdapter.discover({
      fetch: jsonFetch({
        data: [
          {
            id: "openai/gpt-5.6-luna",
            name: "GPT-5.6 Luna",
            type: "language",
            tags: ["reasoning", "tool-use"],
            supported_parameters: ["tools", "structured_outputs"],
            modalities: { input: ["text", "image"], output: ["text"] },
            reasoning_options: [{ type: "effort", values: ["low", "high"] }],
            pricing: { input: "0.0000002", output: "0.0000012" },
            endpoints: [
              {
                name: "openai",
                provider_name: "OpenAI",
                pricing: { input: "0.0000003", output: "0.0000015" },
              },
            ],
          },
        ],
      }),
    });
    const model = catalog.models[0];
    expect(model?.options.map((option) => option.key)).toEqual(
      expect.arrayContaining(["caching.auto", "reasoning.effort", "service.tier"]),
    );
    expect(model?.options.find((option) => option.key === "reasoning.effort")).toMatchObject({
      values: ["low", "high"],
    });
    expect(model?.capabilities.input.image?.status).toBe("supported");
    expect(model?.routes[0]).toMatchObject({
      id: "openai",
      provider: "OpenAI",
      prices: expect.arrayContaining([
        expect.objectContaining({ unit: "input-token", usd: "0.0000003" }),
      ]),
    });
    const mapped = vercelGatewayAdapter.mapOptions(model!, {
      "caching.auto": true,
      "reasoning.effort": "high",
    });
    expect(mapped.providerOptions).toEqual({ gateway: { caching: "auto" } });
    expect(mapped.requestOptions).toEqual({ reasoning: { effort: "high" } });
    expect(() => vercelGatewayAdapter.mapOptions(model!, { "reasoning.effort": "max" })).toThrow(
      "Expected one of: low, high",
    );
  });
});

describe("direct provider adapters", () => {
  it("fails safely when a server credential is absent", async () => {
    await expect(openAiAdapter.discover()).rejects.toBeInstanceOf(ProviderDiscoveryError);
    await expect(anthropicAdapter.discover()).rejects.toBeInstanceOf(ProviderDiscoveryError);
    await expect(googleAdapter.discover()).rejects.toBeInstanceOf(ProviderDiscoveryError);
  });

  it("adds maintained OpenAI options without inventing API capabilities", async () => {
    const catalog = await openAiAdapter.discover({
      apiKey: "test-key",
      fetch: jsonFetch({ data: [{ id: "gpt-5.6-luna", owned_by: "openai" }] }),
    });
    const model = catalog.models[0];
    expect(model?.capabilities.reasoning.status).toBe("unknown");
    expect(model?.options.map((option) => option.key)).toEqual([
      "reasoning.effort",
      "service.tier",
    ]);
    expect(model?.sources[0]?.scope).toBe("account");
  });

  it("does not claim language interfaces for OpenAI utility models", async () => {
    const catalog = await openAiAdapter.discover({
      apiKey: "test-key",
      fetch: jsonFetch({
        data: [
          { id: "text-embedding-4-small" },
          { id: "gpt-image-2" },
          { id: "gpt-4o-mini-transcribe" },
          { id: "gpt-realtime-2" },
        ],
      }),
    });
    expect(catalog.models.map((model) => [model.kind, model.interfaces])).toEqual([
      ["embedding", []],
      ["image", []],
      ["audio", []],
      ["system", []],
    ]);
  });

  it("does not add modern Anthropic controls to older model families", async () => {
    const catalog = await anthropicAdapter.discover({
      apiKey: "test-key",
      fetch: jsonFetch({
        data: [{ id: "claude-3-haiku-20240307" }],
        has_more: false,
      }),
    });
    expect(catalog.models[0]?.options).toEqual([]);
  });

  it("uses Anthropic model capabilities to narrow exact effort and thinking values", async () => {
    const catalog = await anthropicAdapter.discover({
      apiKey: "test-key",
      fetch: jsonFetch({
        data: [
          {
            id: "claude-opus-5",
            capabilities: {
              effort: {
                low: { supported: true },
                medium: { supported: false },
                high: { supported: true },
                xhigh: { supported: false },
                max: { supported: true },
              },
              thinking: {
                supported: true,
                types: {
                  adaptive: { supported: true },
                  enabled: { supported: false },
                },
              },
            },
          },
        ],
        has_more: false,
      }),
    });
    const model = catalog.models[0];
    expect(model?.options.find((option) => option.key === "reasoning.effort")).toMatchObject({
      values: ["low", "high", "max"],
    });
    expect(model?.options.find((option) => option.key === "reasoning.mode")).toMatchObject({
      values: ["adaptive", "disabled"],
    });
    expect(model?.options.some((option) => option.key === "reasoning.budgetTokens")).toBe(false);
    expect(model?.options.some((option) => option.key === "speed.mode")).toBe(true);
    expect(
      anthropicAdapter.mapOptions(model!, { "speed.mode": "fast" }).providerOptions,
    ).toMatchObject({
      anthropic: {
        speed: "fast",
        anthropicBeta: ["fast-mode-2026-02-01"],
      },
    });
  });

  it("does not claim Anthropic fast mode for Opus 4.6", async () => {
    const catalog = await anthropicAdapter.discover({
      apiKey: "test-key",
      fetch: jsonFetch({
        data: [{ id: "claude-opus-4-6" }],
        has_more: false,
      }),
    });
    expect(catalog.models[0]?.options.some((option) => option.key === "speed.mode")).toBe(false);
  });

  it("keeps Google credentials out of catalog provenance", async () => {
    let requestedUrl = "";
    let requestedHeaders: HeadersInit | undefined;
    const catalog = await googleAdapter.discover({
      apiKey: "secret-test-key",
      fetch: async (input, init) => {
        requestedUrl = requestUrl(input);
        requestedHeaders = init?.headers;
        return Response.json({
          models: [
            {
              name: "models/gemini-3.5-flash",
              baseModelId: "gemini-3.5-flash",
              inputTokenLimit: 1_000_000,
              supportedGenerationMethods: ["generateContent"],
              thinking: true,
            },
          ],
        });
      },
    });
    expect(requestedUrl).not.toContain("secret-test-key");
    expect(requestedHeaders).toEqual({ "x-goog-api-key": "secret-test-key" });
    expect(JSON.stringify(catalog)).not.toContain("secret-test-key");
    expect(catalog.models[0]?.options.map((option) => option.key)).toContain("reasoning.level");
    expect(catalog.models[0]).toMatchObject({
      kind: "language",
      interfaces: ["google-generate-content"],
    });
  });

  it("does not retain credential-bearing fetch errors", async () => {
    const error = await googleAdapter
      .discover({
        apiKey: "secret-test-key",
        fetch: async () => {
          throw new Error("request failed with secret-test-key");
        },
      })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ProviderDiscoveryError);
    expect((error as Error).message).not.toContain("secret-test-key");
    expect((error as Error).cause).toBeUndefined();
  });

  it("follows Google model pagination without storing credentials", async () => {
    const requestedUrls: string[] = [];
    const catalog = await googleAdapter.discover({
      apiKey: "secret-test-key",
      fetch: async (input) => {
        const url = requestUrl(input);
        requestedUrls.push(url);
        return Response.json(
          url.includes("pageToken=next")
            ? { models: [{ name: "models/gemini-second" }] }
            : {
                models: [{ name: "models/gemini-first" }],
                nextPageToken: "next",
              },
        );
      },
    });
    expect(catalog.models.map((model) => model.id)).toEqual(["gemini-first", "gemini-second"]);
    expect(requestedUrls[1]).toContain("pageToken=next");
    expect(JSON.stringify(catalog)).not.toContain("secret-test-key");
  });

  it("follows Anthropic model pagination", async () => {
    const requestedUrls: string[] = [];
    const catalog = await anthropicAdapter.discover({
      apiKey: "test-key",
      fetch: async (input) => {
        const url = requestUrl(input);
        requestedUrls.push(url);
        return Response.json(
          url.includes("after_id=claude-first")
            ? {
                data: [{ id: "claude-second" }],
                has_more: false,
                last_id: "claude-second",
              }
            : {
                data: [{ id: "claude-first" }],
                has_more: true,
                last_id: "claude-first",
              },
        );
      },
    });
    expect(catalog.models.map((model) => model.id)).toEqual(["claude-first", "claude-second"]);
    expect(requestedUrls[1]).toContain("after_id=claude-first");
  });
});

function jsonFetch(value: unknown): typeof fetch {
  return async () => Response.json(value);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
}
