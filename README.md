# Models

Models is a framework-neutral TypeScript library for discovering AI models,
showing what each model supports, selecting its options, and turning the
selection into an exact provider request.

It starts with OpenRouter, Vercel AI Gateway, OpenAI, Anthropic, and Google AI.
Groq is intentionally not included.

The repository is private while its public API settles. The packages have not
been published.

## Why this exists

Model names are the easy part. Reasoning effort, fast or flex service, cache
rules, beta contracts, route-specific prices when the source exposes them, and account-specific access are
where selectors become unreliable.

Models keeps those facts explicit:

- live discovery for provider model-list endpoints;
- `supported`, `unsupported`, or `unknown` instead of guessed booleans;
- dated source evidence on capabilities and decimal-string prices;
- literal TypeScript option values for known models;
- runtime validation for newly discovered models;
- provider-specific mappings without flattening away their meaning;
- native custom elements, with no React dependency;
- deterministic snapshots and a scheduled drift check.

## Packages

| Package             | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `@models/core`      | Catalog, evidence, option, validation, price, and drift primitives  |
| `@models/providers` | Five first-party discovery adapters and generated gateway model IDs |
| `@models/elements`  | Explicitly registered native custom elements                        |
| `@models/ai-sdk`    | Optional bridge for AI SDK model factories and provider options     |
| `@models/gallery`   | The example browser, not a published package                        |

## Discover models

Gateway discovery needs no key:

```ts
import { openRouterAdapter, vercelGatewayAdapter } from "@models/providers";

const [openRouter, gateway] = await Promise.all([
  openRouterAdapter.discover(),
  vercelGatewayAdapter.discover(),
]);
```

Direct providers need server-side credentials because their list endpoints are
authenticated:

```ts
import { anthropicAdapter } from "@models/providers";

const catalog = await anthropicAdapter.discover({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

Never pass provider keys to browser components. Fetch a catalog on your server,
then send only the catalog fields your browser needs.

## Select and map options

```ts
import { selectModel } from "@models/core";
import { openAiAdapter } from "@models/providers";

const catalog = await openAiAdapter.discover({ apiKey: process.env.OPENAI_API_KEY });
const model = catalog.models.find((item) => item.id === "gpt-5.6-luna");

if (model) {
  const selection = selectModel(model, {
    "reasoning.effort": "high",
    "service.tier": "flex",
  });
  const request = openAiAdapter.mapOptions(selection.model, selection.options);
}
```

Generated `KnownVercelModelId` and `KnownOpenRouterModelId` unions describe the
reviewed snapshots. `selectKnownGatewayModel(catalogs, key, options)` connects a
reviewed provider-qualified key to its exact generated option type. Live IDs
can be newer, so discovered records still use runtime validation.

A catalog entry whose provider ID includes `fast` is a distinct model or route.
A `speed.mode` or `service.tier` control is a runtime option on one model. The
library preserves that difference and never invents one from the other.

The optional AI SDK bridge returns `callOptions` that can be spread directly:

```ts
const prepared = prepareAiSdkCall(adapter, selection, provider);
const result = await generateText({
  model: prepared.model,
  ...prepared.callOptions,
  prompt: "Hello",
});
```

## Use the UI without a framework

```ts
import { defineModelsElements } from "@models/elements";

defineModelsElements();

const picker = document.querySelector("models-picker");
picker.catalogs = [catalog];
picker.groups = ["reasoning", "speed", "caching"];
picker.groupBy = "author"; // Optional for multi-provider gateways.
picker.addEventListener("models-selection-change", (event) => {
  console.log(event.detail);
});
```

`models-options-change` emits every option draft so a host can save work in
progress. `models-selection-change` emits only after all option and cross-field
rules pass.

Use `<models-select>` for a compact branded combobox, `<models-options>` for a
detail panel, `<models-composer>` for progressive disclosure, `<models-price>`
for cost context, or `<models-picker>` for the complete inspector. CSS custom
properties and `::part()` hooks provide styling without making the package
framework-specific.

### Curate an application model list

Use exact provider model IDs or provider-qualified keys to keep the available
set explicit and easy to review in code.

```ts
import {
  defineModelPolicy,
  defineModelPolicyFor,
  findLowestPricedModel,
  resolveModelPolicy,
  resolvePolicyDefaults,
} from "@models/core";

