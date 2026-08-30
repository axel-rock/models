import {
  capability,
  liveApiSource,
  mapModelOptions,
  type MappedModelOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ProviderAdapter,
} from "@models/core";
import { z } from "zod";
import { baseModel, mergeCapabilities } from "./model.ts";
import { anthropicConstraints, anthropicOptions } from "./options.ts";
import { fetchProviderJson, ProviderDiscoveryError, requireApiKey } from "./shared.ts";

const DEFAULT_ENDPOINT = "https://api.anthropic.com/v1/models";
const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        display_name: z.string().optional(),
        created_at: z.string().optional(),
        max_input_tokens: z.number().optional(),
        max_tokens: z.number().optional(),
        capabilities: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .passthrough(),
  ),
  has_more: z.boolean().optional(),
  last_id: z.string().nullable().optional(),
});

/** Discover Anthropic models and explicit capability fields with pagination. */
export const anthropicAdapter: ProviderAdapter<"anthropic"> = {
  id: "anthropic",
  name: "Anthropic",
  catalogEndpoint: DEFAULT_ENDPOINT,
  requiresAuthentication: true,
  async discover(context = {}) {
    const apiKey = requireApiKey(context, "Anthropic");
    const endpoint = context.baseUrl ?? DEFAULT_ENDPOINT;
    const pages: Array<z.infer<typeof responseSchema>["data"][number]> = [];
    const seenAfterIds = new Set<string>();
    let afterId: string | undefined;
    let fetchedAt = new Date().toISOString();
    do {
      const response = await fetchProviderJson(withAfterId(endpoint, afterId), context, {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      });
      fetchedAt = response.fetchedAt;
      const parsed = responseSchema.parse(response.value);
      pages.push(...parsed.data);
      if (parsed.has_more === true && parsed.last_id === null) {
        throw new ProviderDiscoveryError("Anthropic reported another model page without a cursor.");
      }
      afterId = parsed.has_more === true ? (parsed.last_id ?? undefined) : undefined;
      if (afterId !== undefined && seenAfterIds.has(afterId)) {
        throw new ProviderDiscoveryError("Anthropic returned a repeated model-list cursor.");
      }
      if (afterId !== undefined) {
        seenAfterIds.add(afterId);
      }
    } while (afterId !== undefined);
    const source = { ...liveApiSource(endpoint, fetchedAt), scope: "account" as const };
    const models = pages.map((raw): ModelDescriptor<"anthropic"> => {
      const model = baseModel({
        provider: "anthropic",
        id: raw.id,
        name: raw.display_name ?? raw.id,
        source,
        raw,
        options: anthropicOptions(raw.id, raw.capabilities ?? undefined),
      });
      const capabilities = raw.capabilities ?? {};
      return {
        ...model,
        ...(raw.created_at === undefined ? {} : { releasedAt: raw.created_at }),
        ...(raw.max_input_tokens === undefined
          ? {}
          : {
              contextWindow: {
                value: raw.max_input_tokens,
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
          reasoning: capability(capabilityStatus(capabilities, ["thinking", "effort"]), [source]),
          promptCaching: capability(capabilityStatus(capabilities, ["prompt_caching"]), [source]),
          tools: capability(capabilityStatus(capabilities, ["tools", "tool_use"]), [source]),
        }),
        interfaces: ["anthropic-messages"],
        constraints: anthropicConstraints(raw.id),
        requirements: [
          {
            id: "anthropic-cache-breakpoints",
            kind: "content-annotation",
            title: "Cache breakpoints belong to prompt content",
            description:
              "Selecting a cache lifetime is not enough. The application must mark stable prompt blocks.",
            support: capability("supported", model.sources),
            sources: model.sources,
          },
          ...(/claude-opus-(?:5|4-8)(?:$|-)/.test(raw.id)
            ? [
                {
                  id: "anthropic-fast-beta",
                  kind: "beta-contract" as const,
                  title: "Fast mode requires provider access",
                  description:
                    "The fast selection only works for accounts and requests enrolled in Anthropic fast mode.",
                  support: capability("supported", model.sources),
                  sources: model.sources,
                },
              ]
            : []),
        ],
      };
    });
    return {
      schemaVersion: 1,
      provider: "anthropic",
      fetchedAt,
      source,
      models,
    } satisfies ModelCatalog<"anthropic">;
  },
  mapOptions(model, values) {
    const generic = mapModelOptions(model, values);
    const anthropic = {
      ...(generic.providerOptions.anthropic as Record<string, unknown> | undefined),
    };
    const mode = values["reasoning.mode"];
    if (mode === "adaptive") {
      anthropic.thinking = { type: "adaptive" };
    } else if (mode === "disabled") {
      anthropic.thinking = { type: "disabled" };
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
    return {
      ...generic,
      providerOptions: { ...generic.providerOptions, anthropic },
    } satisfies MappedModelOptions;
  },
};

function withAfterId(endpoint: string, afterId?: string): string {
  const url = new URL(endpoint);
  if (afterId !== undefined) {
    url.searchParams.set("after_id", afterId);
  }
  return url.toString();
}

function capabilityStatus(
  capabilities: Record<string, unknown>,
  names: readonly string[],
): "supported" | "unknown" {
  for (const name of names) {
    const value = capabilities[name];
    if (value === true) {
      return "supported";
    }
    if (
      typeof value === "object" &&
      value !== null &&
      (value as { supported?: unknown }).supported === true
    ) {
      return "supported";
    }
  }
  return "unknown";
}
