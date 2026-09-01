import {
  capability,
  unknownCapabilities,
  type ModelCatalog,
  type ModelDescriptor,
  type ProviderId,
  type SourceReference,
} from "@models/core";
import {
  anthropicConstraints,
  anthropicOptions,
  googleOptions,
  openAiOptions,
} from "@models/providers";

/** Small dated direct-provider examples used without exposing browser credentials. */
export function directProviderExamples(): readonly ModelCatalog[] {
  return [
    oneModelCatalog(
      "openai",
      "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
      model("openai", "gpt-5.6-luna", "GPT-5.6 Luna", openAiOptions("gpt-5.6-luna")),
    ),
    oneModelCatalog(
      "anthropic",
      "https://platform.claude.com/docs/en/build-with-claude/effort",
      model("anthropic", "claude-opus-5", "Claude Opus 5", anthropicOptions("claude-opus-5")),
    ),
    oneModelCatalog(
      "google",
      "https://ai.google.dev/gemini-api/docs/generate-content/thinking",
      model("google", "gemini-3.5-flash", "Gemini 3.5 Flash", googleOptions("gemini-3.5-flash")),
    ),
  ];
}

function oneModelCatalog(
  provider: "anthropic" | "google" | "openai",
  url: string,
  value: ModelDescriptor,
): ModelCatalog {
  const source: SourceReference = {
    kind: "provider-docs",
    url,
    retrievedAt: "2026-08-31T00:00:00.000Z",
    scope: "model",
  };
  return {
    schemaVersion: 1,
    provider,
    fetchedAt: source.retrievedAt,
    source,
    models: [
      {
        ...value,
        capabilities: {
          ...value.capabilities,
          input: { text: capability("supported", [source]) },
          output: { text: capability("supported", [source]) },
          reasoning: capability("supported", [source]),
        },
        ...(provider === "anthropic"
          ? { constraints: anthropicConstraints(value.id) }
          : value.constraints === undefined
            ? {}
            : { constraints: value.constraints }),
        requirements: value.requirements.map((requirement) => ({
          ...requirement,
          support: capability(requirement.support.status, [source]),
          sources: [source],
        })),
        sources: [source],
      },
    ],
  };
}

function model(
  provider: ProviderId,
  id: string,
  name: string,
  options: ModelDescriptor["options"],
): ModelDescriptor {
  return {
    key: `${provider}:${id}`,
    provider,
    id,
    name,
    author: provider,
    kind: "language",
    lifecycle: "production",
    capabilities: {
      ...unknownCapabilities(),
      reasoning: capability("supported"),
      input: { text: capability("supported") },
      output: { text: capability("supported") },
    },
    interfaces:
      provider === "anthropic"
        ? ["anthropic-messages"]
        : provider === "google"
          ? ["google-generate-content", "google-interactions"]
          : ["openai-responses"],
    prices: [],
    routes: [],
    options,
    requirements:
      provider === "anthropic"
        ? [
            {
              id: "cache-markers",
              kind: "content-annotation",
              title: "Caching needs prompt markers",
              description:
                "The application must decide which stable prompt blocks are safe to cache.",
              support: capability("supported"),
              sources: [],
            },
          ]
        : [],
    sources: [],
  };
}
