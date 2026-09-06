# Security policy

## Report a vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability
reporting at https://github.com/axel-rock/models/security/advisories/new.
Do not open a public issue with exploit details,
credentials, or account-scoped provider data.

## Supported versions

Security fixes target the latest published version of `@axelrock/models` and
the latest commit on `main`. Upgrade to the latest release to receive fixes.
Older releases do not receive separate security backports.

## Credential boundary

Direct-provider discovery runs on a trusted server. Browser components accept
catalog data and never need provider credentials. Error messages and catalog
provenance must not include API keys, signed URLs, or authorization headers.
