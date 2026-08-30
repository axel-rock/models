import {
  capability,
  defineOptions,
  type OptionDefinition,
  type SelectionConstraint,
  type SourceReference,
} from "@models/core";
import { docsSource } from "./shared.ts";

const OPENAI_RESPONSES = docsSource(
  "https://developers.openai.com/api/reference/resources/responses/methods/create",
  "provider",
);
const ANTHROPIC_EFFORT = docsSource(
  "https://platform.claude.com/docs/en/build-with-claude/effort",
  "provider",
);
const ANTHROPIC_THINKING = docsSource(
  "https://platform.claude.com/docs/en/build-with-claude/extended-thinking",
  "provider",
);
const ANTHROPIC_FAST = docsSource(
  "https://platform.claude.com/docs/en/build-with-claude/fast-mode",
  "model",
);
const ANTHROPIC_CACHE = docsSource(
  "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
  "provider",
);
const ANTHROPIC_BETA = docsSource(
  "https://platform.claude.com/docs/en/api/beta-headers",
  "provider",
);
const GOOGLE_THINKING = docsSource(
  "https://ai.google.dev/gemini-api/docs/generate-content/thinking?hl=en",
  "model",
);
const GOOGLE_TIERS = docsSource(
  "https://ai.google.dev/gemini-api/docs/optimization?hl=en",
  "provider",
);
const OPENROUTER_REASONING = docsSource(
  "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens",
  "endpoint",
);
const VERCEL_OPTIONS = docsSource(
  "https://vercel.com/docs/ai-gateway/models-and-providers/provider-options",
  "endpoint",
);

/** Current documented OpenAI request controls for recognized reasoning families. */
export function openAiOptions(modelId: string): readonly OptionDefinition[] {
  if (!/^(?:gpt-5|o[134])/.test(modelId)) {
    return [];
  }
  const efforts = modelId.startsWith("gpt-5.6")
    ? (["none", "low", "medium", "high", "xhigh", "max"] as const)
    : (["none", "low", "medium", "high", "xhigh"] as const);
  return defineOptions([
    {
      key: "reasoning.effort",
      kind: "enum",
      label: "Reasoning effort",
      description: "Controls how much work the model performs before answering.",
      group: "reasoning",
      support: capability("supported", [OPENAI_RESPONSES]),
      values: efforts,
      target: { kind: "provider-option", namespace: "openai", path: ["reasoningEffort"] },
    },
    {
      key: "service.tier",
      kind: "enum",
      label: "Service tier",
      description: "Chooses standard, lower-cost flex, or faster processing when available.",
      group: "speed",
      support: capability(
        "supported",
        [OPENAI_RESPONSES],
        "Account and model entitlement can narrow these values.",
      ),
      values: ["auto", "default", "flex", "fast", "priority"] as const,
      target: { kind: "provider-option", namespace: "openai", path: ["serviceTier"] },
    },
  ] as const);
}

/** Current Anthropic controls, narrowed by live model capabilities when provided. */
export function anthropicOptions(
  modelId: string,
  capabilities?: Record<string, unknown>,
): readonly OptionDefinition[] {
  const isDocumentedFamily = /claude-(?:fable|haiku|mythos|opus|sonnet)-(?:4-[5-9]|5)/.test(
    modelId,
  );
  if (!isDocumentedFamily && capabilities === undefined) {
    return [];
  }
  const effortValues =
    capabilities === undefined
      ? documentedAnthropicEffort(modelId)
      : supportedCapabilityKeys(capabilities["effort"] ?? capabilities["reasoning_effort"], [
          "low",
          "medium",
          "high",
          "xhigh",
          "max",
        ]);
  const thinkingModes =
    capabilities === undefined
      ? documentedAnthropicThinking(modelId)
      : supportedCapabilityKeys(asRecord(capabilities["thinking"])?.["types"], [
          "adaptive",
          "enabled",
        ]);
  const canDisable = !/(?:fable-5|mythos-5|mythos-preview)/.test(modelId);
  const options: OptionDefinition[] = [];
  if (effortValues.length > 0) {
    options.push({
      key: "reasoning.effort",
      kind: "enum",
      label: "Effort",
      description: "Controls total response work, including thinking and tool calls.",
      group: "reasoning",
      support: capability("supported", [ANTHROPIC_EFFORT]),
      values: effortValues,
      target: { kind: "provider-option", namespace: "anthropic", path: ["effort"] },
    });
  }
  if (thinkingModes.length > 0) {
    options.push({
      key: "reasoning.mode",
      kind: "enum",
      label: "Thinking",
      description: "Uses only the thinking modes supported by this model.",
      group: "reasoning",
      support: capability("supported", [ANTHROPIC_THINKING]),
      values: [...thinkingModes, ...(canDisable ? ["disabled"] : [])],
    });
  }
  if (thinkingModes.includes("enabled")) {
    options.push({
      key: "reasoning.budgetTokens",
      kind: "integer",
      label: "Thinking budget",
      description: "Maximum thinking tokens for manual extended thinking.",
      group: "reasoning",
      support: capability("supported", [ANTHROPIC_THINKING]),
      min: 1024,
      step: 1024,
      visibleWhen: { key: "reasoning.mode", equals: "enabled" },
    });
  }
  if (isDocumentedFamily || capabilities !== undefined) {
    options.push({
      key: "caching.ttl",
      kind: "enum",
      label: "Cache lifetime",
      description: "Marks content for Anthropic's ephemeral prompt cache.",
      group: "caching",
      support: capability("supported", [ANTHROPIC_CACHE]),
      values: ["5m", "1h"],
      target: { kind: "provider-option", namespace: "anthropic", path: ["cacheControl", "ttl"] },
    });
    options.push({
      key: "beta.features",
      kind: "string-list",
      label: "Beta features",
      description: "Advanced opt-ins that can change request or response contracts.",
      group: "beta",
      support: capability("supported", [ANTHROPIC_BETA]),
      suggestions: isAnthropicFastModel(modelId) ? ["fast-mode-2026-02-01"] : [],
      target: { kind: "provider-option", namespace: "anthropic", path: ["anthropicBeta"] },
    });
  }
  if (isAnthropicFastModel(modelId)) {
    options.push({
      key: "speed.mode",
      kind: "enum",
      label: "Speed",
      description: "Requests Anthropic fast mode when the account has access.",
      group: "speed",
      support: capability(
        "supported",
        [ANTHROPIC_FAST],
        "Requires account access and a beta contract.",
      ),
      values: ["standard", "fast"],
      target: { kind: "provider-option", namespace: "anthropic", path: ["speed"] },
    });
  }
  return options;
}

