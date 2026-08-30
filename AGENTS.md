# Models contributor guide

Models is a standalone, provider-neutral TypeScript library. It has no Orage
dependency.

## Product rules

- Discover the provider's live model list when an endpoint exists.
- Never present inferred capabilities as provider-confirmed facts.
- Keep raw provider data and its fetch time beside normalized data.
- Separate runtime discovery from generated compile-time snapshots.
- Preserve provider-specific options. A normalized control must map back to an
  exact provider request without losing meaning.
- Prices are dated evidence, not timeless constants.
- UI packages consume the same public API that external projects use.

## Code rules

- TypeScript in strict mode.
- Public exports have concise JSDoc.
- Use discriminated unions and runtime validation at network boundaries.
- Tests live beside the code they protect.
- Do not commit secrets or real provider responses that contain account data.
- Do not publish packages, make the repository public, deploy, or spend money
  without Axel's explicit approval.

## Verification

Run `pnpm check` before a release-ready handoff. Browser-visible changes also
need a complete keyboard and narrow-screen pass.
