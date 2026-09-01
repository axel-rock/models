import type { ModelCatalog, ModelDescriptor, ModelRecommendation } from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { emitModelChange, emitModelClear } from "./events.ts";
import { modelGroup, type ModelGrouping } from "./grouping.ts";
import { modelIcon, type ModelIconMode } from "./icons.ts";
import { elementStyles } from "./styles.ts";

/** Visual density of the model control. */
export type SelectDensity = "compact" | "default";

let nextListId = 0;

/** A compact, accessible, searchable model combobox. */
export class ModelsSelectElement extends ModelsHTMLElement {
  #catalogs: readonly ModelCatalog[] = [];
  #value = "";
  #groupBy: ModelGrouping = "none";
  #density: SelectDensity = "default";
  #iconMode: ModelIconMode = "none";
  #recommendations: readonly ModelRecommendation[] = [];
  #isOpen = false;
  #ignoreNextFocus = false;
  #query = "";
  #activeKey: string | undefined;
  readonly #listId = `models-select-list-${nextListId++}`;
  readonly #root: ShadowRoot;
  readonly #onDocumentPointerDown = (event: Event): void => {
    if (this.#isOpen && !event.composedPath().includes(this)) {
      this.#isOpen = false;
      this.#query = "";
      this.#activeKey = undefined;
      this.render();
    }
  };
  readonly #onWindowResize = (): void => this.placeList();
  readonly #onFocusOut = (event: Event): void => {
    if (!(event instanceof FocusEvent)) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && this.#root.contains(next)) {
      return;
    }
    this.#isOpen = false;
    this.#query = "";
    this.#activeKey = undefined;
    this.render();
  };

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.addEventListener("focusout", this.#onFocusOut);
  }

  /** Catalogs shown by the search. Pass rich values through this property. */
  get catalogs(): readonly ModelCatalog[] {
    return this.#catalogs;
  }

  set catalogs(value: readonly ModelCatalog[]) {
    this.#catalogs = value;
    if (!value.some((catalog) => catalog.models.some((model) => model.key === this.#value))) {
      this.#value = "";
    }
    this.#query = "";
    this.#activeKey = undefined;
    this.render();
  }

  /** The selected provider-qualified model key. */
  get value(): string {
    return this.#value;
  }

  set value(value: string) {
    this.#value = value;
    this.#query = "";
    this.#activeKey = undefined;
    this.render();
  }

  /** Optional grouping used inside the open model list. */
  get groupBy(): ModelGrouping {
    return this.#groupBy;
  }

  set groupBy(value: ModelGrouping) {
    this.#groupBy = value;
    this.render();
  }

  /** Visual density of the model control. Compact mode fits a chat composer. */
  get density(): SelectDensity {
    return this.#density;
  }

  set density(value: SelectDensity) {
    this.#density = value;
    this.render();
  }

  /** Whether model-maker marks are shown beside models. */
  get iconMode(): ModelIconMode {
    return this.#iconMode;
  }

  set iconMode(value: ModelIconMode) {
    this.#iconMode = value;
    this.render();
  }

  /** Application-owned labels shown above the ordinary model groups. */
  get recommendations(): readonly ModelRecommendation[] {
    return this.#recommendations;
  }

  set recommendations(value: readonly ModelRecommendation[]) {
    this.#recommendations = value;
    this.render();
  }

  connectedCallback(): void {
    document.addEventListener("pointerdown", this.#onDocumentPointerDown);
    window.addEventListener("resize", this.#onWindowResize);
    this.render();
  }

  disconnectedCallback(): void {
    document.removeEventListener("pointerdown", this.#onDocumentPointerDown);
    window.removeEventListener("resize", this.#onWindowResize);
  }

  private render(): void {
    const models = languageModels(this.#catalogs);
    const suggestions = modelSuggestions(models, this.#listId, this.#recommendations);
    const selected = models.find((model) => model.key === this.#value);
    const selectedSuggestion = suggestions.find(
      (suggestion) => suggestion.model.key === this.#value,
    );
    const displayValue = this.#isOpen ? this.#query : (selectedSuggestion?.value ?? "");
    const icon = selected === undefined || this.#isOpen ? "" : modelIcon(selected, this.#iconMode);
    this.#root.innerHTML = `
      <style>${elementStyles}</style>
      <style>
        :host { position: relative; display: ${this.#density === "compact" ? "inline-block" : "block"}; width: ${this.#density === "compact" ? "min(260px, 100%)" : "auto"}; }
        .field { width: 100%; }
        .search-shell { position: relative; display: flex; align-items: center; width: 100%; min-width: 0; }
        .search-icon { position: absolute; left: 9px; z-index: 1; width: 16px; height: 16px; color: var(--models-muted, #646464); pointer-events: none; }
        .search-icon svg { display: block; width: 100%; height: 100%; }
        .search-shell.has-icon .control { padding-left: 31px; }
        .control { padding-right: 30px; }
        .control::-webkit-search-cancel-button { display: none; appearance: none; }
        .caret { position: absolute; right: 9px; display: grid; place-items: center; width: 14px; height: 14px; color: var(--models-muted, #646464); pointer-events: none; transition: transform 120ms ease; }
        .caret.open { transform: rotate(180deg); }
        .caret svg { display: block; width: 100%; height: 100%; }
        .compact .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .compact .control { min-height: 32px; width: 100%; padding-top: 3px; padding-bottom: 3px; border-radius: 7px; font-size: 12px; font-weight: 580; }
        .list { position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; width: min(340px, calc(100vw - 32px)); max-height: min(360px, var(--models-list-space, 60vh)); overflow: auto; border: 1px solid var(--models-border, #d6d6d6); border-radius: 9px; padding: 5px; background: var(--models-surface, #fff); box-shadow: 0 14px 36px #0003; }
        .list.above { top: auto; bottom: calc(100% + 6px); }
        .group { padding: 9px 8px 4px; color: var(--models-muted, #646464); font-size: 10px; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
        .option { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; width: 100%; min-height: 34px; border: 0; border-radius: 6px; padding: 5px 8px; background: transparent; font-size: 13px; text-align: left; cursor: pointer; }
        .option.no-icon { grid-template-columns: minmax(0, 1fr) auto; }
        .option:hover, .option.active { background: var(--models-hover, #f5f5f5); }
        .option[aria-selected="true"] { background: var(--models-selected, #eef4ff); }
        .option-icon { width: 16px; height: 16px; color: var(--models-muted, #646464); }
        .option-icon svg { display: block; width: 100%; height: 100%; }
        .option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .option-meta { margin-left: 5px; color: var(--models-muted, #646464); font-size: 11px; font-weight: 450; }
        .check { color: var(--models-muted, #646464); }
        .empty { margin: 18px 10px; color: var(--models-muted, #646464); font-size: 12px; text-align: center; }
      </style>
      <label class="field ${this.#density === "compact" ? "compact" : ""}" part="field">
        <span class="label" part="label">${escapeHtml(this.getAttribute("label") ?? "Model")}</span>
        <span class="search-shell ${icon === "" ? "" : "has-icon"}">
          ${icon === "" ? "" : `<span class="search-icon" aria-hidden="true">${icon}</span>`}
          <input class="control" part="input" type="search" role="combobox" aria-autocomplete="list" aria-controls="${this.#listId}" aria-expanded="${this.#isOpen}"${this.#activeKey === undefined ? "" : ` aria-activedescendant="${escapeHtml(suggestions.find((suggestion) => suggestion.model.key === this.#activeKey)?.optionId ?? "")}"`} autocomplete="off" placeholder="Search models" value="${escapeHtml(displayValue)}" />
          <span class="caret ${this.#isOpen ? "open" : ""}" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </span>
      </label>
      ${this.#isOpen ? `<div class="list" id="${this.#listId}" role="listbox" aria-label="Models">${renderSuggestions(suggestions, this.#value, this.#activeKey, this.#groupBy, this.#iconMode)}</div>` : ""}
    `;
    this.bindEvents(suggestions);
    this.placeList();
  }

  private bindEvents(suggestions: readonly ModelSuggestion[]): void {
    const input = this.#root.querySelector<HTMLInputElement>("input");
    if (input === null) {
      return;
    }
    input.addEventListener("focus", () => {
      if (this.#ignoreNextFocus) {
        this.#ignoreNextFocus = false;
        return;
      }
      this.open();
    });
    input.addEventListener("click", () => this.open());
    input.addEventListener("input", () => {
      this.#query = input.value;
      this.#activeKey = undefined;
      if (!this.#isOpen) {
        this.#isOpen = true;
        this.render();
        const nextInput = this.#root.querySelector<HTMLInputElement>("input");
        nextInput?.focus();
        nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
        return;
      }
      this.filter(input.value);
    });
    input.addEventListener("keydown", (event) => this.onInputKeydown(event, suggestions));
    for (const option of this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => {
        const suggestion = suggestions.find(
          (candidate) => candidate.model.key === option.dataset.key,
        );
        if (suggestion !== undefined) {
          this.select(suggestion);
        }
      });
    }
    this.filter(this.#query);
  }

  private open(): void {
    if (this.#isOpen) {
      return;
    }
    this.#isOpen = true;
    this.#query = "";
    this.#activeKey = this.#value || undefined;
    this.render();
    this.#root.querySelector<HTMLInputElement>("input")?.focus();
    this.#root
      .querySelector<HTMLElement>(`[data-key="${CSS.escape(this.#value)}"]`)
      ?.scrollIntoView({ block: "center" });
  }

  private select(suggestion: ModelSuggestion): void {
    const hasChanged = this.#value !== suggestion.model.key;
    this.#value = suggestion.model.key;
    this.#isOpen = false;
    this.#query = "";
    this.#activeKey = undefined;
    this.render();
    this.focusClosedInput();
    if (hasChanged) {
      emitModelChange(this, suggestion.model);
    }
  }

  private clear(): void {
    if (this.#value === "") {
      return;
    }
    this.#value = "";
    emitModelClear(this);
  }

  private filter(query: string): void {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    for (const option of this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")) {
      option.hidden = !words.every((word) => (option.dataset.search ?? "").includes(word));
    }
    for (const group of this.#root.querySelectorAll<HTMLElement>("[data-model-group]")) {
      group.hidden = ![...group.querySelectorAll<HTMLButtonElement>("button[data-key]")].some(
        (option) => !option.hidden,
      );
    }
    const empty = this.#root.querySelector<HTMLElement>(".empty");
    if (empty !== null) {
      empty.hidden = this.visibleOptions().length > 0;
    }
  }

  private onInputKeydown(event: KeyboardEvent, suggestions: readonly ModelSuggestion[]): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.#isOpen = false;
      this.#query = "";
      this.#activeKey = undefined;
      this.render();
      this.focusClosedInput();
      return;
    }
    if (!this.#isOpen && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      this.open();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const input = event.currentTarget;
      const match = suggestions.find(
        (suggestion) =>
          suggestion.model.key === this.#activeKey ||
          (input instanceof HTMLInputElement && suggestion.value === input.value),
      );
      if (match !== undefined) {
        this.select(match);
      }
      return;
    }
    if (
      event.key === "Backspace" &&
      event.currentTarget instanceof HTMLInputElement &&
      event.currentTarget.value === ""
    ) {
      this.clear();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const options = this.visibleOptions();
    if (options.length === 0) {
      return;
    }
    const current = options.findIndex((option) => option.dataset.key === this.#activeKey);
    const next =
      event.key === "ArrowDown"
        ? current < options.length - 1
          ? current + 1
          : 0
        : current > 0
          ? current - 1
          : options.length - 1;
    this.#activeKey = options[next]?.dataset.key;
    const input = this.#root.querySelector<HTMLInputElement>("input");
    const active = options[next];
    if (input !== null && active !== undefined) {
      input.setAttribute("aria-activedescendant", active.id);
    }
    for (const option of options) {
      option.classList.toggle("active", option.dataset.key === this.#activeKey);
    }
    options[next]?.scrollIntoView({ block: "nearest" });
  }

  private visibleOptions(): HTMLButtonElement[] {
    return [...this.#root.querySelectorAll<HTMLButtonElement>("button[data-key]")].filter(
      (option) => !option.hidden,
    );
  }

  private focusClosedInput(): void {
    this.#ignoreNextFocus = true;
    this.#root.querySelector<HTMLInputElement>("input")?.focus();
  }

  private placeList(): void {
    const list = this.#root.querySelector<HTMLElement>(".list");
    const input = this.#root.querySelector<HTMLInputElement>("input");
    if (list === null || input === null || !this.isConnected) {
      return;
    }
    const bounds = input.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(340, window.innerWidth - margin * 2);
    const maximumLeft = window.innerWidth - margin - width;
    const viewportLeft = Math.min(Math.max(bounds.left, margin), maximumLeft);
    list.style.left = `${viewportLeft - bounds.left}px`;
    const spaceAbove = bounds.top - margin - 6;
    const spaceBelow = window.innerHeight - bounds.bottom - margin - 6;
    const isAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
    list.classList.toggle("above", isAbove);
    list.style.setProperty(
      "--models-list-space",
      `${Math.max(120, isAbove ? spaceAbove : spaceBelow)}px`,
    );
  }
}

interface ModelSuggestion {
  readonly model: ModelDescriptor;
  readonly optionId: string;
  readonly recommendationLabels: readonly string[];
  readonly value: string;
  readonly qualifier: string | undefined;
}

function languageModels(catalogs: readonly ModelCatalog[]): readonly ModelDescriptor[] {
  return catalogs.flatMap((catalog) => catalog.models).filter((model) => model.kind === "language");
}

function modelSuggestions(
  models: readonly ModelDescriptor[],
  listId: string,
  recommendations: readonly ModelRecommendation[],
): readonly ModelSuggestion[] {
  const nameCounts = new Map<string, number>();
  for (const model of models) {
    nameCounts.set(model.name, (nameCounts.get(model.name) ?? 0) + 1);
  }
  const baseValues = models.map((model) =>
    nameCounts.get(model.name) === 1 ? model.name : `${model.name} · ${model.id}`,
  );
  const baseCounts = new Map<string, number>();
  for (const value of baseValues) {
    baseCounts.set(value, (baseCounts.get(value) ?? 0) + 1);
  }
  const usedValues = new Map<string, number>();
  return models.map((model, index) => {
    const baseValue = baseValues[index] ?? model.name;
    const qualified = baseCounts.get(baseValue) === 1 ? baseValue : `${baseValue} · ${model.key}`;
    const seen = usedValues.get(qualified) ?? 0;
    usedValues.set(qualified, seen + 1);
    const value = seen === 0 ? qualified : `${qualified} · ${seen + 1}`;
    return {
      model,
      optionId: `${listId}-option-${index}`,
      recommendationLabels: recommendations
        .filter((recommendation) => [model.key, model.id].includes(recommendation.model))
        .map((recommendation) => recommendation.label),
      value,
      qualifier: value === model.name ? undefined : value.slice(model.name.length + 3),
    };
  });
}

function renderSuggestions(
  suggestions: readonly ModelSuggestion[],
  selectedKey: string,
  activeKey: string | undefined,
  grouping: ModelGrouping,
  iconMode: ModelIconMode,
): string {
  const empty = '<p class="empty" role="status" hidden>No matching models</p>';
  const recommended = suggestions.filter(
    (suggestion) => suggestion.recommendationLabels.length > 0,
  );
  const ordinary = suggestions.filter((suggestion) => suggestion.recommendationLabels.length === 0);
  const recommendationGroup =
    recommended.length === 0
      ? ""
      : `<div data-model-group><div class="group">Recommended</div>${recommended.map((suggestion) => renderSuggestion(suggestion, selectedKey, activeKey, iconMode)).join("")}</div>`;
  if (grouping === "none") {
    const ordinaryGroup =
      ordinary.length === 0
        ? ""
        : `<div data-model-group>${recommended.length === 0 ? "" : '<div class="group">All models</div>'}${ordinary.map((suggestion) => renderSuggestion(suggestion, selectedKey, activeKey, iconMode)).join("")}</div>`;
    return `${recommendationGroup}${ordinaryGroup}${empty}`;
  }
  const groups = new Map<string, ModelSuggestion[]>();
  for (const suggestion of ordinary) {
    const group = modelGroup(suggestion.model, grouping) ?? "Other";
    const values = groups.get(group) ?? [];
    values.push(suggestion);
    groups.set(group, values);
  }
  return `${recommendationGroup}${[...groups]
    .map(
      ([group, values]) =>
        `<div data-model-group><div class="group">${escapeHtml(group)}</div>${values.map((suggestion) => renderSuggestion(suggestion, selectedKey, activeKey, iconMode)).join("")}</div>`,
    )
    .join("")}${empty}`;
}

function renderSuggestion(
  suggestion: ModelSuggestion,
  selectedKey: string,
  activeKey: string | undefined,
  iconMode: ModelIconMode,
): string {
  const icon = modelIcon(suggestion.model, iconMode);
  const isSelected = suggestion.model.key === selectedKey;
  const metadata = [suggestion.qualifier, ...suggestion.recommendationLabels].filter(
    (value): value is string => value !== undefined,
  );
  return `<button class="option ${icon === "" ? "no-icon" : ""} ${suggestion.model.key === activeKey ? "active" : ""}" id="${escapeHtml(suggestion.optionId)}" type="button" role="option" aria-selected="${isSelected}" data-key="${escapeHtml(suggestion.model.key)}" data-search="${escapeHtml(`${suggestion.model.name} ${suggestion.model.id} ${suggestion.model.author ?? ""} ${suggestion.recommendationLabels.join(" ")}`.toLocaleLowerCase())}">${icon === "" ? "" : `<span class="option-icon" aria-hidden="true">${icon}</span>`}<span class="option-label">${escapeHtml(suggestion.model.name)}${metadata.length === 0 ? "" : `<span class="option-meta">· ${escapeHtml(metadata.join(" · "))}</span>`}</span><span class="check" aria-hidden="true">${isSelected ? "✓" : ""}</span></button>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
