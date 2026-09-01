import type { ModelCatalog, ModelDescriptor, ModelSelection, ProviderId } from "@models/core";
import {
  defineModelsElements,
  ModelsComposerElement,
  ModelsOptionsElement,
  ModelsPickerElement,
  ModelsSelectElement,
  MODEL_CLEAR_EVENT,
  SELECTION_CHANGE_EVENT,
  type ModelGrouping,
  type ModelIconMode,
} from "@models/elements";
import { openRouterAdapter, vercelGatewayAdapter } from "@models/providers";
import { directProviderExamples } from "./demoCatalogs.ts";
import "./style.css";

defineModelsElements();

interface ProviderView {
  readonly id: ProviderId;
  readonly name: string;
  readonly shortName: string;
  readonly catalog: ModelCatalog;
  readonly category: "direct" | "gateway";
}

type ExampleTab = "composer" | "inspector" | "model" | "reasoning";

const publicResults = await Promise.allSettled([
  vercelGatewayAdapter.discover(),
  openRouterAdapter.discover(),
]);
const liveCatalogs = publicResults.flatMap((result) =>
  result.status === "fulfilled" ? [result.value] : [],
);
const catalogs: readonly ModelCatalog[] = [...liveCatalogs, ...directProviderExamples()];
const providerViews = catalogs.map(providerView);
let selectedProvider = providerViews.find((view) => view.id === "vercel") ?? providerViews[0];
let selectedModel: ModelDescriptor | undefined;
let grouping: ModelGrouping = "author";
let iconMode: ModelIconMode = "model-maker";

const simpleSelect = document.querySelector("#simple-select");
const reasoningSelect = document.querySelector("#reasoning-select");
const reasoningOptions = document.querySelector("#reasoning-options");
const advancedPicker = document.querySelector("#advanced-picker");
const composerMenu = document.querySelector("#composer-menu");

if (simpleSelect instanceof ModelsSelectElement) {
  simpleSelect.density = "compact";
  simpleSelect.addEventListener("models-model-change", (event) => {
    syncModel((event as CustomEvent<ModelDescriptor>).detail);
  });
  simpleSelect.addEventListener(MODEL_CLEAR_EVENT, clearModel);
}
if (reasoningOptions instanceof ModelsOptionsElement) {
  reasoningOptions.groups = ["reasoning"];
  reasoningOptions.layout = "inline";
}
if (reasoningSelect instanceof ModelsSelectElement) {
  reasoningSelect.density = "compact";
  reasoningSelect.addEventListener("models-model-change", (event) => {
    syncModel((event as CustomEvent<ModelDescriptor>).detail);
  });
  reasoningSelect.addEventListener(MODEL_CLEAR_EVENT, clearModel);
}
if (advancedPicker instanceof ModelsPickerElement) {
  advancedPicker.groups = ["reasoning", "speed", "caching", "beta"];
  advancedPicker.optionsLayout = "inline";
  advancedPicker.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
    const selection = (event as CustomEvent<ModelSelection>).detail;
    syncModel(selection.model);
    setText(
      "#selection-output",
      JSON.stringify({ model: selection.model.id, options: selection.options }, null, 2),
    );
  });
}
if (composerMenu instanceof ModelsComposerElement) {
  composerMenu.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
    syncModel((event as CustomEvent<ModelSelection>).detail.model);
  });
}

for (const tab of document.querySelectorAll<HTMLButtonElement>("button[data-tab]")) {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab as ExampleTab));
  tab.addEventListener("keydown", (event) => onTabKeydown(event, tab));
}

document.querySelector("#group-models")?.addEventListener("change", (event) => {
  grouping = event.target instanceof HTMLInputElement && event.target.checked ? "author" : "none";
  renderSelectedSource(false);
});

document.querySelector("#show-icons")?.addEventListener("change", (event) => {
  iconMode =
    event.target instanceof HTMLInputElement && event.target.checked ? "model-maker" : "none";
  renderSelectedSource(false);
});

renderSourceOptions();
renderSelectedSource(true);
setActiveTab("composer");

