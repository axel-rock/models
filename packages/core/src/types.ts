/** Providers maintained by the first-party adapter package. */
export type KnownProviderId = "anthropic" | "google" | "openai" | "openrouter" | "vercel";

/** A known provider id or an id supplied by a third-party adapter. */
export type ProviderId = KnownProviderId | (string & Record<never, never>);

/** The origin of a catalog fact. */
export type EvidenceKind = "live-api" | "provider-docs" | "generated-snapshot" | "user-override";

/** A dated source for one or more catalog facts. */
export interface SourceReference {
  readonly kind: EvidenceKind;
  readonly url: string;
  readonly retrievedAt: string;
  readonly digest?: string;
  readonly scope?: "account" | "endpoint" | "model" | "provider" | "region";
}

/** How strongly a source establishes a fact. */
export type EvidenceConfidence = "provider-confirmed" | "provider-documented" | "inferred";

/** A value with explicit provenance. */
export interface Evidence<T> {
  readonly value: T;
  readonly confidence: EvidenceConfidence;
  readonly sources: readonly SourceReference[];
}

/** Whether a provider or model supports a capability. */
export type SupportStatus = "supported" | "unsupported" | "unknown";

/** An evidence-backed capability statement. */
export interface CapabilitySupport {
  readonly status: SupportStatus;
  readonly evidence: readonly SourceReference[];
  readonly note?: string;
}

/** Input and output media understood by model catalogs. */
export type Modality = "audio" | "file" | "image" | "text" | "video";

/** Capabilities that are useful when selecting a language model. */
export interface ModelCapabilities {
  readonly input: Readonly<Partial<Record<Modality, CapabilitySupport>>>;
  readonly output: Readonly<Partial<Record<Modality, CapabilitySupport>>>;
  readonly reasoning: CapabilitySupport;
  readonly tools: CapabilitySupport;
  readonly structuredOutput: CapabilitySupport;
  readonly promptCaching: CapabilitySupport;
}

/** The unit billed by a provider. */
export type PriceUnit =
  | "cache-read-token"
  | "cache-write-token"
  | "image"
  | "input-token"
  | "output-token"
  | "request"
  | "second";

/** One dated price for a model and optional condition. */
export interface PriceRate {
  readonly unit: PriceUnit;
  readonly usd: string;
  readonly per: number;
  readonly condition?: string;
  readonly evidence: readonly SourceReference[];
}

/** A model lifecycle label, when the source provides one. */
export type ModelLifecycle = "deprecated" | "preview" | "production" | "unknown";

/** The broad product kind exposed by a provider model record. */
export type ModelKind = "audio" | "embedding" | "image" | "language" | "system" | "video";

/** A provider-neutral family of model options that a host can choose to expose. */
export type OptionGroup = "beta" | "caching" | "generation" | "reasoning" | "routing" | "speed";

/** A gateway route or hosting endpoint that can materially change behavior. */
export interface ModelRoute {
  readonly id: string;
  readonly provider?: string;
  readonly region?: string;
  readonly dataPolicy?: string;
  readonly capabilities?: Partial<ModelCapabilities>;
  readonly prices: readonly PriceRate[];
  readonly sources: readonly SourceReference[];
  readonly raw?: unknown;
}

/** A capability that needs application work beyond a selector value. */
export interface IntegrationRequirement {
  readonly id: string;
  readonly kind: "beta-contract" | "content-annotation" | "response-handling" | "server-only";
  readonly title: string;
  readonly description: string;
  readonly support: CapabilitySupport;
  readonly sources: readonly SourceReference[];
}

/** An API surface through which a model can be called. */
export type ModelInterface =
  | "anthropic-messages"
  | "google-generate-content"
  | "google-interactions"
  | "openai-chat-completions"
  | "openai-responses";

/** A complete, evidence-backed model descriptor. */
export interface ModelDescriptor<
  TProvider extends ProviderId = ProviderId,
  TOptions extends readonly OptionDefinition[] = readonly OptionDefinition[],
> {
  readonly key: `${TProvider}:${string}`;
  readonly provider: TProvider;
  readonly id: string;
  readonly name: string;
  readonly kind: ModelKind;
  readonly author?: string;
  readonly description?: string;
  readonly lifecycle: ModelLifecycle;
  readonly releasedAt?: string;
  readonly contextWindow?: Evidence<number>;
  readonly maxOutputTokens?: Evidence<number>;
  readonly capabilities: ModelCapabilities;
  readonly interfaces: readonly ModelInterface[];
  readonly prices: readonly PriceRate[];
  readonly routes: readonly ModelRoute[];
  readonly options: TOptions;
  readonly constraints?: readonly SelectionConstraint[];
  readonly requirements: readonly IntegrationRequirement[];
  readonly sources: readonly SourceReference[];
  readonly raw?: unknown;
}

