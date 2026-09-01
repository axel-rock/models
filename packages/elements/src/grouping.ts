import type { ModelDescriptor } from "@models/core";

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
