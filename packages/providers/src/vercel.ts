import {
  capability,
  liveApiSource,
  mapModelOptions,
  type MappedModelOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type OptionDefinition,
  type PriceRate,
  type ProviderAdapter,
} from "@models/core";
import { z } from "zod";
import { baseModel, mergeCapabilities, modalityCapabilities } from "./model.ts";
import {
  anthropicConstraints,
  anthropicOptions,
  googleOptions,
  openAiOptions,
  vercelGatewayOptions,
} from "./options.ts";
import { fetchProviderJson } from "./shared.ts";

const DEFAULT_ENDPOINT = "https://ai-gateway.vercel.sh/v1/models";

const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        created: z.number().optional(),
        released: z.number().optional(),
        owned_by: z.string().optional(),
        context_window: z.number().optional(),
        max_tokens: z.number().optional(),
        type: z.string().optional(),
        tags: z.array(z.string()).optional(),
        supported_parameters: z.array(z.string()).optional(),
        modalities: z
          .object({
            input: z.array(z.string()).optional(),
            output: z.array(z.string()).optional(),
          })
          .passthrough()
          .optional(),
        reasoning_options: z
          .array(
            z
              .object({
                type: z.string(),
                values: z.array(z.string()).optional(),
                min: z.number().optional(),
                max: z.number().optional(),
              })
              .passthrough(),
          )
          .optional(),
        pricing: z.record(z.string(), z.unknown()).optional(),
        endpoints: z
          .array(
            z
              .object({
                name: z.string(),
                provider_name: z.string().optional(),
                pricing: z.record(z.string(), z.unknown()).optional(),
                status: z.number().optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
  ),
});

/** Discover Vercel AI Gateway's public catalog with capabilities and prices. */
export const vercelGatewayAdapter: ProviderAdapter<"vercel"> = {
  id: "vercel",
  name: "Vercel AI Gateway",
  catalogEndpoint: DEFAULT_ENDPOINT,
  requiresAuthentication: false,
  async discover(context = {}) {
    const endpoint = context.baseUrl ?? DEFAULT_ENDPOINT;
    const response = await fetchProviderJson(endpoint, context);
    const parsed = responseSchema.parse(response.value);
    const source = { ...liveApiSource(endpoint, response.fetchedAt), scope: "endpoint" as const };
    const models = parsed.data.map((raw): ModelDescriptor<"vercel"> => {
      const tags = raw.tags ?? [];
      const [upstream = "", ...modelParts] = raw.id.split("/");
      const upstreamId = modelParts.join("/");
      const liveReasoningOptions = vercelReasoningOptions(raw.reasoning_options, source);
      const options = mergeOptions(
        [...vercelGatewayOptions(), ...upstreamOptions(upstream, upstreamId)],
        liveReasoningOptions,
      );
      const model = baseModel({
        provider: "vercel",
        id: raw.id,
        name: raw.name ?? raw.id,
        kind: modelKind(raw.type),
        source,
        raw,
        options,
      });
      const prices = vercelPrices(raw.pricing, source);
      const supported = raw.supported_parameters ?? [];
      const supports = (name: string) => supported.includes(name);
      return {
        ...model,
        ...(raw.description === undefined ? {} : { description: raw.description }),
        ...(raw.owned_by === undefined ? {} : { author: raw.owned_by }),
        ...(raw.released === undefined
          ? {}
          : { releasedAt: new Date(raw.released * 1000).toISOString() }),
        ...(raw.context_window === undefined
          ? {}
          : {
              contextWindow: {
                value: raw.context_window,
                confidence: "provider-confirmed" as const,
                sources: [source],
              },
            }),
        ...(raw.max_tokens === undefined
          ? {}
          : {
              maxOutputTokens: {
                value: raw.max_tokens,
                confidence: "provider-confirmed" as const,
                sources: [source],
              },
            }),
        capabilities: mergeCapabilities(model.capabilities, {
          input: modalityCapabilities(raw.modalities?.input ?? [], source),
          output: modalityCapabilities(raw.modalities?.output ?? [], source),
          reasoning: capability(
            liveReasoningOptions.length > 0 || supports("reasoning") ? "supported" : "unknown",
            [source],
          ),
          tools: capability(
            supports("tools") || tags.includes("tool-use") ? "supported" : "unknown",
            [source],
          ),
          structuredOutput: capability(
            supports("structured_outputs") || tags.includes("structured-output")
              ? "supported"
              : "unknown",
            [source],
          ),
          promptCaching: capability(
            raw.pricing?.input_cache_read === undefined ? "unknown" : "supported",
            [source],
          ),
        }),
        interfaces:
          model.kind === "language" ? ["openai-chat-completions", "openai-responses"] : [],
        prices,
        routes: (raw.endpoints ?? []).map((route) => ({
          id: route.name,
          ...(route.provider_name === undefined ? {} : { provider: route.provider_name }),
          prices: vercelPrices(route.pricing, source),
          sources: [source],
          raw: route,
        })),
        ...(upstreamConstraints(upstream, upstreamId).length === 0
          ? {}
          : { constraints: upstreamConstraints(upstream, upstreamId) }),
      };
    });
    return {
      schemaVersion: 1,
      provider: "vercel",
      fetchedAt: response.fetchedAt,
      source,
      models,
    } satisfies ModelCatalog<"vercel">;
  },
  mapOptions(model, values) {
    const mapped = mapModelOptions(model, values);
    const autoCaching = values["caching.auto"];
    const upstream = model.id.split("/")[0];
    const providerOptions =
      upstream === "anthropic"
        ? mapAnthropicOptions(mapped.providerOptions, values)
        : mapped.providerOptions;
    return {
      ...mapped,
      providerOptions:
        autoCaching === true
          ? mergeNested(providerOptions, { gateway: { caching: "auto" } })
          : providerOptions,
      warnings:
        upstream === "anthropic"
          ? mapped.warnings.filter(
              (warning) =>
                !["reasoning.mode", "reasoning.budgetTokens"].some((key) =>
                  warning.startsWith(`${key} `),
                ),
            )
          : mapped.warnings,
    } satisfies MappedModelOptions;
  },
};

