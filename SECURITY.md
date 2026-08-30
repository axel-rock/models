# Security policy

## Report a vulnerability

Please report vulnerabilities privately through GitHub's private vulnerability
reporting for this repository. Do not open a public issue with exploit details,
credentials, or account-scoped provider data.

## Supported versions

The project is not published yet. Security fixes currently target the latest
commit on `main`.

## Credential boundary

Direct-provider discovery runs on a trusted server. Browser components accept
catalog data and never need provider credentials. Error messages and catalog
provenance must not include API keys, signed URLs, or authorization headers.