function renderSourceOptions(): void {
  renderSourceGroup(
    "#gateway-options",
    providerViews.filter((view) => view.category === "gateway"),
  );
  renderSourceGroup(
    "#direct-options",
    providerViews.filter((view) => view.category === "direct"),
  );
}

function renderSourceGroup(selector: string, views: readonly ProviderView[]): void {
  const options = document.querySelector(selector);
  if (options === null) {
    return;
  }
  options.innerHTML = views
    .map(
      (view) =>
        `<button type="button" data-provider="${escapeHtml(view.id)}" aria-pressed="${view.id === selectedProvider?.id}">${escapeHtml(view.shortName)}</button>`,
    )
    .join("");
  for (const button of options.querySelectorAll<HTMLButtonElement>("button[data-provider]")) {
    button.addEventListener("click", () => {
      const next = providerViews.find((view) => view.id === button.dataset.provider);
      if (next === undefined || next.id === selectedProvider?.id) {
        return;
      }
      selectedProvider = next;
      renderSourceOptions();
      renderSelectedSource(true);
      document.querySelector<HTMLDetailsElement>("#source-menu")?.removeAttribute("open");
    });
  }
}

function renderSelectedSource(chooseDefault: boolean): void {
  if (selectedProvider === undefined) {
    return;
  }
  const catalog = withSortedLanguageModels(selectedProvider.catalog);
  const grouped: ModelGrouping = isGateway(catalog) ? grouping : "none";
  if (
    chooseDefault ||
    selectedModel === undefined ||
    !catalog.models.some((model) => model.key === selectedModel?.key)
  ) {
    selectedModel = preferredModel(catalog.models);
  }
  configureSelect(simpleSelect, catalog, grouped);
  configureSelect(reasoningSelect, catalog, grouped);
  if (reasoningOptions instanceof ModelsOptionsElement) {
    reasoningOptions.model = selectedModel;
    reasoningOptions.value = {};
  }
  if (advancedPicker instanceof ModelsPickerElement) {
    advancedPicker.groupBy = grouped;
    advancedPicker.iconMode = iconMode;
    advancedPicker.catalogs = [catalog];
    advancedPicker.value =
      selectedModel === undefined ? undefined : { model: selectedModel, options: {} };
  }
  if (composerMenu instanceof ModelsComposerElement) {
    composerMenu.groupBy = grouped;
    composerMenu.iconMode = iconMode;
    composerMenu.catalogs = [catalog];
    composerMenu.value =
      selectedModel === undefined ? undefined : { model: selectedModel, options: {} };
  }
  const sourceKind = catalog.source.kind === "live-api" ? "live catalog" : "documented example";
  setText(
    "#source-summary",
    `${catalog.models.length} model${catalog.models.length === 1 ? "" : "s"} · ${sourceKind}`,
  );
  const toggle = document.querySelector<HTMLElement>(".group-toggle");
  if (toggle !== null) {
    toggle.hidden = !isGateway(catalog);
  }
  renderFreshness(catalog);
}

function configureSelect(
  element: Element | null,
  catalog: ModelCatalog,
  grouped: ModelGrouping,
): void {
  if (!(element instanceof ModelsSelectElement)) {
    return;
  }
  element.groupBy = grouped;
  element.iconMode = iconMode;
  element.catalogs = [catalog];
  element.value = selectedModel?.key ?? "";
}

function syncModel(model: ModelDescriptor): void {
  if (selectedModel?.key === model.key) {
    return;
  }
  selectedModel = model;
  if (simpleSelect instanceof ModelsSelectElement && simpleSelect.value !== model.key) {
    simpleSelect.value = model.key;
  }
  if (reasoningSelect instanceof ModelsSelectElement && reasoningSelect.value !== model.key) {
    reasoningSelect.value = model.key;
  }
  if (reasoningOptions instanceof ModelsOptionsElement) {
    reasoningOptions.model = model;
    reasoningOptions.value = {};
  }
  if (
    advancedPicker instanceof ModelsPickerElement &&
    advancedPicker.value?.model.key !== model.key
  ) {
    advancedPicker.value = { model, options: {} };
  }
  if (
    composerMenu instanceof ModelsComposerElement &&
    composerMenu.value?.model.key !== model.key
  ) {
    composerMenu.value = { model, options: {} };
  }
}

