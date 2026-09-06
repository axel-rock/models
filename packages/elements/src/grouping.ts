import type { ModelDescriptor, ModelRecommendation } from "@models/core";

/** Optional model-list grouping for gateway catalogs. */
export type ModelGrouping = "none" | "author" | ((model: ModelDescriptor) => string | undefined);

export function modelGroup(model: ModelDescriptor, grouping: ModelGrouping): string | undefined {
  if (typeof grouping === "function") {
    return grouping(model);
  }
  if (grouping === "none") {
    return undefined;
  }
  const author = model.author ?? model.id.split("/")[0];
  return author === undefined || author === model.id ? "Other" : displayAuthor(author);
}

function displayAuthor(value: string): string {
  const names: Readonly<Record<string, string>> = {
    anthropic: "Anthropic",
    google: "Google",
    openai: "OpenAI",
  };
  return names[value.toLocaleLowerCase()] ?? titleCase(value);
}

function titleCase(value: string): string {
  return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

/** Recommended models lead the list once, followed by the remaining model groups. */
export function modelGroups(
  models: readonly ModelDescriptor[],
  grouping: ModelGrouping,
  recommendations: readonly ModelRecommendation[],
): Map<string, ModelDescriptor[]> {
  const recommendedKeys = new Set(recommendations.map((item) => item.model));
  const recommended = models.filter(
    (model) => recommendedKeys.has(model.key) || recommendedKeys.has(model.id),
  );
  const groups = new Map<string, ModelDescriptor[]>();
  if (recommended.length > 0) groups.set("Recommended", recommended);
  const selected = new Set(recommended);
  for (const model of models) {
    if (selected.has(model)) continue;
    const group =
      grouping === "none"
        ? recommended.length > 0
          ? "All models"
          : ""
        : (modelGroup(model, grouping) ?? "Other");
    const values = groups.get(group) ?? [];
    values.push(model);
    groups.set(group, values);
  }
  return groups;
}
