import {
  validateConstraints,
  validateOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ModelSelection,
  type OptionDefinition,
  type OptionValues,
} from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { emitSelectionChange, OPTIONS_CHANGE_EVENT } from "./events.ts";
import { modelGroup } from "./grouping.ts";
import type { ModelGrouping } from "./grouping.ts";
import { modelIcon, type ModelIconMode } from "./icons.ts";
import { ModelsOptionsElement } from "./options.ts";
import { elementStyles } from "./styles.ts";

type ComposerSection = "advanced" | "effort" | "model" | "speed";

/** A compact composer control that reveals model details only when opened. */
export class ModelsComposerElement extends ModelsHTMLElement {
  #catalogs: readonly ModelCatalog[] = [];
  #selected: ModelDescriptor | undefined;
  #options: OptionValues<ModelDescriptor["options"]> = {};
  #isOpen = false;
  #section: ComposerSection | undefined;
  #query = "";
  #groupBy: ModelGrouping = "author";
  #iconMode: ModelIconMode = "none";
  readonly #root: ShadowRoot;
  readonly #onDocumentPointerDown = (event: Event): void => {
    if (this.#isOpen && !event.composedPath().includes(this)) {
      this.#isOpen = false;
      this.#section = undefined;
      this.render();
    }
  };
  readonly #onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.key !== "Escape") {
      return;
    }
    if (this.#section !== undefined) {
      const section = this.#section;
      this.#section = undefined;
      this.render();
      this.#root.querySelector<HTMLButtonElement>(`button[data-section="${section}"]`)?.focus();
      return;
    }
    this.#isOpen = false;
    this.render();
    this.#root.querySelector<HTMLButtonElement>(".trigger")?.focus();
  };
  readonly #onWindowResize = (): void => this.placePopover();

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.addEventListener("keydown", this.#onKeyDown);
  }

  /** Catalogs available to the composer control. */
  get catalogs(): readonly ModelCatalog[] {
    return this.#catalogs;
  }

  set catalogs(value: readonly ModelCatalog[]) {
    this.#catalogs = value;
    const models = languageModels(value);
    if (!models.some((model) => model.key === this.#selected?.key)) {
      this.#selected = preferredModel(models);
      this.#options = {};
    }
    this.#section = undefined;
    this.#query = "";
    this.render();
  }

  /** The current complete model and option selection. */
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

  /** Whether the settings dialog is open. */
  get open(): boolean {
    return this.#isOpen;
  }

  set open(value: boolean) {
    this.#isOpen = value;
    if (!value) {
      this.#section = undefined;
    }
    this.render();
  }

  /** How models are grouped in the searchable model panel. */
  get groupBy(): ModelGrouping {
    return this.#groupBy;
  }

  set groupBy(value: ModelGrouping) {
    this.#groupBy = value;
    this.render();
  }

  /** Which optional brand identity is shown for models. */
  get iconMode(): ModelIconMode {
    return this.#iconMode;
  }

  set iconMode(value: ModelIconMode) {
    this.#iconMode = value;
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
    const selected = this.#selected;
    const effort = selected === undefined ? undefined : findReasoningOption(selected);
    const speed =
      selected === undefined ? undefined : findOption(selected, ["speed.mode", "service.tier"]);
    this.#root.innerHTML = `
      <style>${elementStyles}</style>
      <style>
        :host { display: inline-block; max-width: 100%; }
        button { border: 0; }
        .composer { position: relative; width: max-content; max-width: 100%; }
        .trigger { display: flex; align-items: center; justify-content: center; gap: 6px; width: max-content; max-width: 100%; min-height: 32px; border: 1px solid var(--models-border, #b8b8b2); border-radius: var(--models-radius, 7px); padding: 4px 8px; background: var(--models-surface, #fff); font-size: 12px; font-weight: 590; cursor: pointer; }
        .trigger:hover { background: var(--models-hover, #f5f5f5); }
        .trigger-icon { width: 15px; height: 15px; color: var(--models-muted, #646464); }
        .trigger-icon svg { display: block; width: 100%; height: 100%; }
        .summary { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .summary-detail { color: var(--models-muted, #646464); }
        .chevron { display: grid; place-items: center; align-self: center; flex: 0 0 14px; width: 14px; height: 14px; margin-left: 1px; color: var(--models-muted, #646464); }
        .chevron svg { display: block; width: 100%; height: 100%; }
        .popover { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 10; width: min(340px, calc(100vw - 32px)); }
        .popover[data-horizontal="start"] { right: auto; left: 0; }
        .popover[data-vertical="below"] { top: calc(100% + 8px); bottom: auto; }
        .popover[data-horizontal="overlay"] { right: auto; width: min(340px, calc(100vw - 32px)); }
        .panel { width: 100%; border: 1px solid var(--models-border, #d6d6d6); border-radius: 8px; padding: 5px; background: var(--models-surface, #fff); box-shadow: 0 12px 30px #0003; font-size: 13px; }
        .row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 7px; width: 100%; min-height: 34px; border-radius: 6px; padding: 4px 7px; background: transparent; text-align: left; cursor: pointer; }
        .row:hover, .row[aria-expanded="true"] { background: var(--models-hover, #f5f5f5); }
        .row-value { max-width: 170px; overflow: hidden; color: var(--models-muted, #646464); text-overflow: ellipsis; white-space: nowrap; }
        .advanced-row { margin-top: 4px; border-top: 1px solid var(--models-border, #d6d6d6); border-radius: 0 0 7px 7px; color: var(--models-muted, #646464); }
        .advanced-options { display: block; padding: 3px 5px; }
        .submenu { display: flex; flex-direction: column; width: 100%; max-height: min(440px, var(--models-popover-space, 70vh)); overflow: hidden; border: 1px solid var(--models-border, #d6d6d6); border-radius: 8px; padding: 5px; background: var(--models-surface, #fff); box-shadow: 0 12px 30px #0003; font-size: 13px; }
        .submenu-title { margin: 5px 8px 7px; color: var(--models-muted, #646464); font-size: 12px; font-weight: 650; }
        .submenu-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .back { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 6px; background: transparent; cursor: pointer; }
        .back:hover { background: var(--models-hover, #f5f5f5); }
        .submenu-head .search { flex: 1; margin: 0; }
        .submenu-list { min-height: 0; overflow: auto; overscroll-behavior: contain; }
        .search { margin-bottom: 6px; }
        .choice { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; width: 100%; min-height: 36px; border-radius: 7px; padding: 5px 8px; background: transparent; text-align: left; cursor: pointer; }
        .choice.no-icon { grid-template-columns: minmax(0, 1fr) auto; }
        .choice:hover { background: var(--models-hover, #f5f5f5); }
        .choice-icon { width: 16px; height: 16px; color: var(--models-muted, #646464); }
        .choice-icon svg { display: block; width: 100%; height: 100%; }
        .checkmark { color: var(--models-muted, #646464); }
        .group { padding: 10px 9px 3px; color: var(--models-muted, #646464); font-size: 10px; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
        .empty { margin: 18px 10px; color: var(--models-muted, #646464); text-align: center; }
      </style>
      <div class="composer" part="composer">
        ${this.#isOpen ? `<div class="popover" part="popover" role="dialog" aria-label="Model settings">${this.#section === undefined ? renderMainPanel(selected, effort, speed, this.#options, this.#section) : renderSubmenu(this.#section, this.#catalogs, selected, effort, speed, this.#options, this.#query, this.#groupBy, this.#iconMode)}</div>` : ""}
        <button class="trigger" part="trigger" type="button" aria-haspopup="dialog" aria-expanded="${this.#isOpen}">
          ${selected === undefined ? "" : renderModelIcon(selected, this.#iconMode, "trigger-icon")}
          <span class="summary">${renderSummary(selected, effort, speed, this.#options)}</span>
          <span class="chevron" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        </button>
      </div>
    `;
    this.bindEvents();
    this.bindAdvancedOptions(
      selected,
      [effort?.key, speed?.key].filter((key): key is string => key !== undefined),
    );
    this.placePopover();
  }

  private bindEvents(): void {
    this.#root.querySelector<HTMLButtonElement>(".trigger")?.addEventListener("click", () => {
      this.#isOpen = !this.#isOpen;
      this.#section = undefined;
      this.render();
      if (this.#isOpen) {
        this.#root.querySelector<HTMLButtonElement>(".row")?.focus();
      }
    });
    for (const row of this.#root.querySelectorAll<HTMLButtonElement>("button[data-section]")) {
      row.addEventListener("click", () => {
        const section = row.dataset.section as ComposerSection;
        this.#section = this.#section === section ? undefined : section;
        this.render();
        if (this.#section !== undefined) {
          this.focusSection(this.#section);
        }
      });
    }
    this.#root
      .querySelector<HTMLButtonElement>("button[data-back]")
      ?.addEventListener("click", () => {
        const section = this.#section;
        this.#section = undefined;
        this.render();
        if (section !== undefined) {
          this.#root.querySelector<HTMLButtonElement>(`button[data-section="${section}"]`)?.focus();
        }
      });
    const search = this.#root.querySelector<HTMLInputElement>(".search");
    search?.addEventListener("input", () => {
      this.#query = search.value;
      this.render();
      const nextSearch = this.#root.querySelector<HTMLInputElement>(".search");
      nextSearch?.focus();
      nextSearch?.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
    });
    for (const choice of this.#root.querySelectorAll<HTMLButtonElement>("button[data-model]")) {
      choice.addEventListener("click", () => {
        const model = languageModels(this.#catalogs).find(
          (candidate) => candidate.key === choice.dataset.model,
        );
        if (model === undefined) {
          return;
        }
        this.#selected = model;
        this.#options = {};
        const section = this.#section;
        this.#section = undefined;
        this.#query = "";
        this.render();
        this.emit();
        if (section !== undefined) {
          this.#root.querySelector<HTMLButtonElement>(`button[data-section="${section}"]`)?.focus();
        }
      });
    }
    for (const choice of this.#root.querySelectorAll<HTMLButtonElement>("button[data-option]")) {
      choice.addEventListener("click", () => {
        const key = choice.dataset.option;
        if (key === undefined) {
          return;
        }
        const value = choice.dataset.value;
        const section = this.#section;
        const next = { ...this.#options };
        if (value === undefined || value === "") {
          delete next[key];
        } else {
          const definition = this.#selected?.options.find((option) => option.key === key);
          next[key] = definition?.kind === "boolean" ? value === "true" : value;
        }
        this.#options = next;
        this.#section = undefined;
        this.render();
        this.emit();
        if (section !== undefined) {
          this.#root.querySelector<HTMLButtonElement>(`button[data-section="${section}"]`)?.focus();
        }
      });
    }
  }

  private bindAdvancedOptions(
    selected: ModelDescriptor | undefined,
    excludedKeys: readonly string[],
  ): void {
    const options = this.#root.querySelector("models-options");
    if (!(options instanceof ModelsOptionsElement)) {
      return;
    }
    options.model = selected;
    options.groups = ["reasoning", "speed", "caching", "beta", "generation"];
    options.excludedKeys = excludedKeys;
    options.value = this.#options;
    options.addEventListener(OPTIONS_CHANGE_EVENT, (event) => {
      this.#options = (event as CustomEvent<OptionValues<ModelDescriptor["options"]>>).detail;
      this.emit();
    });
  }

  private focusSection(section: ComposerSection): void {
    if (section === "model") {
      this.#root.querySelector<HTMLInputElement>(".search")?.focus();
      this.#root
        .querySelector<HTMLElement>(`[data-model="${CSS.escape(this.#selected?.key ?? "")}"]`)
        ?.scrollIntoView({ block: "center" });
      return;
    }
    if (section === "advanced") {
      const options = this.#root.querySelector("models-options");
      if (options instanceof ModelsOptionsElement) {
        options.shadowRoot?.querySelector<HTMLElement>("[data-option]")?.focus();
      }
      return;
    }
    this.#root.querySelector<HTMLButtonElement>("button[data-option]")?.focus();
  }

  private placePopover(): void {
    const popover = this.#root.querySelector<HTMLElement>(".popover");
    if (popover === null || !this.isConnected) {
      return;
    }
    const triggerBounds = this.#root
      .querySelector<HTMLButtonElement>(".trigger")
      ?.getBoundingClientRect();
    const bounds =
      triggerBounds !== undefined && triggerBounds.width > 0
        ? triggerBounds
        : this.getBoundingClientRect();
    const margin = 16;
    const width = 340;
    const horizontal =
      bounds.left + width <= window.innerWidth - margin
        ? "start"
        : bounds.right - width >= margin
          ? "end"
          : "overlay";
    popover.dataset.horizontal = horizontal;
    if (horizontal === "overlay") {
      const overlayWidth = Math.min(340, window.innerWidth - margin * 2);
      const maximumLeft = window.innerWidth - margin - overlayWidth;
      const viewportLeft = Math.min(Math.max(bounds.left, margin), maximumLeft);
      popover.style.left = `${viewportLeft - bounds.left}px`;
    } else {
      popover.style.removeProperty("left");
    }
    const measuredHeight = Math.max(popover.getBoundingClientRect().height, popover.scrollHeight);
    const desiredHeight =
      measuredHeight > 0 ? measuredHeight : Math.min(440, window.innerHeight * 0.7);
    const gap = 8;
    const spaceAbove = Math.max(0, bounds.top - margin - gap);
    const spaceBelow = Math.max(0, window.innerHeight - bounds.bottom - margin - gap);
    const vertical =
      desiredHeight <= spaceBelow
        ? "below"
        : desiredHeight <= spaceAbove
          ? "above"
          : spaceAbove >= spaceBelow
            ? "above"
            : "below";
    popover.dataset.vertical = vertical;
    popover.style.setProperty(
      "--models-popover-space",
      `${Math.max(96, vertical === "above" ? spaceAbove : spaceBelow)}px`,
    );
  }

  private emit(): void {
    const selection = this.value;
    if (selection === undefined) {
      return;
    }
    const optionResult = validateOptions(selection.model.options, selection.options);
    if (!optionResult.ok || validateConstraints(selection.model, selection.options).length > 0) {
      return;
    }
    emitSelectionChange(this, selection);
  }
}

function renderMainPanel(
  model: ModelDescriptor | undefined,
  effort: OptionDefinition | undefined,
  speed: OptionDefinition | undefined,
  values: Readonly<Record<string, unknown>>,
  section: ComposerSection | undefined,
): string {
  return `<div class="panel" part="panel">
    ${renderRow("model", "Model", model?.name ?? "Choose", section)}
    ${effort === undefined ? "" : renderRow("effort", quickOptionLabel(effort, "Reasoning"), optionValue(effort, values), section)}
    ${speed === undefined ? "" : renderRow("speed", "Run speed", optionValue(speed, values), section)}
    ${model === undefined || !hasAdvancedOptions(model, [effort?.key, speed?.key]) ? "" : renderRow("advanced", "Advanced", "", section)}
  </div>`;
}

function renderRow(
  section: ComposerSection,
  label: string,
  value: string,
  active: ComposerSection | undefined,
): string {
  return `<button class="row ${section === "advanced" ? "advanced-row" : ""}" part="row" type="button" data-section="${section}" aria-expanded="${active === section}"><span>${escapeHtml(label)}</span><span class="row-value">${escapeHtml(value)}</span><span class="chevron" aria-hidden="true">›</span></button>`;
}

function renderSubmenu(
  section: ComposerSection | undefined,
  catalogs: readonly ModelCatalog[],
  selected: ModelDescriptor | undefined,
  effort: OptionDefinition | undefined,
  speed: OptionDefinition | undefined,
  values: Readonly<Record<string, unknown>>,
  query: string,
  grouping: ModelGrouping,
  iconMode: ModelIconMode,
): string {
  if (section === undefined) {
    return "";
  }
  if (section === "advanced") {
    return '<div class="submenu" part="submenu"><div class="submenu-head"><button class="back" part="back" type="button" data-back aria-label="Back to model settings">‹</button><p class="submenu-title">Advanced</p></div><models-options class="advanced-options"></models-options></div>';
  }
  if (section === "model") {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const models = languageModels(catalogs).filter((model) => {
      const search = `${model.name} ${model.id} ${model.author ?? ""}`.toLocaleLowerCase();
      return words.every((word) => search.includes(word));
    });
    return `<div class="submenu" part="submenu"><div class="submenu-head"><button class="back" part="back" type="button" data-back aria-label="Back to model settings">‹</button><input class="control search" part="search" type="search" aria-label="Search models" placeholder="Search models" value="${escapeHtml(query)}"></div><div class="submenu-list">${models.length === 0 ? '<p class="empty">No matching models</p>' : renderModelChoices(models, selected?.key, grouping, iconMode)}</div></div>`;
  }
  const option = section === "effort" ? effort : speed;
  if (option === undefined || (option.kind !== "boolean" && option.kind !== "enum")) {
    return "";
  }
  const current = values[option.key];
  const choices =
    option.kind === "boolean"
      ? `${renderOptionChoice(option, "true", "On", current)}${renderOptionChoice(option, "false", "Off", current)}`
      : option.values
          .map((value) => renderOptionChoice(option, value, titleCase(value), current))
          .join("");
  return `<div class="submenu" part="submenu" aria-label="${escapeHtml(option.label)}"><div class="submenu-head"><button class="back" part="back" type="button" data-back aria-label="Back to model settings">‹</button><p class="submenu-title">${escapeHtml(option.label)}</p></div>${renderOptionChoice(option, "", "Provider default", current)}${choices}</div>`;
}

function renderModelChoices(
  models: readonly ModelDescriptor[],
  selectedKey: string | undefined,
  grouping: ModelGrouping,
  iconMode: ModelIconMode,
): string {
  if (grouping === "none") {
    return models.map((model) => renderModelChoice(model, selectedKey, iconMode)).join("");
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
        `<div class="group">${escapeHtml(group)}</div>${values.map((model) => renderModelChoice(model, selectedKey, iconMode)).join("")}`,
    )
    .join("");
}

function renderModelChoice(
  model: ModelDescriptor,
  selectedKey: string | undefined,
  iconMode: ModelIconMode,
): string {
  const icon = renderModelIcon(model, iconMode, "choice-icon");
  return `<button class="choice ${icon === "" ? "no-icon" : ""}" part="option" type="button" aria-pressed="${model.key === selectedKey}" data-model="${escapeHtml(model.key)}">${icon}<span>${escapeHtml(model.name)}</span><span class="checkmark">${model.key === selectedKey ? "✓" : ""}</span></button>`;
}

function renderModelIcon(model: ModelDescriptor, mode: ModelIconMode, className: string): string {
  const icon = modelIcon(model, mode);
  return icon === "" ? "" : `<span class="${className}">${icon}</span>`;
}

function renderOptionChoice(
  option: OptionDefinition,
  value: string,
  label: string,
  current: unknown,
): string {
  const candidate = option.kind === "boolean" && value !== "" ? value === "true" : value;
  const isSelected = (current ?? "") === candidate;
  return `<button class="choice" type="button" aria-pressed="${isSelected}" data-option="${escapeHtml(option.key)}" data-value="${escapeHtml(value)}"><span></span><span>${escapeHtml(label)}</span><span class="checkmark">${isSelected ? "✓" : ""}</span></button>`;
}

function renderSummary(
  model: ModelDescriptor | undefined,
  effort: OptionDefinition | undefined,
  speed: OptionDefinition | undefined,
  values: Readonly<Record<string, unknown>>,
): string {
  if (model === undefined) {
    return "Choose a model";
  }
  const details = [effort, speed]
    .filter((option): option is OptionDefinition => option !== undefined)
    .map((option) => selectedOptionSummary(option, values[option.key]))
    .filter((value): value is string => value !== undefined);
  return `${escapeHtml(model.name)}${details.length === 0 ? "" : ` <span class="summary-detail">${escapeHtml(details.join(" · "))}</span>`}`;
}

function optionValue(option: OptionDefinition, values: Readonly<Record<string, unknown>>): string {
  const value = values[option.key];
  return selectedOptionSummary(option, value) ?? "Default";
}

function findOption(model: ModelDescriptor, keys: readonly string[]): OptionDefinition | undefined {
  return model.options.find(
    (option) =>
      keys.includes(option.key) && option.kind === "enum" && option.support.status === "supported",
  );
}

function findReasoningOption(model: ModelDescriptor): OptionDefinition | undefined {
  return (
    findOption(model, ["reasoning.effort", "reasoning.level", "reasoning.mode"]) ??
    model.options.find(
      (option) =>
        option.group === "reasoning" &&
        option.kind === "boolean" &&
        option.support.status === "supported",
    )
  );
}

function hasAdvancedOptions(
  model: ModelDescriptor,
  excludedKeys: readonly (string | undefined)[],
): boolean {
  return model.options.some(
    (option) => option.support.status === "supported" && !excludedKeys.includes(option.key),
  );
}

function quickOptionLabel(option: OptionDefinition, fallback: string): string {
  return option.key === "reasoning.effort" ? "Effort" : option.label || fallback;
}

function selectedOptionSummary(option: OptionDefinition, value: unknown): string | undefined {
  if (option.kind === "boolean" && typeof value === "boolean") {
    return value ? "On" : "Off";
  }
  return typeof value === "string" && value !== "" ? titleCase(value) : undefined;
}

function preferredModel(models: readonly ModelDescriptor[]): ModelDescriptor | undefined {
  return (
    models.find(
      (model) =>
        findOption(model, ["reasoning.effort"]) !== undefined &&
        findOption(model, ["speed.mode", "service.tier"]) !== undefined,
    ) ??
    models.find((model) => findOption(model, ["reasoning.effort"]) !== undefined) ??
    models[0]
  );
}

function languageModels(catalogs: readonly ModelCatalog[]): readonly ModelDescriptor[] {
  return catalogs.flatMap((catalog) => catalog.models).filter((model) => model.kind === "language");
}

function titleCase(value: string): string {
  if (value === "xhigh") {
    return "Extra High";
  }
  return value
    .replaceAll(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