/** A provider model-list result with freshness and raw-source evidence. */
export interface ModelCatalog<
  TProvider extends ProviderId = ProviderId,
  TModel extends ModelDescriptor<TProvider> = ModelDescriptor<TProvider>,
> {
  readonly schemaVersion: 1;
  readonly provider: TProvider;
  readonly fetchedAt: string;
  readonly source: SourceReference;
  readonly models: readonly TModel[];
}

/** Credentials and dependencies supplied to model discovery. */
export interface DiscoveryContext {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly signal?: AbortSignal;
}

/** A provider adapter that discovers models and maps selected options. */
export interface ProviderAdapter<
  TProvider extends ProviderId = ProviderId,
  TModel extends ModelDescriptor<TProvider> = ModelDescriptor<TProvider>,
> {
  readonly id: TProvider;
  readonly name: string;
  readonly catalogEndpoint: string;
  readonly requiresAuthentication: boolean;
  discover(context?: DiscoveryContext): Promise<ModelCatalog<TProvider, TModel>>;
  mapOptions(model: TModel, values: OptionValues<TModel["options"]>): MappedModelOptions;
}

/** Provider request options produced from a model selection. */
export interface MappedModelOptions {
  readonly providerOptions: Readonly<Record<string, unknown>>;
  readonly requestOptions: Readonly<Record<string, unknown>>;
  readonly warnings: readonly string[];
}

/** Shared fields for every selectable option. */
export interface OptionDefinitionBase<TKey extends string = string, TKind extends string = string> {
  readonly key: TKey;
  readonly kind: TKind;
  readonly label: string;
  readonly description: string;
  readonly group: OptionGroup;
  readonly support: CapabilitySupport;
  readonly target?: OptionTarget;
  readonly visibleWhen?: OptionCondition;
}

/** A condition that controls whether an option is relevant. */
export interface OptionCondition {
  readonly key: string;
  readonly equals: string | number | boolean;
}

/** A serializable cross-field rule checked against the complete selection. */
export type SelectionConstraint =
  | {
      readonly kind: "requires";
      readonly when: OptionCondition;
      readonly key: string;
      readonly message: string;
    }
  | {
      readonly kind: "forbids";
      readonly when: OptionCondition;
      readonly key: string;
      readonly message: string;
    }
  | {
      readonly kind: "less-than";
      readonly leftKey: string;
      readonly rightKey: string;
      readonly message: string;
    };

/** The exact destination for an option in an integration request. */
export interface OptionTarget {
  readonly kind: "provider-option" | "request-option";
  readonly namespace?: string;
  readonly path: readonly string[];
}

/** A selectable string-valued option. */
export interface EnumOptionDefinition<
  TKey extends string = string,
  TValues extends readonly string[] = readonly string[],
> extends OptionDefinitionBase<TKey, "enum"> {
  readonly values: TValues;
  readonly defaultValue?: TValues[number];
}

/** A selectable boolean option. */
export interface BooleanOptionDefinition<TKey extends string = string> extends OptionDefinitionBase<
  TKey,
  "boolean"
> {
  readonly defaultValue?: boolean;
}

/** A selectable numeric option. */
export interface NumberOptionDefinition<
  TKey extends string = string,
  TKind extends "integer" | "number" = "integer" | "number",
> extends OptionDefinitionBase<TKey, TKind> {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly defaultValue?: number;
}

/** A string-list option, useful for opt-in beta identifiers. */
export interface StringListOptionDefinition<
  TKey extends string = string,
> extends OptionDefinitionBase<TKey, "string-list"> {
  readonly suggestions?: readonly string[];
  readonly defaultValue?: readonly string[];
}

/** Any option definition understood by the core and UI packages. */
export type OptionDefinition =
  | BooleanOptionDefinition
  | EnumOptionDefinition
  | NumberOptionDefinition
  | StringListOptionDefinition;

/** The value accepted by one option definition. */
export type OptionValue<TDefinition extends OptionDefinition> =
  TDefinition extends EnumOptionDefinition<string, infer TValues>
    ? TValues[number]
    : TDefinition extends BooleanOptionDefinition
      ? boolean
      : TDefinition extends NumberOptionDefinition
        ? number
        : TDefinition extends StringListOptionDefinition
          ? readonly string[]
          : never;

/** Option values inferred from a literal option-definition tuple. */
export type OptionValues<TDefinitions extends readonly OptionDefinition[]> = Partial<{
  [TDefinition in TDefinitions[number] as TDefinition["key"]]: OptionValue<TDefinition>;
}>;

/** A model and its validated option values. */
export interface ModelSelection<TModel extends ModelDescriptor = ModelDescriptor> {
  readonly model: TModel;
  readonly options: OptionValues<TModel["options"]>;
}

/** One validation problem for a selected option. */
export interface OptionValidationIssue {
  readonly key: string;
  readonly message: string;
}

/** The result of validating dynamic option values. */
export type OptionValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly OptionValidationIssue[] };
