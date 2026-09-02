import {
  validateConstraints,
  validateOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ModelRecommendation,
  type ModelSelection,
  type OptionValues,
} from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { emitSelectionChange, OPTIONS_CHANGE_EVENT } from "./events.ts";
import { modelGroup, type ModelGrouping } from "./grouping.ts";
import { modelIcon, type ModelIconMode } from "./icons.ts";
import type { OptionsLayout, VisibleOptionGroup } from "./options.ts";
import { ModelsOptionsElement } from "./options.ts";
import { ModelsPriceElement } from "./price.ts";
import { elementStyles } from "./styles.ts";

/** A searchable, composed model picker with optional detail groups and pricing. */
export class ModelsPickerElement extends ModelsHTMLElement {
  #catalogs: readonly ModelCatalog[] = [];
  #selected: ModelDescriptor | undefined;
  #options: OptionValues<ModelDescriptor["options"]> = {};
  #groups: readonly VisibleOptionGroup[] = [
    "reasoning",
    "speed",
    "routing",
    "caching",
    "beta",
    "generation",
  ];
  #query = "";
  #groupBy: ModelGrouping = "none";
  #optionsLayout: OptionsLayout = "stacked";
  #iconMode: ModelIconMode = "none";
  #recommendations: readonly ModelRecommendation[] = [];
  readonly #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  /** Catalogs available to the picker. */
  get catalogs(): readonly ModelCatalog[] {
    return this.#catalogs;
  }

  set catalogs(value: readonly ModelCatalog[]) {
    this.#catalogs = value;
    const models = value.flatMap((catalog) => catalog.models);
    if (
      this.#selected === undefined ||
      !models.some((model) => model.key === this.#selected?.key)
    ) {
      this.#selected = models[0];
      this.#options = {};
      this.#query = "";
    }
    this.render();
  }

  /** Option groups visible in the detail panel. Use an empty list for model-only mode. */
  get groups(): readonly VisibleOptionGroup[] {
    return this.#groups;
  }

  set groups(value: readonly VisibleOptionGroup[]) {
    this.#groups = value;
    this.render();
  }

  /** How the model list is grouped. Author grouping is useful for gateways. */
  get groupBy(): ModelGrouping {
    return this.#groupBy;
  }

  set groupBy(value: ModelGrouping) {
    this.#groupBy = value;
    this.render();
  }

  /** Layout used for the selected model's option controls. */
  get optionsLayout(): OptionsLayout {
    return this.#optionsLayout;
  }

  set optionsLayout(value: OptionsLayout) {
    this.#optionsLayout = value;
    this.render();
  }

  /** Which optional brand identity is shown in model rows. */
  get iconMode(): ModelIconMode {
    return this.#iconMode;
  }

  set iconMode(value: ModelIconMode) {
    this.#iconMode = value;
    this.render();
  }

  /** App-owned recommendation labels shown beside matching models. */
  get recommendations(): readonly ModelRecommendation[] {
    return this.#recommendations;
  }

  set recommendations(value: readonly ModelRecommendation[]) {
    this.#recommendations = value;
    this.render();
  }

  /** The current complete selection. */
  get value(): ModelSelection | undefined {
    return this.#selected === undefined
      ? undefined
      : { model: this.#selected, options: this.#options };
  }

  set value(value: ModelSelection | undefined) {
    this.#selected = value?.model;
    this.#options = value?.options ?? {};
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const models = this.#catalogs.flatMap((catalog) => catalog.models);
    const selected = this.#selected;
    this.#root.innerHTML = `
      <style>
        ${elementStyles}
        .picker { display: grid; grid-template-columns: minmax(230px, .8fr) minmax(280px, 1.2fr); border: 1px solid var(--models-border, #d6d6d6); border-radius: var(--models-panel-radius, 9px); overflow: hidden; background: var(--models-surface, #fff); }
        .models { min-width: 0; border-right: 1px solid var(--models-border, #d6d6d6); }
        .search { padding: 7px; border-bottom: 1px solid var(--models-border, #d6d6d6); }
        .search .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .list { max-height: var(--models-list-height, 390px); overflow: auto; padding: 5px; }
        .group { padding: 10px 8px 4px; color: var(--models-muted, #646464); font-size: 10px; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
        .model { width: 100%; border: 0; border-radius: 6px; background: transparent; padding: 6px 8px; text-align: left; cursor: pointer; }
        .model:hover { background: var(--models-hover, #f5f5f5); }
        .model[aria-selected="true"] { background: var(--models-selected, #eef4ff); }
        .model-name { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; font-weight: 620; white-space: nowrap; }
        .model-icon { flex: 0 0 16px; width: 16px; height: 16px; color: var(--models-muted, #646464); }
        .model-icon svg { display: block; width: 100%; height: 100%; }
        .model-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .model-qualifier { overflow: hidden; color: var(--models-muted, #646464); font-size: 11px; font-weight: 450; text-overflow: ellipsis; white-space: nowrap; }
        .model-recommendation { color: var(--models-muted, #646464); font-size: 11px; font-weight: 450; }
        .no-results { margin: 16px 8px; color: var(--models-muted, #646464); font-size: 12px; text-align: center; }
        .detail { display: grid; align-content: start; gap: 14px; padding: 16px; min-width: 0; }
        .detail h3 { overflow: hidden; margin: 0; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
        .detail-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
        .detail-name { display: grid; gap: 2px; min-width: 0; overflow: hidden; }
        .detail-name .muted { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .facts { position: relative; }
        .facts summary { list-style: none; cursor: help; color: var(--models-muted, #646464); }
        .facts summary::-webkit-details-marker { display: none; }
        .facts p { position: absolute; right: 0; z-index: 2; width: min(260px, 70vw); margin: 8px 0 0; border: 1px solid var(--models-border, #d6d6d6); border-radius: 6px; padding: 9px; background: var(--models-surface, #fff); box-shadow: 0 8px 24px #0001; color: var(--models-muted, #646464); font-size: 11px; }
        @media (max-width: 640px) { .picker { grid-template-columns: 1fr; } .models { border-right: 0; border-bottom: 1px solid var(--models-border, #d6d6d6); } .list { max-height: 260px; } }
      </style>
      <div class="picker" part="picker">
        <section class="models" part="models">
          <div class="search"><label class="field"><span class="label">Find a model</span><input class="control" type="search" value="${escapeHtml(this.#query)}" placeholder="Search models" aria-controls="models-list"></label></div>
          <div class="list" id="models-list" role="listbox" aria-label="Models">${renderModels(models, selected?.key, this.#groupBy, this.#iconMode, this.#recommendations)}<p class="no-results" role="status" hidden>No matching models</p></div>
        </section>
        <section class="detail" part="detail">
          ${selected === undefined ? '<p class="muted">No models are available.</p>' : renderDetailHead(selected)}
          ${selected === undefined ? "" : "<models-price></models-price><models-options></models-options>"}
        </section>
      </div>
    `;
    const list = this.#root.querySelector<HTMLElement>("[role=listbox]");
    const input = this.#root.querySelector<HTMLInputElement>("input[type=search]");
    input?.addEventListener("input", () => {
      this.#query = input.value;
      this.filter(this.#query);
    });
    input?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.visibleButtons()[0]?.focus();
      }
    });
    list?.addEventListener("keydown", (event) => this.onListKeydown(event));
    for (const button of this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
      button.addEventListener("click", () => {
        const model = models.find((candidate) => candidate.key === button.dataset.key);
        if (model !== undefined) {
          this.#selected = model;
          this.#options = {};
          this.render();
          this.#root
            .querySelector<HTMLButtonElement>(`button[data-key="${CSS.escape(model.key)}"]`)
            ?.focus();
          this.emit();
        }
      });
    }
    const price = this.#root.querySelector("models-price");
    if (price instanceof ModelsPriceElement) {
      price.model = selected;
    }
    const options = this.#root.querySelector("models-options");
    if (options instanceof ModelsOptionsElement) {
      options.model = selected;
      options.groups = this.#groups;
      options.layout = this.#optionsLayout;
      options.value = this.#options;
      options.addEventListener(OPTIONS_CHANGE_EVENT, (event) => {
        this.#options = (event as CustomEvent<OptionValues<ModelDescriptor["options"]>>).detail;
        this.emit();
      });
    }
    this.filter(this.#query);
  }

  private filter(query: string): void {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    for (const button of this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
      const haystack = button.dataset.search ?? "";
      button.hidden = !words.every((word) => haystack.includes(word));
    }
    for (const group of this.#root.querySelectorAll<HTMLElement>("[data-model-group]")) {
      group.hidden = ![...group.querySelectorAll<HTMLButtonElement>("button[data-key]")].some(
        (button) => !button.hidden,
      );
    }
    const hasMatches = this.visibleButtons().length > 0;
    const noResults = this.#root.querySelector<HTMLElement>(".no-results");
    if (noResults !== null) {
      noResults.hidden = hasMatches;
    }
    const detail = this.#root.querySelector<HTMLElement>(".detail");
    if (detail !== null) {
      detail.hidden = !hasMatches;
    }
  }

  private onListKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.#root.querySelector<HTMLInputElement>("input[type=search]")?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const buttons = this.visibleButtons();
    const current = buttons.indexOf(this.#root.activeElement as HTMLButtonElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? Math.min(current + 1, buttons.length - 1)
            : Math.max(current - 1, 0);
    buttons[index]?.focus();
  }

  private visibleButtons(): HTMLButtonElement[] {
    return [...this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")].filter(
      (button) => !button.hidden,
    );
  }

  private emit(): void {
    const value = this.value;
    if (value === undefined) {
      return;
    }
    const optionResult = validateOptions(value.model.options, value.options);
    if (!optionResult.ok || validateConstraints(value.model, value.options).length > 0) {
      return;
    }
    emitSelectionChange(this, value);
  }
}

function renderModel(
  model: ModelDescriptor,
  selected: boolean,
  isDuplicate: boolean,
  iconMode: ModelIconMode,
  recommendations: readonly ModelRecommendation[],
): string {
  const badges = [
    model.capabilities.reasoning.status === "supported" ? "reasoning" : "",
    model.capabilities.tools.status === "supported" ? "tools" : "",
    model.contextWindow === undefined
      ? ""
      : `${Math.round(model.contextWindow.value / 1000)}K context`,
  ].filter(Boolean);
  const search =
    `${model.name} ${model.provider} ${model.id} ${badges.join(" ")}`.toLocaleLowerCase();
  const icon = modelIcon(model, iconMode);
  const recommendationLabels = recommendations
    .filter((candidate) => candidate.model === model.key || candidate.model === model.id)
    .map((candidate) => candidate.label)
    .join(" · ");
  return `<button class="model" part="model${selected ? " selected-model" : ""}" role="option" aria-selected="${selected}" tabindex="${selected ? "0" : "-1"}" title="${escapeHtml(`${model.name} · ${model.id}`)}" data-key="${escapeHtml(model.key)}" data-search="${escapeHtml(`${search} ${recommendationLabels}`)}"><span class="model-name">${icon === "" ? "" : `<span class="model-icon">${icon}</span>`}<span class="model-label">${escapeHtml(model.name)}${recommendationLabels === "" ? "" : ` <span class="model-recommendation">${escapeHtml(recommendationLabels)}</span>`}${isDuplicate ? ` <span class="model-qualifier">· ${escapeHtml(model.id)}</span>` : ""}</span></span></button>`;
}

function renderModels(
  models: readonly ModelDescriptor[],
  selectedKey: string | undefined,
  grouping: ModelGrouping,
  iconMode: ModelIconMode,
  recommendations: readonly ModelRecommendation[],
): string {
  const nameCounts = new Map<string, number>();
  for (const model of models) {
    nameCounts.set(model.name, (nameCounts.get(model.name) ?? 0) + 1);
  }
  const render = (model: ModelDescriptor): string =>
    renderModel(
      model,
      selectedKey === model.key,
      (nameCounts.get(model.name) ?? 0) > 1,
      iconMode,
      recommendations,
    );
  if (grouping === "none") {
    return models.map(render).join("");
  }
  const groups = new Map<string, ModelDescriptor[]>();
  for (const model of models) {
    const group = modelGroup(model, grouping) ?? "Other";
    const values = groups.get(group) ?? [];
    values.push(model);
    groups.set(group, values);
  }
  return [...groups]
    .map(
      ([group, values]) =>
        `<div data-model-group role="group" aria-label="${escapeHtml(group)}"><div class="group" role="presentation">${escapeHtml(group)}</div>${values.map(render).join("")}</div>`,
    )
    .join("");
}

function renderDetailHead(model: ModelDescriptor): string {
  const source = model.sources[0];
  const evidence =
    source === undefined
      ? "No source is listed."
      : `${source.kind} · ${source.retrievedAt.slice(0, 10)} · ${source.scope ?? "provider"}`;
  return `<header class="detail-head" part="detail-heading"><span class="detail-name"><h3 title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</h3><span class="muted" title="${escapeHtml(model.id)}">${escapeHtml(model.id)}</span></span><details class="facts"><summary aria-label="Model evidence" title="Model evidence">ⓘ</summary><p>${escapeHtml(evidence)}</p></details></header>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
