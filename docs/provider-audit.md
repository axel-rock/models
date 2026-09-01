# Provider audit

This file records the highest-value gaps found in the 2026-09-01 review. It is
a work queue, not provider truth. Recheck each linked official source before a
change.

## Shared design gaps

- A gateway model row is a capability superset. Exact prices and supported
  parameters can differ by serving route.
- Provider-specific options need route applicability. A creator prefix does
  not prove which provider serves a gateway request.
- Known beta identifiers need literal unions plus an explicit custom escape
  hatch. Arbitrary strings alone are autocomplete, not type safety.
- Generated option types cover gateway snapshots but not direct-provider
  overlays. AI SDK mappings currently widen provider options to generic JSON.
- Conditional prices, aliases, requested versus effective service tiers, and
  source conflicts need first-class representations.

## Vercel AI Gateway

- Route data is served by the per-model endpoints API, not inline in the model
  list. The current adapter therefore has no live route detail.
- Portable Gateway fast mode uses `gateway.speed` and
  `gateway.allowFallbackFromFast`. It is not the same as an Anthropic beta or a
  separate `-fast` model slug.
- Portable service tiers use `gateway.serviceTier`. Actual applied tier is
  response metadata and can differ from the request.
- The catalog exposes more task kinds, policy fields, price dimensions, and
  cache semantics than the core currently represents.

Official sources: [REST API](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api),
[reasoning](https://vercel.com/docs/ai-gateway/models-and-providers/reasoning),
[fast mode](https://vercel.com/docs/ai-gateway/models-and-providers/fast-mode),
[service tiers](https://vercel.com/docs/ai-gateway/models-and-providers/service-tiers),
[automatic caching](https://vercel.com/docs/ai-gateway/models-and-providers/automatic-caching),
and [batch](https://vercel.com/docs/ai-gateway/models-and-providers/batch-processing).

## OpenRouter

- Discovery must request `output_modalities=all`. The bare model endpoint omits
  non-text models.
- Exact route facts live behind each model's endpoint-detail link and should be
  hydrated lazily.
- Response caching, prompt caching, routing, service tiers, provider headers,
  and model variants are separate concepts.
- Strict structured output requires more than generic `response_format`
  support. Route requirements and the documented Anthropic beta header matter.
- Prices can have ordered conditional overrides. Response usage is the source
  of truth for actual cost.

Official sources: [model catalog](https://openrouter.ai/docs/guides/overview/models),
[endpoint details](https://openrouter.ai/docs/api/api-reference/endpoints/list-all-endpoints-for-a-model),
[provider routing](https://openrouter.ai/docs/guides/routing/provider-selection),
[service tiers](https://openrouter.ai/docs/guides/features/service-tiers),
[structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
and [API versioning](https://openrouter.ai/docs/api_reference/versioning).

## OpenAI

- The model-list endpoint provides identity, not option, price, modality, or
  interface truth. Reviewed model-page overlays are required.
- Reasoning effort values differ by exact model. GPT-5 Pro, GPT-5, and GPT-5.6
  do not share one enum.
- GPT-5.6 Pro is a reasoning mode on one model, not a second model ID.
- Prompt caching, reasoning context, service tiers, aliases, pinned snapshots,
  and endpoint support need explicit overlays.

Official sources: [Models API](https://platform.openai.com/docs/api-reference/models/object),
[GPT-5](https://developers.openai.com/api/docs/models/gpt-5),
[GPT-5 Pro](https://developers.openai.com/api/docs/models/gpt-5-pro), and
[latest-model guidance](https://developers.openai.com/api/docs/guides/latest-model).

## Anthropic

- Live model capabilities include exact limits, media inputs, structured
  output, effort, thinking, and context management. The adapter maps only a
  subset.
- A live capability can conflict with a newer behavioral guide. Claude 4.7 and
  later reject manual `thinking.type: enabled`; corrective overlays must retain
  both sources and apply explicit precedence.
- Top-level automatic caching is valid. Explicit content breakpoints are an
  optional advanced technique, not always a requirement.
- Known beta identifiers, model aliases versus snapshots, service tier,
  inference geography, and safe retry metadata need typed representations.

Official sources: [Models API](https://platform.claude.com/docs/en/api/models/list),
[extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking),
[prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
[fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode), and
[beta headers](https://platform.claude.com/docs/en/api/beta-headers).

## Recommended order

1. Stop silent option drops and incorrect price denominators.
2. Correct discovery coverage and live response schemas.
3. Add lazy route hydration for both gateways.
4. Separate portable, gateway, and route-specific option targets.
5. Generate direct-provider option and beta types checked against installed AI
   SDK provider types.
6. Expand constraints, conditional pricing, alias resolution, and effective
   response metadata.
