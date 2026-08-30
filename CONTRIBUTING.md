# Contributing

Thank you for helping make Models more accurate and useful.

## Before a change

Open an issue for a new provider, public API change, or new normalized option.
Small fixes can go directly to a pull request.

A provider change must identify which fact comes from a live API, official
documentation, a generated snapshot, or an explicit user override. Do not turn
an inference into a confirmed capability.

## Local checks

Use Node 22 or newer and pnpm 10.

```sh
pnpm install
pnpm check
```

Tests are colocated as `*.spec.ts`. Add a fixture for network-shape changes and
a compile-time assertion when a public type changes.

For UI changes, also run `pnpm dev` and test keyboard navigation, a narrow
screen, and a no-model state.

## Catalog updates

Run `pnpm catalog:check` to inspect public gateway drift. If the change is valid,
run `pnpm catalog:refresh`, review both the normalized snapshot and generated
model-ID types, and explain material additions, removals, price changes, or
capability changes in the pull request.

Never commit provider keys or account-scoped raw responses.

## Changesets

Add a changeset for any change that affects a published package. Use patch for
compatible fixes, minor for compatible features, and major for breaking public
API changes.
