# Maintenance

## Public gateway drift

The daily GitHub workflow runs `pnpm catalog:check`. It fetches OpenRouter and
Vercel AI Gateway, normalizes their responses, and compares them with reviewed
snapshots. A changed exit status creates a visible failed run. It never commits,
publishes, or updates the baseline automatically.

To accept a change:

1. Run `pnpm catalog:check` and inspect additions, removals, changed fields, and
   parsing failures.
2. Read the provider's official change or model documentation when semantics
   changed.
3. Run `pnpm catalog:refresh`.
4. Review the snapshots and `packages/providers/src/generated/modelIds.ts`.
5. Run `pnpm check` and open a pull request that explains material drift.

## Direct providers

Authenticated lists are tested with deterministic fixtures in pull requests.
Their option overlays use dated official documentation sources. A maintainer
with an eligible test account can run a separate live check locally, but no
secret or account-scoped response belongs in git or CI logs.

## Dependency updates

Dependabot opens weekly grouped patch and minor updates. Major updates stay
separate for deliberate review. CI is deterministic and does not call provider
APIs for ordinary pull requests.