function mergeOptions(
  documented: readonly OptionDefinition[],
  live: readonly OptionDefinition[],
): readonly OptionDefinition[] {
  const normalizedLive = live.filter(
    (option) =>
      option.key !== "reasoning.enabled" ||
      !documented.some((candidate) => candidate.key === "reasoning.mode"),
  );
  const liveByKey = new Map(normalizedLive.map((option) => [option.key, option]));
  return [
    ...documented.map((option) => liveByKey.get(option.key) ?? option),
    ...normalizedLive.filter(
      (option) => !documented.some((candidate) => candidate.key === option.key),
    ),
  ];
}

function mapAnthropicOptions(
  providerOptions: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const anthropic = {
    ...(providerOptions.anthropic as Record<string, unknown> | undefined),
  };
  const mode = values["reasoning.mode"];
  if (mode === "adaptive" || mode === "disabled") {
    anthropic.thinking = { type: mode };
  } else if (mode === "enabled") {
    anthropic.thinking = {
      type: "enabled",
      ...(typeof values["reasoning.budgetTokens"] === "number"
        ? { budgetTokens: values["reasoning.budgetTokens"] }
        : {}),
    };
  }
  if (typeof values["caching.ttl"] === "string") {
    anthropic.cacheControl = { type: "ephemeral", ttl: values["caching.ttl"] };
  }
  if (values["speed.mode"] === "fast") {
    const betaFeatures = Array.isArray(anthropic.anthropicBeta)
      ? anthropic.anthropicBeta.filter((value): value is string => typeof value === "string")
      : [];
    anthropic.anthropicBeta = [...new Set([...betaFeatures, "fast-mode-2026-02-01"])];
  }
  return { ...providerOptions, anthropic };
}

function upstreamOptions(provider: string, modelId: string): readonly OptionDefinition[] {
  switch (provider) {
    case "anthropic":
      return anthropicOptions(modelId);
    case "google":
      return googleOptions(modelId);
    case "openai":
      return openAiOptions(modelId);
    default:
      return [];
  }
}

function upstreamConstraints(
  provider: string,
  modelId: string,
): NonNullable<ModelDescriptor["constraints"]> {
  return provider === "anthropic" ? anthropicConstraints(modelId) : [];
}

function vercelReasoningOptions(
  values:
    | readonly {
        readonly type: string;
        readonly values?: readonly string[] | undefined;
        readonly min?: number | undefined;
        readonly max?: number | undefined;
      }[]
    | undefined,
  source: ReturnType<typeof liveApiSource>,
): readonly OptionDefinition[] {
  const options: OptionDefinition[] = [];
  for (const value of values ?? []) {
    if (value.type === "toggle") {
      options.push({
        key: "reasoning.enabled",
        kind: "boolean",
        label: "Reasoning",
        description: "Enables or disables reasoning for this model.",
        group: "reasoning",
        support: capability("supported", [source]),
        target: { kind: "request-option", path: ["reasoning", "enabled"] },
      });
    } else if (value.type === "effort" && (value.values?.length ?? 0) > 0) {
      options.push({
        key: "reasoning.effort",
        kind: "enum",
        label: "Reasoning effort",
        description: "Uses only the effort levels advertised by AI Gateway.",
        group: "reasoning",
        support: capability("supported", [source]),
        values: value.values ?? [],
        target: { kind: "request-option", path: ["reasoning", "effort"] },
      });
    } else if (value.type === "budget_tokens") {
      options.push({
        key: "reasoning.maxTokens",
        kind: "integer",
        label: "Reasoning token budget",
        description: "Sets the reasoning token budget within the advertised limits.",
        group: "reasoning",
        support: capability("supported", [source]),
        ...(value.min === undefined ? {} : { min: value.min }),
        ...(value.max === undefined ? {} : { max: value.max }),
        step: 1,
        target: { kind: "request-option", path: ["reasoning", "max_tokens"] },
      });
    }
  }
  return options;
}

function modelKind(type: string | undefined): ModelDescriptor["kind"] {
  switch (type) {
    case "audio":
    case "embedding":
    case "image":
    case "language":
    case "video":
      return type;
    default:
      return "system";
  }
}

function vercelPrices(
  pricing: Record<string, unknown> | undefined,
  source: ReturnType<typeof liveApiSource>,
): readonly PriceRate[] {
  if (pricing === undefined) {
    return [];
  }
  const fields: ReadonlyArray<readonly [string, PriceRate["unit"]]> = [
    ["input", "input-token"],
    ["output", "output-token"],
    ["input_cache_read", "cache-read-token"],
    ["input_cache_write", "cache-write-token"],
    ["image", "image"],
    ["web_search", "request"],
  ];
  return fields.flatMap(([field, unit]) => {
    const usd = pricing[field];
    return typeof usd !== "string" || !/^\d+(?:\.\d+)?$/.test(usd)
      ? []
      : [{ unit, usd, per: 1, evidence: [source] }];
  });
}

function mergeNested(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const output: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const existing = output[key];
    output[key] =
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing) &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
        ? mergeNested(existing as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return output;
}
