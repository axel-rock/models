import {
  capability,
  liveApiSource,
  mapModelOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type PriceRate,
  type ProviderAdapter,
} from "@models/core";
import { z } from "zod";
import { baseModel, mergeCapabilities, modalityCapabilities } from "./model.ts";
import { openRouterOptions } from "./options.ts";
import { fetchProviderJson } from "./shared.ts";

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/models";

const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        created: z.number().optional(),
        context_length: z.number().optional(),
        architecture: z
          .object({
            input_modalities: z.array(z.string()).optional(),
            output_modalities: z.array(z.string()).optional(),
          })
          .passthrough()
          .optional(),
        pricing: z.record(z.string(), z.unknown()).optional(),
        supported_parameters: z.array(z.string()).optional(),
        reasoning: z
          .object({
            mandatory: z.boolean().optional(),
            default_enabled: z.boolean().optional(),
            supported_efforts: z.array(z.string()).nullable().optional(),
            default_effort: z.string().nullable().optional(),
            supports_max_tokens: z.boolean().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
        top_provider: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  ),
});

/** Discover the public OpenRouter catalog and its advertised parameter support. */
export const openRouterAdapter: ProviderAdapter<"openrouter"> = {
  id: "openrouter",
  name: "OpenRouter",
  catalogEndpoint: DEFAULT_ENDPOINT,
  requiresAuthentication: false,
  async discover(context = {}) {
    const endpoint = context.baseUrl ?? DEFAULT_ENDPOINT;
    const response = await fetchProviderJson(endpoint, context);
    const parsed = responseSchema.parse(response.value);
    const source = { ...liveApiSource(endpoint, response.fetchedAt), scope: "endpoint" as const };
    const models = parsed.data.map((raw): ModelDescriptor<"openrouter"> => {
      const supported = raw.supported_parameters ?? [];
      const model = baseModel({
        provider: "openrouter",
        id: raw.id,
        name: raw.name ?? raw.id,
        source,
        raw,
        kind: openRouterKind(raw.architecture?.output_modalities ?? []),
        options: openRouterOptions(
          raw.reasoning === undefined || raw.reasoning === null
            ? undefined
            : {
                ...(raw.reasoning.mandatory === undefined
                  ? {}
                  : { mandatory: raw.reasoning.mandatory }),
                ...(raw.reasoning.default_enabled === undefined
                  ? {}
                  : { defaultEnabled: raw.reasoning.default_enabled }),
                ...(raw.reasoning.supported_efforts === undefined ||
                raw.reasoning.supported_efforts === null
                  ? {}
                  : { supportedEfforts: raw.reasoning.supported_efforts }),
                ...(raw.reasoning.default_effort === undefined ||
                raw.reasoning.default_effort === null
                  ? {}
                  : { defaultEffort: raw.reasoning.default_effort }),
                ...(raw.reasoning.supports_max_tokens === undefined
                  ? {}
                  : { supportsMaxTokens: raw.reasoning.supports_max_tokens }),
              },
        ),
      });
      const supports = (name: string) => supported.includes(name);
      return {
        ...model,
        author: raw.id.split("/")[0] ?? "openrouter",
        ...(raw.description === undefined ? {} : { description: raw.description }),
        ...(raw.created === undefined
          ? {}
          : { releasedAt: new Date(raw.created * 1000).toISOString() }),
        ...(raw.context_length === undefined
          ? {}
          : {
              contextWindow: {
                value: raw.context_length,
                confidence: "provider-confirmed" as const,
                sources: [source],
              },
            }),
        capabilities: mergeCapabilities(model.capabilities, {
          input: modalityCapabilities(raw.architecture?.input_modalities ?? [], source),
          output: modalityCapabilities(raw.architecture?.output_modalities ?? [], source),
          reasoning: capability(raw.reasoning === undefined ? "unknown" : "supported", [source]),
          tools: capability(supports("tools") ? "supported" : "unknown", [source]),
          structuredOutput: capability(
            supports("structured_outputs") || supports("response_format") ? "supported" : "unknown",
            [source],
          ),
          promptCaching: capability(
            raw.pricing?.input_cache_read === undefined ? "unknown" : "supported",
            [source],
          ),
        }),
        interfaces: model.kind === "language" ? ["openai-chat-completions"] : [],
        prices: openRouterPrices(raw.pricing, source),
        routes: [],
      };
    });
    return {
      schemaVersion: 1,
      provider: "openrouter",
      fetchedAt: response.fetchedAt,
      source,
      models,
    } satisfies ModelCatalog<"openrouter">;
  },
  mapOptions(model, values) {
    return mapModelOptions(model, values);
  },
};

function openRouterKind(outputModalities: readonly string[]): ModelDescriptor["kind"] {
  if (outputModalities.includes("text")) {
    return "language";
  }
  for (const kind of ["image", "audio", "video"] as const) {
    if (outputModalities.includes(kind)) {
      return kind;
    }
  }
  return "system";
}

function openRouterPrices(
  pricing: Record<string, unknown> | undefined,
  source: ReturnType<typeof liveApiSource>,
): readonly PriceRate[] {
  if (pricing === undefined) {
    return [];
  }
  const fields: ReadonlyArray<readonly [string, PriceRate["unit"]]> = [
    ["prompt", "input-token"],
    ["completion", "output-token"],
    ["input_cache_read", "cache-read-token"],
    ["input_cache_write", "cache-write-token"],
    ["image", "image"],
    ["request", "request"],
  ];
  return fields.flatMap(([field, unit]) => {
    const usd = pricing[field];
    return typeof usd !== "string" || !/^\d+(?:\.\d+)?$/.test(usd)
      ? []
      : [{ unit, usd, per: 1, evidence: [source] }];
  });
}
