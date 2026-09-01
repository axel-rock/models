import type { ModelDescriptor, ModelSelection, ProviderAdapter } from "@models/core";
import type { LanguageModelCallOptions } from "ai";

/** JSON values accepted by AI SDK provider options. */
export type AiSdkJsonValue =
  | boolean
  | null
  | number
  | string
  | readonly AiSdkJsonValue[]
  | { readonly [key: string]: AiSdkJsonValue };

/** Provider namespaces and JSON options accepted by AI SDK calls. */
export type AiSdkProviderOptions = Readonly<
  Record<string, Readonly<Record<string, AiSdkJsonValue>>>
>;

/** AI SDK call fields produced by this bridge. */
export type AiSdkCallOptions = Partial<Pick<LanguageModelCallOptions, "reasoning">> & {
  readonly providerOptions?: AiSdkProviderOptions;
};

/** The parts needed to call AI SDK after resolving a Models selection. */
export interface PreparedAiSdkCall<TLanguageModel> {
  readonly model: TLanguageModel;
  readonly callOptions: AiSdkCallOptions;
  readonly warnings: readonly string[];
}

/**
 * Convert a validated selection into an AI SDK model and provider options.
 * The returned call options can be spread directly into generateText or streamText.
 */
export function prepareAiSdkCall<TLanguageModel, TModel extends ModelDescriptor>(
  adapter: ProviderAdapter<TModel["provider"], TModel>,
  selection: ModelSelection<TModel>,
  createModel: (modelId: string) => TLanguageModel,
): PreparedAiSdkCall<TLanguageModel> {
  const mapped = adapter.mapOptions(selection.model, selection.options);
  const normalized = normalizeAiSdkOptions(adapter.id, mapped);
  return {
    model: createModel(selection.model.id),
    callOptions: normalized.callOptions,
    warnings: [...mapped.warnings, ...normalized.warnings],
  };
}

function normalizeAiSdkOptions(
  provider: string,
  mapped: ReturnType<ProviderAdapter["mapOptions"]>,
): {
  readonly callOptions: AiSdkCallOptions;
  readonly warnings: readonly string[];
} {
  const providerOptions: Record<string, Readonly<Record<string, AiSdkJsonValue>>> = {
    ...(mapped.providerOptions as AiSdkProviderOptions),
  };
  const warnings: string[] = [];
  const requestOptions = { ...mapped.requestOptions };
  const rawReasoning = requestOptions["reasoning"];
  delete requestOptions["reasoning"];
  let reasoning: LanguageModelCallOptions["reasoning"];

  if (isRecord(rawReasoning) && provider === "openrouter") {
    providerOptions.openrouter = {
      ...providerOptions.openrouter,
      reasoning: rawReasoning as AiSdkJsonValue,
    };
  } else if (isRecord(rawReasoning)) {
    const effort = rawReasoning["effort"];
    const enabled = rawReasoning["enabled"];
    if (isAiSdkReasoning(effort)) reasoning = effort;
    else if (effort !== undefined) {
      const label = typeof effort === "string" ? effort : "selected";
      warnings.push(`AI SDK cannot apply the ${label} portable reasoning effort.`);
    } else if (enabled === false) reasoning = "none";
    else if (enabled === true) reasoning = "provider-default";
    for (const key of Object.keys(rawReasoning)) {
      if (key !== "effort" && key !== "enabled") {
        warnings.push(`AI SDK has no portable ${key} reasoning call option; it was not applied.`);
      }
    }
  }

  for (const key of Object.keys(requestOptions)) {
    warnings.push(`AI SDK has no mapped ${key} call option; it was not applied.`);
  }
  return {
    callOptions: {
      ...(Object.keys(providerOptions).length > 0 && { providerOptions }),
      ...(reasoning !== undefined && { reasoning }),
    },
    warnings,
  };
}

function isRecord(value: unknown): value is Record<string, AiSdkJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAiSdkReasoning(
  value: unknown,
): value is NonNullable<LanguageModelCallOptions["reasoning"]> {
  return ["provider-default", "none", "minimal", "low", "medium", "high", "xhigh"].includes(
    value as string,
  );
}
