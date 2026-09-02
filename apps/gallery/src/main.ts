import {
  defineModelPolicy,
  findLowestPricedModel,
  resolveModelPolicy,
  resolvePolicyDefaults,
  validateOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ModelRecommendation,
  type ModelSelection,
  type OptionValues,
  type ProviderId,
  type ResolvedModelPolicy,
} from "@models/core";
import {
  defineModelsElements,
  ModelsComposerElement,
  ModelsOptionsElement,
  ModelsPickerElement,
  ModelsSelectElement,
  MODEL_CLEAR_EVENT,
  OPTIONS_CHANGE_EVENT,
  SELECTION_CHANGE_EVENT,
  providerIcon,
  type ModelGrouping,
  type ModelIconMode,
  type VisibleOptionGroup,
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

type ExampleTab = "composer" | "inline" | "inspector" | "minimal";
type SelectionOptions = OptionValues<ModelDescriptor["options"]>;

interface GalleryState {
  readonly approved: boolean;
  readonly grouping: boolean;
  readonly iconMode: boolean;
  readonly modelKey: string | undefined;
  readonly more: boolean;
  readonly options: SelectionOptions;
  readonly provider: string | undefined;
  readonly reasoning: boolean;
  readonly speed: boolean;
  readonly tab: ExampleTab;
}

const COMPANY_MODEL_IDS = [
  "anthropic/claude-opus-5",
  "openai/gpt-5.6-sol",
  "moonshotai/kimi-k3",
] as const;

const DIRECT_APPROVED_IDS: Readonly<Record<string, readonly string[]>> = {
  anthropic: ["claude-opus-5"],
  google: ["gemini-3.5-flash"],
  openai: ["gpt-5.6-luna"],
};
const ALL_OPTION_GROUPS: readonly VisibleOptionGroup[] = [
  "reasoning",
  "speed",
  "routing",
  "caching",
  "beta",
  "generation",
];

const publicResults = await Promise.allSettled([
  vercelGatewayAdapter.discover(),
  openRouterAdapter.discover(),
]);
const liveCatalogs = publicResults.flatMap((result) =>
  result.status === "fulfilled" ? [result.value] : [],
);
const catalogs: readonly ModelCatalog[] = [...liveCatalogs, ...directProviderExamples()];
const providerViews = catalogs.map(providerView);
let selectedProvider: ProviderView | undefined;
let selectedModel: ModelDescriptor | undefined;
let selectedOptions: SelectionOptions = {};
let draftOptions: SelectionOptions = {};
let grouping: ModelGrouping = "author";
let iconMode: ModelIconMode = "model-maker";
let activeTab: ExampleTab = "composer";
let isStateReady = false;
let activeCatalog: ModelCatalog | undefined;
let activePolicy: ResolvedModelPolicy | undefined;
let activeModels = new Map<string, ModelDescriptor>();

const minimalSelect = document.querySelector("#simple-select");
const inlineSelect = document.querySelector("#inline-select");
const inlineOptions = document.querySelector("#inline-options");
const advancedPicker = document.querySelector("#advanced-picker");
const composerMenu = document.querySelector("#composer-menu");

for (const select of [minimalSelect, inlineSelect]) {
  if (!(select instanceof ModelsSelectElement)) continue;
  select.density = "compact";
  select.addEventListener("models-model-change", (event) => {
    syncSelection((event as CustomEvent<ModelDescriptor>).detail, draftOptions);
  });
  select.addEventListener(MODEL_CLEAR_EVENT, clearSelection);
}

if (inlineOptions instanceof ModelsOptionsElement) {
  inlineOptions.layout = "inline";
  inlineOptions.addEventListener(OPTIONS_CHANGE_EVENT, (event) => {
    if (selectedModel !== undefined) {
      syncSelection(selectedModel, (event as CustomEvent<SelectionOptions>).detail);
    }
  });
}

for (const element of [advancedPicker, composerMenu]) {
  element?.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
    const selection = (event as CustomEvent<ModelSelection>).detail;
    syncSelection(
      selection.model,
      selection.model.key === selectedModel?.key ? selection.options : draftOptions,
    );
  });
}

