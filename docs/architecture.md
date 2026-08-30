# Architecture

Models has four layers.

1. `@models/core` owns provider-neutral data and validation. It has no network,
   DOM, framework, or AI SDK dependency.
2. `@models/providers` translates provider model-list responses into the core
   catalog and maps selected options back to exact request paths.
3. `@models/elements` renders core data with native custom elements. Element
   registration is explicit and safe to call more than once.
4. Integration packages such as `@models/ai-sdk` adapt a validated selection to
   another library without changing the core.

## Two kinds of type safety

Reviewed snapshots produce literal gateway model-ID unions and literal option
definitions produce exact option-value unions. These are compile-time facts.

Live discovery can return a model added after the package release. Those values
cannot honestly be a closed TypeScript union, so the same option definitions
are checked at runtime before mapping. The library does not cast a changing
network response into a timeless type.

## Evidence, not one capability boolean

A capability has a status, evidence, and optional note. Evidence records its
source kind, URL, retrieval time, confidence, and scope. Scope matters because
a gateway route, account entitlement, endpoint, or region can change what a
model supports.

Unknown is a valid result. It means the source did not establish the fact.

## Options and requirements

Reasoning effort, thinking mode, speed mode, service tier, routing, caching,
and beta features remain separate. An option is a serializable selector value.
An integration requirement explains work that a selector cannot perform, such
as adding prompt-cache breakpoints or handling a beta response shape.

Cross-field constraints validate the complete selection. Provider adapters own
special mappings where a flat normalized key is not enough.

## Prices

Prices use decimal strings plus an explicit unit and denominator. This avoids
binary floating-point drift and preserves the provider's published precision.
Conditions and evidence stay beside each rate. Route-specific prices do not
silently replace model-level prices.
