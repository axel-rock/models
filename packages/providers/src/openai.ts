import {
  liveApiSource,
  mapModelOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ProviderAdapter,
} from "@models/core";
import { z } from "zod";
import { baseModel } from "./model.ts";
import { openAiOptions } from "./options.ts";
import { fetchProviderJson, requireApiKey } from "./shared.ts";

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/models";
const responseSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        created: z.number().optional(),
        owned_by: z.string().optional(),
        shutdown_date: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});

/** Discover OpenAI model identity, then add dated official option overlays. */
export const openAiAdapter: ProviderAdapter<"openai"> = {
  id: "openai",
  name: "OpenAI",
  catalogEndpoint: DEFAULT_ENDPOINT,
  requiresAuthentication: true,
  async discover(context = {}) {
    const apiKey = requireApiKey(context, "OpenAI");
    const endpoint = context.baseUrl ?? DEFAULT_ENDPOINT;
    const response = await fetchProviderJson(endpoint, context, {
      Authorization: `Bearer ${apiKey}`,
    });
    const parsed = responseSchema.parse(response.value);
    const source = { ...liveApiSource(endpoint, response.fetchedAt), scope: "account" as const };
    const models = parsed.data.map((raw): ModelDescriptor<"openai"> => {
      const kind = openAiModelKind(raw.id);
      return {
        ...baseModel({
          provider: "openai",
          id: raw.id,
          name: raw.id,
          source,
          raw,
          options: openAiOptions(raw.id),
          kind,
        }),
        ...(raw.owned_by === undefined ? {} : { author: raw.owned_by }),
        ...(raw.created === undefined
          ? {}
          : { releasedAt: new Date(raw.created * 1000).toISOString() }),
        lifecycle:
          raw.shutdown_date === undefined || raw.shutdown_date === null ? "unknown" : "deprecated",
        interfaces: kind === "language" ? ["openai-chat-completions", "openai-responses"] : [],
      };
    });
    return {
      schemaVersion: 1,
      provider: "openai",
      fetchedAt: response.fetchedAt,
      source,
      models,
    } satisfies ModelCatalog<"openai">;
  },
  mapOptions(model, values) {
    return mapModelOptions(model, values);
  },
};

function openAiModelKind(modelId: string): ModelDescriptor["kind"] {
  if (/^(?:text-embedding|embedding)/.test(modelId)) return "embedding";
  if (/^(?:dall-e|gpt-image)/.test(modelId)) return "image";
  if (/(?:transcribe|transcription|whisper|tts|audio)/.test(modelId)) return "audio";
  if (/(?:realtime|moderation|search)(?:-|$)/.test(modelId)) return "system";
  if (/^(?:gpt-|o[134](?:-|$)|chatgpt)/.test(modelId)) return "language";
  return "system";
}