if (advancedPicker instanceof ModelsPickerElement) advancedPicker.optionsLayout = "inline";

for (const control of document.querySelectorAll<HTMLInputElement>(
  '.policy-controls input[id^="policy-"]',
)) {
  control.addEventListener("change", () => renderSelectedSource(false));
}

for (const tab of document.querySelectorAll<HTMLButtonElement>("button[data-tab]")) {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab as ExampleTab, true));
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

restoreGalleryState();
window.addEventListener("popstate", restoreGalleryState);

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
  if (options === null) return;
  options.innerHTML = views
    .map((view) => {
      const icon = providerIcon(view.id);
      return `<button type="button" data-provider="${escapeHtml(view.id)}" aria-pressed="${view.id === selectedProvider?.id}" title="${escapeHtml(view.name)}">${icon === "" ? "" : `<span class="source-option-icon" aria-hidden="true">${icon}</span>`}<span class="source-option-label">${escapeHtml(view.shortName)}</span></button>`;
    })
    .join("");
  for (const button of options.querySelectorAll<HTMLButtonElement>("button[data-provider]")) {
    button.addEventListener("click", () => {
      const next = providerViews.find((view) => view.id === button.dataset.provider);
      if (next === undefined || next.id === selectedProvider?.id) return;
      selectedProvider = next;
      renderSourceOptions();
      renderSelectedSource(true);
      document.querySelector<HTMLDetailsElement>("#source-menu")?.removeAttribute("open");
    });
  }
}

function renderSelectedSource(chooseDefault: boolean): void {
  if (selectedProvider === undefined) return;
  const sourceCatalog = withSortedLanguageModels(selectedProvider.catalog);
  const sourceMark = providerIcon(selectedProvider.id);
  const triggerIcon = document.querySelector("#source-trigger-icon");
  if (triggerIcon !== null) triggerIcon.innerHTML = sourceMark;
  setText("#source-trigger-label", selectedProvider.shortName);
  const isApproved = isChecked("#policy-approved");
  const include = isApproved ? approvedIds(sourceCatalog) : undefined;
  const groups = selectedGroups();
  const policy = defineModelPolicy({
    models: {
      ...(include === undefined ? {} : { include }),
      recommendations:
        include?.[0] === undefined
          ? []
          : [{ model: include[0], label: "Recommended for this app" }],
    },
    options: {
      groups,
      ...(isApproved
        ? {
            values: {
              "reasoning.effort": ["low", "medium", "high"],
              "service.tier": ["default", "flex", "fast"],
              "speed.mode": ["standard", "fast"],
            },
            defaults: {
              "reasoning.effort": "medium",
              "service.tier": "default",
              "speed.mode": "standard",
            },
          }
        : {}),
    },
  });
  const resolved = resolveModelPolicy([sourceCatalog], policy);
  activePolicy = resolved;
  activeCatalog = resolved.catalogs[0] ?? { ...sourceCatalog, models: [] };
  activeModels = new Map(activeCatalog.models.map((model) => [model.key, model]));

  const previous = selectedModel === undefined ? undefined : activeModels.get(selectedModel.key);
  if (chooseDefault || previous === undefined) {
    selectedModel = preferredModel(activeCatalog.models);
    draftOptions =
      selectedModel === undefined ? {} : resolvePolicyDefaults(selectedModel, resolved);
  } else {
    selectedModel = previous;
  }
  selectedOptions =
    selectedModel === undefined ? {} : retainValidOptions(selectedModel, draftOptions, groups);

  const recommendations = recommendationsFor(activeCatalog, resolved.recommendations);
  const grouped: ModelGrouping =
    isChecked("#policy-approved") || !isGateway(sourceCatalog) ? "none" : grouping;
  configureSelect(minimalSelect, activeCatalog, grouped, recommendations);
  configureSelect(inlineSelect, activeCatalog, grouped, recommendations);

  if (inlineOptions instanceof ModelsOptionsElement) inlineOptions.groups = groups;
  if (advancedPicker instanceof ModelsPickerElement) {
    advancedPicker.groupBy = grouped;
    advancedPicker.iconMode = iconMode;
    advancedPicker.groups = groups;
    advancedPicker.recommendations = recommendations;
    advancedPicker.catalogs = [activeCatalog];
  }
  if (composerMenu instanceof ModelsComposerElement) {
    composerMenu.groupBy = grouped;
    composerMenu.iconMode = iconMode;
    composerMenu.groups = groups;
    composerMenu.recommendations = recommendations;
    composerMenu.catalogs = [activeCatalog];
  }
  applySelection();

  const sourceKind =
    sourceCatalog.source.kind === "live-api" ? "live catalog" : "documented example";
  const total = sourceCatalog.models.length;
  const shown = activeCatalog.models.length;
  setText(
    "#source-summary",
    `${shown}${shown === total ? "" : ` of ${total}`} model${shown === 1 ? "" : "s"} · ${sourceKind}`,
  );
  const toggle = document.querySelector<HTMLElement>(".group-toggle");
  if (toggle !== null) toggle.hidden = !isGateway(sourceCatalog);
  renderFreshness(sourceCatalog);
}

