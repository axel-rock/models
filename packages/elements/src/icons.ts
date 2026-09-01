import type { ModelDescriptor } from "@models/core";
import { brandIcons } from "./generated/brandIcons.ts";

/** Which identity a model control uses for its optional brand mark. */
export type ModelIconMode = "model-maker" | "none";

/** Return a reviewed brand mark for a model maker or serving gateway. */
export function modelIcon(model: ModelDescriptor, mode: ModelIconMode): string {
  if (mode === "none") {
    return "";
  }
  const slug = modelMakerSlug(model);
  return slug === undefined ? "" : (brandIcons[slug] ?? "");
}

/** Return a reviewed provider mark that inherits the host text color. */
export function providerIcon(provider: string): string {
  const slug = providerSlug(provider);
  return slug === undefined ? "" : (brandIcons[slug] ?? "");
}

function modelMakerSlug(model: ModelDescriptor): string | undefined {
  const identity = normalize(`${model.name} ${model.id}`);
  const families: readonly (readonly [string, string])[] = [
    ["claude", "claude"],
    ["qwen", "qwen"],
    ["gemini", "gemini"],
    ["gemma", "gemma"],
    ["deepseek", "deepseek"],
    ["kimi", "kimi"],
    ["grok", "grok"],
    ["nova", "nova"],
  ];
  const family = families.find(([needle]) => identity.includes(needle));
  return family?.[1] ?? providerSlug(model.author ?? model.provider);
}

function providerSlug(provider: string): string | undefined {
  const normalized = normalize(provider);
  const aliases: Readonly<Record<string, string>> = {
    aionlabs: "aionlabs",
    alibaba: "alibaba",
    amazon: "bedrock",
    anthropic: "claude",
    anthraciteorg: "",
    arceeai: "arcee",
    baidu: "baidu",
    bfl: "bfl",
    bytedance: "bytedance",
    bytendanceseed: "bytedance",
    cognitivecomputations: "",
    cohere: "cohere",
    deepseek: "deepseek",
    fishaudio: "fishaudio",
    google: "google",
    ibmgranite: "ibm",
    inception: "inception",
    klingai: "kling",
    kwaipilot: "kwaipilot",
    liquid: "liquid",
    meta: "meta",
    metallama: "meta",
    microsoft: "microsoft",
    minimax: "minimax",
    mistral: "mistral",
    mistralai: "mistral",
    moonshotai: "moonshot",
    morph: "morph",
    nousresearch: "nousresearch",
    nvidia: "nvidia",
    openai: "openai",
    openrouter: "openrouter",
    perplexity: "perplexity",
    poolside: "poolside",
    qwen: "qwen",
    recraft: "recraft",
    relace: "relace",
    spacexai: "xai",
    stepfun: "stepfun",
    tencent: "tencent",
    upstage: "upstage",
    vercel: "vercel",
    voyage: "voyage",
    xai: "xai",
    xiaomi: "xiaomimimo",
    zai: "zai",
  };
  const slug = aliases[normalized] ?? normalized;
  return slug !== "" && brandIcons[slug] !== undefined ? slug : undefined;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replaceAll(/[^a-z0-9]/g, "");
}
