export { anthropicAdapter } from "./anthropic.ts";
export { googleAdapter } from "./google.ts";
export { knownOpenRouterModelIds, knownVercelModelIds } from "./generated/modelIds.ts";
export type {
  KnownGatewayModelId,
  KnownGatewayModelKey,
  KnownGatewayOptionValues,
  KnownGatewayOptionValuesByKey,
  KnownOpenRouterModelId,
  KnownVercelModelId,
} from "./generated/modelIds.ts";
export { openAiAdapter } from "./openai.ts";
export { openRouterAdapter } from "./openrouter.ts";
export { selectKnownGatewayModel } from "./known.ts";
export type { KnownGatewayModel, KnownGatewaySelection } from "./known.ts";
export {
  anthropicConstraints,
  anthropicOptions,
  googleOptions,
  openAiOptions,
  openRouterOptions,
  optionSources,
  vercelGatewayOptions,
} from "./options.ts";
export { ProviderDiscoveryError } from "./shared.ts";
export { vercelGatewayAdapter } from "./vercel.ts";

import type { ProviderAdapter } from "@models/core";
import { anthropicAdapter } from "./anthropic.ts";
import { googleAdapter } from "./google.ts";
import { openAiAdapter } from "./openai.ts";
import { openRouterAdapter } from "./openrouter.ts";
import { vercelGatewayAdapter } from "./vercel.ts";

/** All first-party provider adapters in stable display order. */
export const providerAdapters: readonly ProviderAdapter[] = [
  vercelGatewayAdapter,
  openRouterAdapter,
  openAiAdapter,
  anthropicAdapter,
  googleAdapter,
];
