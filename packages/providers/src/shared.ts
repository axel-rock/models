import type { DiscoveryContext, SourceReference } from "@models/core";

/** A safe provider discovery failure with the response status when available. */
export class ProviderDiscoveryError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderDiscoveryError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}

/** Fetch and parse one provider response without exposing credentials in errors. */
export async function fetchProviderJson(
  url: string,
  context: DiscoveryContext,
  headers: Readonly<Record<string, string>> = {},
): Promise<{ readonly value: unknown; readonly fetchedAt: string }> {
  const fetchImplementation = context.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      headers,
      ...(context.signal === undefined ? {} : { signal: context.signal }),
    });
  } catch {
    throw new ProviderDiscoveryError("The provider catalog could not be reached.");
  }

  if (!response.ok) {
    throw new ProviderDiscoveryError(
      `The provider catalog returned HTTP ${response.status}.`,
      response.status,
    );
  }

  try {
    return { value: await response.json(), fetchedAt: new Date().toISOString() };
  } catch {
    throw new ProviderDiscoveryError(
      "The provider catalog returned invalid JSON.",
      response.status,
    );
  }
}

/** Require a server-side provider credential for authenticated discovery. */
export function requireApiKey(context: DiscoveryContext, providerName: string): string {
  if (context.apiKey === undefined || context.apiKey.length === 0) {
    throw new ProviderDiscoveryError(
      `${providerName} model discovery requires a server-side API key.`,
    );
  }
  return context.apiKey;
}

/** Create a dated official-document source. */
export function docsSource(
  url: string,
  scope: SourceReference["scope"] = "provider",
): SourceReference {
  return {
    kind: "provider-docs",
    url,
    retrievedAt: "2026-08-31T00:00:00.000Z",
    scope,
  };
}
