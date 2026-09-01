import type {
  EnumOptionDefinition,
  ModelCatalog,
  ModelDescriptor,
  OptionGroup,
  OptionValue,
  OptionValues,
  PriceRate,
  PriceUnit,
} from "./types.ts";
import { validateOptions } from "./options.ts";

/** A model label owned by the consuming application. */
export interface ModelRecommendation {
  /** A provider-qualified model key or exact provider model ID. */
  readonly model: string;
  /** Short text such as "Recommended for this app". */
  readonly label: string;
  /** Optional longer explanation for richer interfaces. */
  readonly description?: string;
}

/** Rules that narrow a catalog without changing its provider evidence. */
export interface ModelCuration {
  /** Provider-qualified keys or exact provider model IDs, in preferred order. */
  readonly include?: readonly string[];
  /** Allowed values for enum options, keyed by the provider-neutral option key. */
  readonly optionValues?: Readonly<Record<string, readonly string[]>>;
}

/** One immutable application policy shared by every model selector presentation. */
export interface ModelPolicy {
  /** Optional model allowlist and app-owned recommendation labels. */
  readonly models?: {
    readonly include?: readonly string[];
    readonly recommendations?: readonly ModelRecommendation[];
  };
  /** Option groups exposed by the UI and optional enum value limits. */
  readonly options?: {
    readonly groups?: readonly OptionGroup[];
    readonly values?: Readonly<Record<string, readonly string[]>>;
    /** App-owned initial values, applied only when the selected model accepts them. */
    readonly defaults?: OptionValues<ModelDescriptor["options"]>;
  };
}

type CatalogModel<TCatalogs extends readonly ModelCatalog[]> = TCatalogs[number]["models"][number];
type CatalogOption<TCatalogs extends readonly ModelCatalog[]> =
  CatalogModel<TCatalogs>["options"][number];
type CatalogEnumOption<TCatalogs extends readonly ModelCatalog[]> = Extract<
  CatalogOption<TCatalogs>,
  EnumOptionDefinition
>;

/** A policy checked against literal or generated catalog model and option types. */
export interface ModelPolicyFor<TCatalogs extends readonly ModelCatalog[]> {
  readonly models?: {
    readonly include?: readonly (CatalogModel<TCatalogs>["id"] | CatalogModel<TCatalogs>["key"])[];
    readonly recommendations?: readonly (Omit<ModelRecommendation, "model"> & {
      readonly model: CatalogModel<TCatalogs>["id"] | CatalogModel<TCatalogs>["key"];
    })[];
  };
  readonly options?: {
    readonly groups?: readonly CatalogOption<TCatalogs>["group"][];
    readonly values?: {
      readonly [
        TOption in CatalogEnumOption<TCatalogs> as TOption["key"]
      ]?: readonly OptionValue<TOption>[];
    };
    readonly defaults?: {
      readonly [TOption in CatalogOption<TCatalogs> as TOption["key"]]?: OptionValue<TOption>;
    };
  };
}

/** The catalogs and display metadata produced from one application policy. */
export interface ResolvedModelPolicy {
  readonly catalogs: readonly ModelCatalog[];
  readonly groups: readonly OptionGroup[];
  readonly recommendations: readonly ModelRecommendation[];
  readonly defaults: OptionValues<ModelDescriptor["options"]>;
  /** Unknown references or values that could not be applied to the supplied catalogs. */
  readonly diagnostics: readonly ModelPolicyDiagnostic[];
}

/** One policy entry that does not match the supplied catalog evidence. */
export interface ModelPolicyDiagnostic {
  readonly kind: "default" | "model" | "option-key" | "option-value" | "recommendation";
  readonly path: string;
  readonly message: string;
}

/** Preserve literal inference while declaring a reusable model policy. */
export function defineModelPolicy<const TPolicy extends ModelPolicy>(policy: TPolicy): TPolicy {
  return policy;
}

/** Define a policy checked against a literal or generated catalog type. */
export function defineModelPolicyFor<
  const TCatalogs extends readonly ModelCatalog[],
  const TPolicy extends ModelPolicyFor<TCatalogs>,
>(catalogs: TCatalogs, policy: TPolicy): TPolicy {
  void catalogs;
  return policy;
}