function configureSelect(
  element: Element | null,
  catalog: ModelCatalog,
  grouped: ModelGrouping,
  recommendations: readonly ModelRecommendation[],
): void {
  if (!(element instanceof ModelsSelectElement)) return;
  element.groupBy = grouped;
  element.iconMode = iconMode;
  element.recommendations = recommendations;
  element.catalogs = [catalog];
}

function syncSelection(model: ModelDescriptor, options: SelectionOptions): void {
  const current = activeModels.get(model.key);
  if (current === undefined) return;
  const isSameModel = current.key === selectedModel?.key;
  selectedModel = current;
  draftOptions = isSameModel
    ? updateVisibleDraft(current, draftOptions, options, selectedGroups())
    : {
        ...(activePolicy === undefined ? {} : resolvePolicyDefaults(current, activePolicy)),
        ...retainValidOptions(current, options, ALL_OPTION_GROUPS),
      };
  selectedOptions = retainValidOptions(current, draftOptions, selectedGroups());
  applySelection();
}

function applySelection(): void {
  const selection =
    selectedModel === undefined
      ? undefined
      : ({ model: selectedModel, options: selectedOptions } satisfies ModelSelection);
  for (const select of [minimalSelect, inlineSelect]) {
    if (select instanceof ModelsSelectElement) select.value = selectedModel?.key ?? "";
  }
  if (inlineOptions instanceof ModelsOptionsElement) {
    inlineOptions.model = selectedModel;
    inlineOptions.value = selectedOptions;
  }
  if (advancedPicker instanceof ModelsPickerElement) advancedPicker.value = selection;
  if (composerMenu instanceof ModelsComposerElement) composerMenu.value = selection;
  setText(
    "#selection-output",
    selection === undefined
      ? "Choose a model or option to inspect the value."
      : JSON.stringify(
          {
            provider: selectedProvider?.id,
            model: selection.model.id,
            options: selection.options,
          },
          null,
          2,
        ),
  );
  if (isStateReady) syncUrlState();
}

function clearSelection(): void {
  selectedModel = undefined;
  selectedOptions = {};
  draftOptions = {};
  applySelection();
}

function updateVisibleDraft(
  model: ModelDescriptor,
  previous: SelectionOptions,
  visible: SelectionOptions,
  groups: readonly VisibleOptionGroup[],
): SelectionOptions {
  const hidden = Object.fromEntries(
    Object.entries(previous).filter(([key]) => {
      const option = model.options.find((candidate) => candidate.key === key);
      return option !== undefined && !groups.includes(option.group);
    }),
  );
  return { ...hidden, ...visible };
}