function documentedAnthropicEffort(modelId: string): readonly string[] {
  const values = ["low", "medium", "high"];
  if (/(?:fable-5|mythos-(?:5|preview)|opus-(?:5|4-[678])|sonnet-(?:5|4-6))/.test(modelId)) {
    values.push("max");
  }
  if (/(?:fable-5|mythos-5|opus-(?:5|4-[78])|sonnet-5)/.test(modelId)) {
    values.splice(3, 0, "xhigh");
  }
  return values;
}

function documentedAnthropicThinking(modelId: string): readonly string[] {
  return /(?:fable-5|mythos|opus-(?:5|4-[678])|sonnet-(?:5|4-6))/.test(modelId)
    ? ["adaptive"]
    : ["enabled"];
}

function isAnthropicFastModel(modelId: string): boolean {
  return /claude-opus-(?:5|4-8)(?:$|-)/.test(modelId);
}

function supportedCapabilityKeys(value: unknown, keys: readonly string[]): readonly string[] {
  const record = asRecord(value);
  return record === undefined
    ? []
    : keys.filter((key) => asRecord(record[key])?.["supported"] === true);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Cross-field rules for Anthropic thinking controls. */
export function anthropicConstraints(modelId: string): readonly SelectionConstraint[] {
  if (
    !/claude-(?:fable|haiku|opus|sonnet)-(?:4-[5-9]|5)/.test(modelId) ||
    /(?:sonnet-4-6|opus-4-[678]|opus-5|sonnet-5|fable-5|mythos)/.test(modelId)
  ) {
    return [];
  }
  return [
    {
      kind: "requires",
      when: { key: "reasoning.mode", equals: "enabled" },
      key: "reasoning.budgetTokens",
      message: "Manual thinking requires a token budget.",
    },
  ];
}

/** Current documented Google reasoning and service-tier controls. */
export function googleOptions(modelId: string): readonly OptionDefinition[] {
  const options: OptionDefinition[] = [];
  const levels = googleThinkingLevels(modelId);
  if (levels.length > 0) {
    options.push({
      key: "reasoning.level",
      kind: "enum",
      label: "Thinking level",
      description: "Balances latency and reasoning depth for Gemini 3 models.",
      group: "reasoning",
      support: capability("supported", [GOOGLE_THINKING]),
      values: levels,
      target: {
        kind: "provider-option",
        namespace: "google",
        path: ["thinkingConfig", "thinkingLevel"],
      },
    });
  } else {
    const range = googleThinkingBudgetRange(modelId);
    if (range !== undefined) {
      options.push({
        key: "reasoning.budgetTokens",
        kind: "integer",
        label: "Thinking budget",
        description: "Guides the number of thinking tokens for Gemini 2.5 models.",
        group: "reasoning",
        support: capability("supported", [GOOGLE_THINKING]),
        min: range.min,
        max: range.max,
        step: 1,
        target: {
          kind: "provider-option",
          namespace: "google",
          path: ["thinkingConfig", "thinkingBudget"],
        },
      });
    }
  }
  if (/^gemini-(?:3\.[5-7]|3-)/.test(modelId)) {
    options.push({
      key: "service.tier",
      kind: "enum",
      label: "Service tier",
      description: "Chooses standard, lower-cost flex, or priority inference.",
      group: "speed",
      support: capability(
        "supported",
        [GOOGLE_TIERS],
        "Availability depends on API surface and account.",
      ),
      values: ["standard", "flex", "priority"],
      target: { kind: "provider-option", namespace: "google", path: ["serviceTier"] },
    });
  }
  return options;
}

function googleThinkingLevels(modelId: string): readonly string[] {
  if (modelId.startsWith("gemini-3.7-flash")) return ["low", "medium", "high"];
  if (/^gemini-3\.(?:6|5)-flash(?!-lite)/.test(modelId)) {
    return ["minimal", "low", "medium", "high"];
  }
  if (modelId.startsWith("gemini-3.1-pro")) return ["low", "medium", "high"];
  if (/^gemini-3\.(?:5|1)-flash-lite(?!-image)/.test(modelId)) {
    return ["minimal", "low", "medium", "high"];
  }
  if (modelId.startsWith("gemini-3.1-flash-lite-image")) return ["minimal", "high"];
  if (modelId.startsWith("gemini-3-flash")) return ["minimal", "low", "medium", "high"];
  if (modelId.startsWith("gemini-3-pro")) return ["low", "high"];
  return [];
}

function googleThinkingBudgetRange(
  modelId: string,
): { readonly min: number; readonly max: number } | undefined {
  if (modelId.startsWith("gemini-2.5-pro")) return { min: 128, max: 32_768 };
  if (modelId.startsWith("gemini-2.5-flash-lite")) return { min: 512, max: 24_576 };
  if (modelId.startsWith("gemini-2.5-flash")) return { min: 0, max: 24_576 };
  return undefined;
}

/** Live reasoning metadata returned by OpenRouter's model catalog. */
export interface OpenRouterReasoningMetadata {
  readonly mandatory?: boolean;
  readonly defaultEnabled?: boolean;
  readonly supportedEfforts?: readonly string[];
  readonly defaultEffort?: string;
  readonly supportsMaxTokens?: boolean;
}

/** OpenRouter controls derived from the exact live reasoning metadata. */
export function openRouterOptions(
  reasoning: OpenRouterReasoningMetadata | undefined,
): readonly OptionDefinition[] {
  if (reasoning === undefined) {
    return [];
  }
  const options: OptionDefinition[] = [];
  if (reasoning.mandatory !== true) {
    options.push({
      key: "reasoning.enabled",
      kind: "boolean",
      label: "Reasoning",
      description: "Enables reasoning with the model's default settings.",
      group: "reasoning",
      support: capability("supported", [OPENROUTER_REASONING]),
      ...(reasoning.defaultEnabled === undefined ? {} : { defaultValue: reasoning.defaultEnabled }),
      target: { kind: "request-option", path: ["reasoning", "enabled"] },
    });
  }
  const efforts = (reasoning.supportedEfforts ?? []).filter(
    (effort) => reasoning.mandatory !== true || effort !== "none",
  );
  if (efforts.length > 0) {
    options.push({
      key: "reasoning.effort",
      kind: "enum",
      label: "Reasoning effort",
      description: "Uses only the effort levels advertised for this model.",
      group: "reasoning",
      support: capability("supported", [OPENROUTER_REASONING]),
      values: efforts,
      ...(reasoning.defaultEffort === undefined || !efforts.includes(reasoning.defaultEffort)
        ? {}
        : { defaultValue: reasoning.defaultEffort }),
      target: { kind: "request-option", path: ["reasoning", "effort"] },
    });
  }
  if (reasoning.supportsMaxTokens === true) {
    options.push({
      key: "reasoning.maxTokens",
      kind: "integer",
      label: "Reasoning token budget",
      description: "Sets the maximum reasoning tokens when this model supports a direct budget.",
      group: "reasoning",
      support: capability("supported", [OPENROUTER_REASONING]),
      min: 1,
      step: 1,
      target: { kind: "request-option", path: ["reasoning", "max_tokens"] },
    });
  }
  options.push({
    key: "reasoning.exclude",
    kind: "boolean",
    label: "Hide reasoning output",
    description: "Keeps reasoning active but excludes its trace from the response.",
    group: "reasoning",
    support: capability("supported", [OPENROUTER_REASONING]),
    target: { kind: "request-option", path: ["reasoning", "exclude"] },
  });
  return options;
}

/** Vercel Gateway controls that are independent of the upstream model provider. */
export function vercelGatewayOptions(): readonly OptionDefinition[] {
  return defineOptions([
    {
      key: "caching.auto",
      kind: "boolean",
      label: "Automatic caching",
      description: "Lets AI Gateway apply provider-appropriate cache markers.",
      group: "caching",
      support: capability("supported", [VERCEL_OPTIONS]),
    },
  ] as const);
}

/** Sources used by generated option overlays. */
export function optionSources(): readonly SourceReference[] {
  return [
    OPENAI_RESPONSES,
    ANTHROPIC_EFFORT,
    ANTHROPIC_THINKING,
    ANTHROPIC_FAST,
    ANTHROPIC_CACHE,
    ANTHROPIC_BETA,
    GOOGLE_THINKING,
    GOOGLE_TIERS,
    OPENROUTER_REASONING,
    VERCEL_OPTIONS,
  ];
}