/** Apply one application policy for use by any selector presentation. */
export function resolveModelPolicy(
  catalogs: readonly ModelCatalog[],
  policy: ModelPolicy,
): ResolvedModelPolicy {
  const diagnostics = policyDiagnostics(catalogs, policy);
  const curatedCatalogs = curateCatalogs(catalogs, {
    ...(policy.models?.include === undefined ? {} : { include: policy.models.include }),
    ...(policy.options?.values === undefined ? {} : { optionValues: policy.options.values }),
  });
  return {
    catalogs: curatedCatalogs,
    groups: policy.options?.groups ?? [
      "reasoning",
      "speed",
      "routing",
      "caching",
      "beta",
      "generation",
    ],
    recommendations: (policy.models?.recommendations ?? []).filter(
      (recommendation) => findModel(curatedCatalogs, recommendation.model) !== undefined,
    ),
    defaults: policy.options?.defaults ?? {},
    diagnostics,
  };
}

/** Resolve and validate app-owned defaults for one selected model. */
export function resolvePolicyDefaults(
  model: ModelDescriptor,
  policy: ResolvedModelPolicy,
): OptionValues<ModelDescriptor["options"]> {
  const values: Record<string, string | number | boolean | readonly string[]> = {};
  for (const option of model.options) {
    const value = policy.defaults[option.key];
    if (value !== undefined && validateOptions([option], { [option.key]: value }).ok) {
      values[option.key] = value;
    }
  }
  reconcileConstraints(model, values);
  return values;
}

/** Return catalog copies containing only the explicitly allowed models and option values. */
export function curateCatalogs(
  catalogs: readonly ModelCatalog[],
  curation: ModelCuration,
): readonly ModelCatalog[] {
  if (curation.include === undefined && curation.optionValues === undefined) {
    return catalogs;
  }
  const order =
    curation.include === undefined
      ? undefined
      : new Map(curation.include.map((reference, index) => [reference, index]));
  return catalogs.map((catalog) => ({
    ...catalog,
    models: curateModels(catalog.models, order, curation.optionValues),
  }));
}

/** Find the first model matching a provider-qualified key or exact provider ID. */
export function findModel(
  catalogs: readonly ModelCatalog[],
  reference: string,
): ModelDescriptor | undefined {
  return catalogs.flatMap((catalog) => catalog.models).find((model) => matches(model, reference));
}

/**
 * Find the model with the lowest unconditional model-level rate for one unit.
 * This does not estimate route prices, conditional tiers, or a blended workload.
 */
export function findLowestPricedModel(
  catalogs: readonly ModelCatalog[],
  unit: PriceUnit,
): ModelDescriptor | undefined {
  let lowest: { readonly model: ModelDescriptor; readonly rate: RationalPrice } | undefined;
  for (const model of catalogs.flatMap((catalog) => catalog.models)) {
    const price = model.prices.find((rate) => rate.unit === unit && rate.condition === undefined);
    const rate = price === undefined ? undefined : rationalPrice(price);
    if (rate !== undefined && (lowest === undefined || compare(rate, lowest.rate) < 0)) {
      lowest = { model, rate };
    }
  }
  return lowest?.model;
}

