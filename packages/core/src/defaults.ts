import type { CapabilitySupport, ModelCapabilities, SourceReference } from "./types.ts";

/** Create a capability statement without hiding its evidence. */
export function capability(
  status: CapabilitySupport["status"],
  evidence: readonly SourceReference[] = [],
  note?: string,
): CapabilitySupport {
  return {
    status,
    evidence,
    ...(note === undefined ? {} : { note }),
  };
}

/** Create an unknown capability set for sparse provider catalogs. */
export function unknownCapabilities(): ModelCapabilities {
  const unknown = capability("unknown");
  return {
    input: {},
    output: {},
    reasoning: unknown,
    tools: unknown,
    structuredOutput: unknown,
    promptCaching: unknown,
  };
}