function retainValidOptions(
  model: ModelDescriptor,
  values: SelectionOptions,
  groups: readonly VisibleOptionGroup[],
): SelectionOptions {
  const next: Record<string, string | number | boolean | readonly string[]> = {};
  for (const option of model.options) {
    const value = values[option.key];
    if (!groups.includes(option.group) || value === undefined) continue;
    const candidate = { [option.key]: value };
    if (validateOptions([option], candidate).ok) next[option.key] = value;
  }
  reconcileConstraints(model, next);
  return next;
}

function reconcileConstraints(
  model: ModelDescriptor,
  values: Record<string, string | number | boolean | readonly string[]>,
): void {
  for (const constraint of model.constraints ?? []) {
    if (constraint.kind === "less-than") {
      const left = values[constraint.leftKey];
      const right = values[constraint.rightKey];
      if (typeof left === "number" && typeof right === "number" && left >= right) {
        delete values[constraint.leftKey];
      }
      continue;
    }
    if (values[constraint.when.key] !== constraint.when.equals) continue;
    if (constraint.kind === "requires" && values[constraint.key] === undefined) {
      delete values[constraint.when.key];
    }
    if (constraint.kind === "forbids" && values[constraint.key] !== undefined) {
      delete values[constraint.key];
    }
  }
}

function recommendationsFor(
  catalog: ModelCatalog,
  declared: readonly ModelRecommendation[],
): readonly ModelRecommendation[] {
  const lowestInput = findLowestPricedModel([catalog], "input-token");
  const recommendations = [
    ...declared,
    ...(lowestInput === undefined
      ? []
      : [{ model: lowestInput.key, label: "Lowest listed input price" }]),
  ];
  return recommendations.filter(
    (recommendation, index) =>
      recommendations.findIndex(
        (candidate) =>
          candidate.model === recommendation.model && candidate.label === recommendation.label,
      ) === index,
  );
}

function approvedIds(catalog: ModelCatalog): readonly string[] {
  return isGateway(catalog) ? COMPANY_MODEL_IDS : (DIRECT_APPROVED_IDS[catalog.provider] ?? []);
}

function selectedGroups(): readonly VisibleOptionGroup[] {
  return [
    ...(isChecked("#policy-reasoning") ? (["reasoning"] as const) : []),
    ...(isChecked("#policy-speed") ? (["speed"] as const) : []),
    ...(isChecked("#policy-more") ? (["routing", "caching", "beta", "generation"] as const) : []),
  ];
}

function isChecked(selector: string): boolean {
  return document.querySelector<HTMLInputElement>(selector)?.checked ?? false;
}

function setActiveTab(active: ExampleTab, isNavigation = false): void {
  activeTab = active;
  for (const tab of document.querySelectorAll<HTMLButtonElement>("button[data-tab]")) {
    tab.setAttribute("aria-selected", String(tab.dataset.tab === active));
    tab.tabIndex = tab.dataset.tab === active ? 0 : -1;
  }
  for (const panel of document.querySelectorAll<HTMLElement>("[data-panel]")) {
    panel.hidden = panel.dataset.panel !== active;
  }
  if (isStateReady) syncUrlState(isNavigation ? "push" : "replace");
}

function onTabKeydown(event: KeyboardEvent, current: HTMLButtonElement): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("button[data-tab]")];
  const index = tabs.indexOf(current);
  const direction = event.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(index + direction + tabs.length) % tabs.length];
  if (next !== undefined) {
    setActiveTab(next.dataset.tab as ExampleTab, true);
    next.focus();
  }
}

