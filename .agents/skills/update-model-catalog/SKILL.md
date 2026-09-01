---
name: update-model-catalog
description: Audit and update provider model catalogs, request options, prices, beta contracts, and generated types in the Models repository when provider APIs, official documentation, or AI SDK types change.
---

# Update the model catalog

Use deterministic evidence first. Run `pnpm catalog:check` and read
`docs/maintenance.md`. If the check reports structural drift, inspect
`catalog/schema-inventory.json` before changing an adapter.

Read only official provider documentation and the installed AI SDK provider
source. Use `docs/provider-audit.md` to route to the relevant sources and known
open gaps. Never infer support from a model name when a live field, route record,
official model page, or installed provider type can establish it.

Classify each change as identity, capability, route, option, price, policy,
deprecation, or documentation-only. Preserve conflicts between live APIs and
documentation as explicit evidence. Do not silently choose the more convenient
source.

For an accepted change:

1. Update the network boundary schema and preserve unknown raw fields.
2. Update normalized facts, exact request targets, evidence, and constraints.
3. Add a fixture for each changed behavior. Every selectable value must change
   the mapped request or produce an explicit warning.
4. Run `pnpm catalog:refresh` only after reviewing the drift. Never commit an
   authenticated or account-filtered response.
5. Review generated IDs and option types, then run `pnpm check`.
6. Report the provider behavior, source, compatibility risk, and generated
   changes in plain language.

Do not automatically accept documentation hashes, publish packages, make the
repository public, or treat a gateway-wide model row as proof that every route
supports the same feature. Route-specific options must identify or pin the
serving route. Mutable aliases must not be presented as fixed snapshots.