interface RationalPrice {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function rationalPrice(price: PriceRate): RationalPrice | undefined {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(price.usd);
  if (match === null || price.per <= 0 || !Number.isSafeInteger(price.per)) {
    return undefined;
  }
  const fraction = match[2] ?? "";
  return {
    numerator: BigInt(`${match[1]}${fraction}`),
    denominator: 10n ** BigInt(fraction.length) * BigInt(price.per),
  };
}

function compare(left: RationalPrice, right: RationalPrice): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function modelReferenceIndex(
  model: ModelDescriptor,
  order: ReadonlyMap<string, number>,
): number | undefined {
  return order.get(model.key) ?? order.get(model.id);
}

function curateModels(
  models: readonly ModelDescriptor[],
  order: ReadonlyMap<string, number> | undefined,
  optionValues: Readonly<Record<string, readonly string[]>> | undefined,
): readonly ModelDescriptor[] {
  const included =
    order === undefined
      ? models
      : models
          .filter((model) => modelReferenceIndex(model, order) !== undefined)
          .toSorted(
            (left, right) =>
              (modelReferenceIndex(left, order) ?? Number.MAX_SAFE_INTEGER) -
              (modelReferenceIndex(right, order) ?? Number.MAX_SAFE_INTEGER),
          );
  return optionValues === undefined
    ? included
    : included.map((model) => curateModelOptions(model, optionValues));
}

function curateModelOptions(
  model: ModelDescriptor,
  optionValues: Readonly<Record<string, readonly string[]>> | undefined,
): ModelDescriptor {
  return {
    ...model,
    options: model.options.flatMap((option) => {
      const allowed = optionValues?.[option.key];
      if (allowed === undefined || option.kind !== "enum") {
        return [option];
      }
      const values = option.values.filter((value) => allowed.includes(value));
      return values.length === 0 ? [] : [withEnumValues(option, values)];
    }),
  };
}

function withEnumValues(
  option: EnumOptionDefinition,
  values: readonly string[],
): EnumOptionDefinition {
  if (option.defaultValue !== undefined && values.includes(option.defaultValue)) {
    return { ...option, values };
  }
  const { defaultValue: _defaultValue, ...withoutDefault } = option;
  return { ...withoutDefault, values };
}

function matches(model: ModelDescriptor, reference: string): boolean {
  return model.key === reference || model.id === reference;
}

function policyDiagnostics(
  catalogs: readonly ModelCatalog[],
  policy: ModelPolicy,
): readonly ModelPolicyDiagnostic[] {
  const models = catalogs.flatMap((catalog) => catalog.models);
  const options = models.flatMap((model) => model.options);
  const diagnostics: ModelPolicyDiagnostic[] = [];
  for (const [index, reference] of (policy.models?.include ?? []).entries()) {
    if (findModel(catalogs, reference) === undefined) {
      diagnostics.push({
        kind: "model",
        path: `models.include[${index}]`,
        message: `No model matches ${reference}.`,
      });
    }
  }
  for (const [index, recommendation] of (policy.models?.recommendations ?? []).entries()) {
    if (findModel(catalogs, recommendation.model) === undefined) {
      diagnostics.push({
        kind: "recommendation",
        path: `models.recommendations[${index}].model`,
        message: `No model matches ${recommendation.model}.`,
      });
    }
  }
  for (const [key, values] of Object.entries(policy.options?.values ?? {})) {
    const definitions = options.filter((option) => option.key === key);
    if (definitions.length === 0) {
      diagnostics.push({
        kind: "option-key",
        path: `options.values.${key}`,
        message: `No option matches ${key}.`,
      });
      continue;
    }
    for (const value of values) {
      if (
        !definitions.some(
          (definition) => definition.kind === "enum" && definition.values.includes(value),
        )
      ) {
        diagnostics.push({
          kind: "option-value",
          path: `options.values.${key}`,
          message: `No ${key} option accepts ${value}.`,
        });
      }
    }
  }
  for (const [key, value] of Object.entries(policy.options?.defaults ?? {})) {
    const definitions = options.filter((option) => option.key === key);
    if (
      definitions.length === 0 ||
      !definitions.some((definition) => validateOptions([definition], { [key]: value }).ok)
    ) {
      diagnostics.push({
        kind: "default",
        path: `options.defaults.${key}`,
        message: `No ${key} option accepts this default.`,
      });
    }
  }
  return diagnostics;
}

function reconcileConstraints(
  model: ModelDescriptor,
  values: Record<string, string | number | boolean | readonly string[]>,
): void {
  for (const constraint of model.constraints ?? []) {
    if (constraint.kind === "less-than") {
      const left = values[constraint.leftKey];
      const right = values[constraint.rightKey];
      if (typeof left === "number" && typeof right === "number" && left >= right) {
        delete values[constraint.leftKey];
      }
      continue;
    }
    if (values[constraint.when.key] !== constraint.when.equals) continue;
    if (constraint.kind === "requires" && values[constraint.key] === undefined) {
      delete values[constraint.when.key];
    }
    if (constraint.kind === "forbids" && values[constraint.key] !== undefined) {
      delete values[constraint.key];
    }
  }
}
