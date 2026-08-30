import {
  capability,
  liveApiSource,
  mapModelOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ProviderAdapter,
} from "@models/core";
import { z } from "zod";
import { baseModel, mergeCapabilities } from "./model.ts";
import { googleOptions } from "./options.ts";
import { fetchProviderJson, ProviderDiscoveryError, requireApiKey } from "./shared.ts";

const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const responseSchema = z.object({
  models: z.array(
    z
      .object({
        name: z.string(),
        baseModelId: z.string().optional(),
        displayName: z.string().optional(),
        description: z.string().optional(),
        inputTokenLimit: z.number().optional(),
        outputTokenLimit: z.number().optional(),
        supportedGenerationMethods: z.array(z.string()).optional(),
        supportedActions: z.array(z.string()).optional(),
        thinking: z.boolean().optional(),
      })
      .passthrough(),
  ),
  nextPageToken: z.string().optional(),
});

/** Discover Google AI models, limits, methods, and general thinking support. */
export const googleAdapter: ProviderAdapter<"google"> = {
  id: "google",
  name: "Google AI",
  catalogEndpoint: DEFAULT_ENDPOINT,
  requiresAuthentication: true,
  async discover(context = {}) {
    const apiKey = requireApiKey(context, "Google AI");
    const endpoint = context.baseUrl ?? DEFAULT_ENDPOINT;
    const pages: Array<z.infer<typeof responseSchema>["models"][number]> = [];
    const seenPageTokens = new Set<string>();
    let pageToken: string | undefined;
    let fetchedAt = new Date().toISOString();
    do {
      const response = await fetchProviderJson(withGooglePageToken(endpoint, pageToken), context, {
        "x-goog-api-key": apiKey,
      });
      fetchedAt = response.fetchedAt;
      const parsed = responseSchema.parse(response.value);
      pages.push(...parsed.models);
      pageToken = parsed.nextPageToken;
      if (pageToken !== undefined && seenPageTokens.has(pageToken)) {
        throw new ProviderDiscoveryError("Google AI returned a repeated model-list page token.");
      }
      if (pageToken !== undefined) {
        seenPageTokens.add(pageToken);
      }
    } while (pageToken !== undefined);
    const source = { ...liveApiSource(endpoint, fetchedAt), scope: "account" as const };
    const models = pages.map((raw): ModelDescriptor<"google"> => {
      const id = raw.baseModelId ?? raw.name.replace(/^models\//, "");
      const actions = raw.supportedActions ?? raw.supportedGenerationMethods ?? [];
      const kind = googleModelKind(actions);
      const model = baseModel({
        provider: "google",
        id,
        name: raw.displayName ?? id,
        source,
        raw,
        kind,
        options: googleOptions(id),
      });
      return {
        ...model,
        ...(raw.description === undefined ? {} : { description: raw.description }),
        ...(raw.inputTokenLimit === undefined
          ? {}
          : {
              contextWindow: {
                value: raw.inputTokenLimit,
                confidence: "provider-confirmed" as const,
                sources: [source],
              },
            }),
        ...(raw.outputTokenLimit === undefined
          ? {}
          : {
              maxOutputTokens: {
                value: raw.outputTokenLimit,
                confidence: "provider-confirmed" as const,
                sources: [source],
              },
            }),
        capabilities: mergeCapabilities(model.capabilities, {
          reasoning: capability(raw.thinking === true ? "supported" : "unknown", [source]),
          tools: capability("unknown", [source]),
        }),
        interfaces: actions.includes("generateContent") ? ["google-generate-content"] : [],
        requirements: [
          {
            id: "google-server-discovery",
            kind: "server-only",
            title: "Direct discovery stays on the server",
            description:
              "The Google model endpoint requires a credential that must not enter browser components.",
            support: capability("supported", [source]),
            sources: [source],
          },
        ],
      };
    });
    return {
      schemaVersion: 1,
      provider: "google",
      fetchedAt,
      source,
      models,
    } satisfies ModelCatalog<"google">;
  },
  mapOptions(model, values) {
    return mapModelOptions(model, values);
  },
};

function withGooglePageToken(endpoint: string, pageToken?: string): string {
  const url = new URL(endpoint);
  if (pageToken !== undefined) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

function googleModelKind(actions: readonly string[]): ModelDescriptor["kind"] {
  if (actions.includes("embedContent") || actions.includes("batchEmbedContents")) {
    return "embedding";
  }
  return actions.includes("generateContent") ? "language" : "system";
}
