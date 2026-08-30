# Provider coverage

| Provider          | Discovery                  | Authentication | Catalog detail                                  | Maintained options                                                      |
| ----------------- | -------------------------- | -------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Vercel AI Gateway | Live `/v1/models`          | No             | Rich prices, limits, tags                       | Gateway caching plus upstream provider controls                         |
| OpenRouter        | Live `/api/v1/models`      | No             | Rich architecture, parameters, prices           | Normalized reasoning controls                                           |
| OpenAI            | Live `/v1/models`          | Yes            | Identity and ownership                          | Reasoning effort and service tier for recognized families               |
| Anthropic         | Paginated `/v1/models`     | Yes            | Identity plus account-visible capability fields | Effort, thinking, cache lifetime, beta features, and eligible fast mode |
| Google AI         | Paginated `/v1beta/models` | Yes            | Limits and supported actions                    | Thinking controls and service tier                                      |

Discovery answers which records an endpoint or account exposes. It does not by
itself prove that every API feature works for every route. Dated official-doc
overlays add controls only where the provider documents them, and support notes
retain entitlement or endpoint limits.

The library preserves unknown response fields under `raw` for forward
compatibility. Public snapshots remove raw data and repeated evidence to stay
reviewable and avoid account data.