function restoreGalleryState(): void {
  const state = readGalleryState();
  isStateReady = false;
  selectedProvider =
    providerViews.find((view) => view.id === state.provider) ??
    providerViews.find((view) => view.id === "vercel") ??
    providerViews[0];
  grouping = state.grouping ? "author" : "none";
  iconMode = state.iconMode ? "model-maker" : "none";
  setChecked("#policy-approved", state.approved);
  setChecked("#policy-reasoning", state.reasoning);
  setChecked("#policy-speed", state.speed);
  setChecked("#policy-more", state.more);
  setChecked("#show-icons", state.iconMode);
  setChecked("#group-models", state.grouping);
  renderSourceOptions();
  renderSelectedSource(true);
  const restoredModel = state.modelKey === undefined ? undefined : activeModels.get(state.modelKey);
  if (restoredModel !== undefined) {
    selectedModel = restoredModel;
    draftOptions = {
      ...(activePolicy === undefined ? {} : resolvePolicyDefaults(restoredModel, activePolicy)),
      ...state.options,
    };
    selectedOptions = retainValidOptions(restoredModel, draftOptions, selectedGroups());
  }
  setActiveTab(state.tab);
  isStateReady = true;
  applySelection();
}

function readGalleryState(): GalleryState {
  const params = new URLSearchParams(window.location.search);
  return {
    approved: readBoolean(params, "approved", true),
    grouping: readBoolean(params, "groups", true),
    iconMode: readBoolean(params, "logos", true),
    modelKey: params.get("model") ?? undefined,
    more: readBoolean(params, "more", false),
    options: readOptions(params.get("options")),
    provider: params.get("provider") ?? undefined,
    reasoning: readBoolean(params, "reasoning", true),
    speed: readBoolean(params, "speed", true),
    tab: tabFromHash(window.location.hash),
  };
}

function syncUrlState(mode: "push" | "replace" = "replace"): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  setParam(params, "provider", selectedProvider?.id);
  setParam(params, "model", selectedModel?.key);
  setParam(
    params,
    "options",
    Object.keys(draftOptions).length === 0 ? undefined : JSON.stringify(draftOptions),
  );
  setBooleanParam(params, "approved", isChecked("#policy-approved"), true);
  setBooleanParam(params, "reasoning", isChecked("#policy-reasoning"), true);
  setBooleanParam(params, "speed", isChecked("#policy-speed"), true);
  setBooleanParam(params, "more", isChecked("#policy-more"), false);
  setBooleanParam(params, "logos", iconMode === "model-maker", true);
  setBooleanParam(params, "groups", grouping === "author", true);
  url.hash = `panel-${activeTab}`;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

function setParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value === undefined || value === "") params.delete(key);
  else params.set(key, value);
}

function setBooleanParam(
  params: URLSearchParams,
  key: string,
  value: boolean,
  defaultValue: boolean,
): void {
  setParam(params, key, value === defaultValue ? undefined : value ? "1" : "0");
}

function readBoolean(params: URLSearchParams, key: string, defaultValue: boolean): boolean {
  const value = params.get(key);
  return value === null ? defaultValue : value !== "0";
}

function readOptions(value: string | null): SelectionOptions {
  if (value === null) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | number | boolean | string[]] => {
          const candidate: unknown = entry[1];
          return (
            typeof candidate === "string" ||
            typeof candidate === "number" ||
            typeof candidate === "boolean" ||
            (Array.isArray(candidate) && candidate.every((item) => typeof item === "string"))
          );
        },
      ),
    );
  } catch {
    return {};
  }
}

function tabFromHash(hash: string): ExampleTab {
  const candidate = hash.replace(/^#(?:panel-)?/, "");
  return ["minimal", "inline", "composer", "inspector"].includes(candidate)
    ? (candidate as ExampleTab)
    : "composer";
}

function setChecked(selector: string, value: boolean): void {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (input !== null) input.checked = value;
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
  if (grid === null || selectedProvider === undefined) return;
  const source = catalog.source;
  grid.innerHTML = `<dl><div><dt>Source</dt><dd>${escapeHtml(selectedProvider.name)}</dd></div><div><dt>Evidence</dt><dd>${escapeHtml(source.kind)}</dd></div><div><dt>Checked</dt><dd><time datetime="${escapeHtml(catalog.fetchedAt)}">${escapeHtml(catalog.fetchedAt.slice(0, 10))}</time></dd></div></dl>`;
}

function setText(selector: string, value: string): void {
  const element = document.querySelector(selector);
  if (element !== null) element.textContent = value;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
