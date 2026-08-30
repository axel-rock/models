import {
  capability,
  unknownCapabilities,
  type CapabilitySupport,
  type ModelCapabilities,
  type ModelDescriptor,
  type Modality,
  type OptionDefinition,
  type ProviderId,
  type SourceReference,
} from "@models/core";

/** Build a model descriptor with conservative unknown defaults. */
export function baseModel<TProvider extends ProviderId>(input: {
  readonly provider: TProvider;
  readonly id: string;
  readonly name: string;
  readonly kind?: ModelDescriptor["kind"];
  readonly source: SourceReference;
  readonly raw: unknown;
  readonly options?: readonly OptionDefinition[];
}): ModelDescriptor<TProvider> {
  return {
    key: `${input.provider}:${input.id}`,
    provider: input.provider,
    id: input.id,
    name: input.name,
    kind: input.kind ?? "language",
    lifecycle: "unknown",
    capabilities: unknownCapabilities(),
    interfaces: [],
    prices: [],
    routes: [],
    options: input.options ?? [],
    requirements: [],
    sources: [input.source],
    raw: input.raw,
  };
}

/** Convert declared media lists to evidence-backed capability maps. */
export function modalityCapabilities(
  modalities: readonly string[],
  source: SourceReference,
): Readonly<Partial<Record<Modality, CapabilitySupport>>> {
  const result: Partial<Record<Modality, CapabilitySupport>> = {};
  for (const modality of modalities) {
    if (isModality(modality)) {
      result[modality] = capability("supported", [source]);
    }
  }
  return result;
}

/** Merge partial capability facts while preserving unknown fields. */
export function mergeCapabilities(
  base: ModelCapabilities,
  patch: Partial<ModelCapabilities>,
): ModelCapabilities {
  return {
    input: patch.input ?? base.input,
    output: patch.output ?? base.output,
    reasoning: patch.reasoning ?? base.reasoning,
    tools: patch.tools ?? base.tools,
    structuredOutput: patch.structuredOutput ?? base.structuredOutput,
    promptCaching: patch.promptCaching ?? base.promptCaching,
  };
}

function isModality(value: string): value is Modality {
  return ["audio", "file", "image", "text", "video"].includes(value);
}