function clearModel(): void {
  selectedModel = undefined;
  if (simpleSelect instanceof ModelsSelectElement) {
    simpleSelect.value = "";
  }
  if (reasoningSelect instanceof ModelsSelectElement) {
    reasoningSelect.value = "";
  }
  if (reasoningOptions instanceof ModelsOptionsElement) {
    reasoningOptions.model = undefined;
    reasoningOptions.value = {};
  }
  if (advancedPicker instanceof ModelsPickerElement) {
    advancedPicker.value = undefined;
  }
  if (composerMenu instanceof ModelsComposerElement) {
    composerMenu.value = undefined;
  }
}

function setActiveTab(active: ExampleTab): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>("button[data-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === active));
    tab.tabIndex = tab.dataset.tab === active ? 0 : -1;
  }
  for (const panel of document.querySelectorAll<HTMLElement>("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== active;
  }
}

function onTabKeydown(event: KeyboardEvent, current: HTMLButtonElement): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }
  event.preventDefault();
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
  const index = tabs.indexOf(current);
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(index + direction + tabs.length) % tabs.length];
  if (next !== undefined) {
    setActiveTab(next.dataset.tab as ExampleTab);
    next.focus();
  }
}

function providerView(catalog: ModelCatalog): ProviderView {
  const names: Readonly<Record<string, readonly [string, string]>> = {
    anthropic: ["Anthropic direct", "Anthropic"],
    google: ["Google AI direct", "Google"],
    openai: ["OpenAI direct", "OpenAI"],
    openrouter: ["OpenRouter", "OpenRouter"],
    vercel: ["Vercel AI Gateway", "Vercel"],
  };
  const [name, shortName] = names[catalog.provider] ?? [catalog.provider, catalog.provider];
  return {
    id: catalog.provider,
    name,
    shortName,
    catalog,
    category: isGateway(catalog) ? "gateway" : "direct",
  };
}

function withSortedLanguageModels(catalog: ModelCatalog): ModelCatalog {
  return {
    ...catalog,
    models: languageModels(catalog).toSorted((left, right) => {
      const author = (left.author ?? left.id.split("/")[0] ?? "").localeCompare(
        right.author ?? right.id.split("/")[0] ?? "",
      );
      return author === 0 ? left.name.localeCompare(right.name) : author;
    }),
  };
}

function languageModels(catalog: ModelCatalog): readonly ModelDescriptor[] {
  return catalog.models.filter((model) => model.kind === "language");
}

function preferredModel(models: readonly ModelDescriptor[]): ModelDescriptor | undefined {
  return (
    models.find((model) => model.name === "Claude Opus 5") ??
    models.find(
      (model) =>
        !/\b(?:fast|high speed)\b/i.test(model.name) &&
        model.capabilities.reasoning.status === "supported",
    ) ??
    models[0]
  );
}

function isGateway(catalog: ModelCatalog): boolean {
  return catalog.provider === "vercel" || catalog.provider === "openrouter";
}

function renderFreshness(catalog: ModelCatalog): void {
  const grid = document.querySelector("#freshness-grid");
  if (grid === null || selectedProvider === undefined) {
    return;
  }
  const source = catalog.source;
  grid.innerHTML = `<dl><div><dt>Source</dt><dd>${escapeHtml(selectedProvider.name)}</dd></div><div><dt>Evidence</dt><dd>${escapeHtml(source.kind)}</dd></div><div><dt>Checked</dt><dd><time datetime="${escapeHtml(catalog.fetchedAt)}">${escapeHtml(catalog.fetchedAt.slice(0, 10))}</time></dd></div></dl>`;
}

function setText(selector: string, value: string): void {
  const element = document.querySelector(selector);
  if (element !== null) {
    element.textContent = value;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