const policy = defineModelPolicy({
  models: {
    include: ["anthropic/claude-opus-5", "openai/gpt-5.6-sol", "moonshotai/kimi-k3"],
  },
  options: {
    groups: ["reasoning", "speed", "routing"],
    values: {
      "reasoning.effort": ["low", "medium", "high"],
      "service.tier": ["default", "flex", "fast"],
      "speed.mode": ["standard", "fast"],
    },
    defaults: {
      "reasoning.effort": "medium",
      "service.tier": "default",
      "speed.mode": "standard",
    },
  },
});
const curated = resolveModelPolicy(catalogs, policy);
const lowestInput = findLowestPricedModel(curated.catalogs, "input-token");

selector.catalogs = curated.catalogs;
composer.catalogs = curated.catalogs;
composer.groups = curated.groups;
const defaults = selectedModel && resolvePolicyDefaults(selectedModel, curated);
selector.recommendations = [
  {
    model: "anthropic/claude-opus-5",
    label: "Recommended for this app",
  },
  ...(lowestInput === undefined
    ? []
    : [{ model: lowestInput.key, label: "Lowest listed input price" }]),
];

if (curated.diagnostics.length > 0) {
  console.warn(curated.diagnostics);
}
```

Use `defineModelPolicyFor(generatedCatalogs, policy)` when catalog model IDs and
options are known at build time. It rejects misspelled IDs, option keys, values,
and defaults in TypeScript. Live runtime catalogs use `defineModelPolicy` plus
the resolver diagnostics shown above.

The input-price helper compares only unconditional model-level rates for the
requested unit. It does not guess route prices, conditional tiers, or a blended
workload, so the UI never presents a broad `Cheapest` claim without evidence.

Model curation and option visibility are separate axes. Resolve one policy,
then pass the same result to each presentation:

```ts
minimal.catalogs = curated.catalogs;
inline.catalogs = curated.catalogs;
inlineOptions.groups = curated.groups;
composer.catalogs = curated.catalogs;
composer.groups = curated.groups;
```

Curated enum values are intersected with each model's evidence-backed values.
Curated defaults are app-owned initial values, not changes to provider facts.
An empty value intersection removes that option, and runtime validation rejects
a value excluded by the application policy. Diagnostics report model IDs,
option keys, values, defaults, and recommendations that do not match the supplied
catalogs, so dynamic policies do not fail silently.

## Run the gallery

```sh
pnpm install
pnpm dev
```

The gallery presents Minimal, Inline, Composer, and Inspector shapes in one
tabbed surface. A shared policy controls approved models and optional detail
groups across every shape. Catalog-source controls and evidence stay in a
separate developer disclosure. The page loads public gateway catalogs live and
uses documented demo records for direct providers, so no credential can enter
the browser.

## Detect catalog changes

```sh
pnpm catalog:check
pnpm catalog:refresh
pnpm catalog:audit
```

`catalog:check` compares current public gateway responses with reviewed
snapshots and fingerprints the official documents behind option overlays.
`catalog:refresh` updates both records and the generated model and option types.
It does not publish or merge anything. Direct-provider option overlays are
reviewed from official documentation because their availability can depend on
the account, endpoint, model, and region.

`catalog:audit` also compares raw public response shapes and live enums. It
catches new provider fields that the normalized adapter does not understand
yet. Use the repository `update-model-catalog` skill to review a reported
change; scripts detect facts, while the skill guides the human-reviewed update.

See [architecture](docs/architecture.md), [provider coverage](docs/providers.md),
and [maintenance](docs/maintenance.md) for the boundaries behind these choices.

## Contributing

Node 22 or newer and pnpm 10 are required. Run `pnpm check` before opening a
pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md).

## License

MIT
