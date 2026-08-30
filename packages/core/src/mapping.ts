import { selectModel } from "./options.ts";
import type {
  MappedModelOptions,
  ModelDescriptor,
  OptionDefinition,
  OptionValues,
} from "./types.ts";

/** Validate a model selection before mapping its flat values to provider requests. */
export function mapModelOptions<const TModel extends ModelDescriptor>(
  model: TModel,
  values: OptionValues<TModel["options"]>,
): MappedModelOptions {
  const selection = selectModel(model, values);
  return mapDefinedOptions(model.options, selection.options);
}

/** Map validated flat option values to nested request and provider options. */
export function mapDefinedOptions(
  definitions: readonly OptionDefinition[],
  values: Readonly<Record<string, unknown>>,
): MappedModelOptions {
  const providerOptions: Record<string, unknown> = {};
  const requestOptions: Record<string, unknown> = {};
  const warnings: string[] = [];
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const [key, value] of Object.entries(values)) {
    const definition = byKey.get(key);
    if (definition?.target === undefined) {
      warnings.push(`${key} has no request mapping and was not applied.`);
      continue;
    }

    const root = definition.target.kind === "provider-option" ? providerOptions : requestOptions;
    const path =
      definition.target.namespace === undefined
        ? definition.target.path
        : [definition.target.namespace, ...definition.target.path];
    setNested(root, path, value);
  }

  return { providerOptions, requestOptions, warnings };
}

function setNested(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  if (path.length === 0) {
    return;
  }

  let current = target;
  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];
    if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      current = existing as Record<string, unknown>;
      continue;
    }
    const nested: Record<string, unknown> = {};
    current[segment] = nested;
    current = nested;
  }
  const last = path.at(-1);
  if (last !== undefined) {
    current[last] = value;
  }
}
