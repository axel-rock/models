import {
  validateConstraints,
  validateOptions,
  type ModelDescriptor,
  type OptionDefinition,
  type OptionValues,
} from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { OPTIONS_CHANGE_EVENT } from "./events.ts";
import { elementStyles } from "./styles.ts";

/** Option groups that a host can choose to show. */
export type VisibleOptionGroup = OptionDefinition["group"];

/** Layout of generated model options. */
export type OptionsLayout = "inline" | "stacked";

/** Framework-neutral controls generated from a model's option schema. */
export class ModelsOptionsElement extends ModelsHTMLElement {
  #model: ModelDescriptor | undefined;
  #values: Readonly<Record<string, unknown>> = {};
  #groups: readonly VisibleOptionGroup[] = [
    "reasoning",
    "speed",
    "routing",
    "caching",
    "beta",
    "generation",
  ];
  #excludedKeys: readonly string[] = [];
  #layout: OptionsLayout = "stacked";
  readonly #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  /** The model whose options should be displayed. */
  get model(): ModelDescriptor | undefined {
    return this.#model;
  }

  set model(value: ModelDescriptor | undefined) {
    this.#model = value;
    this.render();
  }

  /** Current option values. */
  get value(): Readonly<Record<string, unknown>> {
    return this.#values;
  }

  set value(value: Readonly<Record<string, unknown>>) {
    this.#values = value;
    this.render();
  }

  /** Groups included by this instance. */
  get groups(): readonly VisibleOptionGroup[] {
    return this.#groups;
  }

  set groups(value: readonly VisibleOptionGroup[]) {
    this.#groups = value;
    this.render();
  }

  /** Option keys omitted by this instance. Useful when quick controls render them elsewhere. */
  get excludedKeys(): readonly string[] {
    return this.#excludedKeys;
  }

  set excludedKeys(value: readonly string[]) {
    this.#excludedKeys = value;
    this.render();
  }

  /** Layout of the generated controls. Inline mode fits a chat composer. */
  get layout(): OptionsLayout {
    return this.#layout;
  }

  set layout(value: OptionsLayout) {
    this.#layout = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const model = this.#model;
    const options =
      model?.options.filter(
        (option) =>
          option.support.status === "supported" &&
          this.#groups.includes(option.group) &&
          !this.#excludedKeys.includes(option.key) &&
          isOptionVisible(option, model.options, this.#values),
      ) ?? [];
    if (this.#layout === "inline" && options.length === 0) {
      this.hidden = true;
      this.#root.innerHTML = "";
      return;
    }
    this.hidden = false;
    this.#root.innerHTML = `
      <style>
        ${elementStyles}
        .options { display: grid; gap: 10px; }
        .options.inline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .inline .field { display: flex; align-items: center; gap: 2px; min-height: 32px; border: 1px solid var(--models-border, #b8b8b2); border-radius: var(--models-radius, 7px); background: var(--models-surface, #fff); }
        .inline .field > .label { padding-left: 9px; color: var(--models-muted, #646464); font-size: 11px; font-weight: 550; white-space: nowrap; }
        .inline .control { min-height: 30px; width: auto; max-width: 150px; border: 0; padding: 3px 25px 3px 5px; background: transparent; font-size: 12px; font-weight: 620; }
        .option-shell { position: relative; display: flex; align-items: center; }
        .inline .check { min-height: 32px; border: 1px solid var(--models-border, #b8b8b2); border-radius: var(--models-radius, 7px); padding: 4px 8px 4px 9px; font-size: 12px; }
        .inline .check input { order: 2; margin: 0 0 0 4px; accent-color: var(--models-focus, #2563eb); }
        .empty { margin: 0; }
        .check { display: flex; align-items: center; gap: 8px; min-height: 36px; }
        .help { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .requirements { border-top: 1px solid var(--models-border, #d6d6d6); padding-top: 12px; }
        .requirements summary { cursor: pointer; color: var(--models-muted, #646464); font-size: 12px; font-weight: 650; }
        .requirements ul { margin: 8px 0 0; padding-left: 18px; color: var(--models-muted, #646464); font-size: 12px; }
        .issues { margin: 0; padding: 10px 12px 10px 28px; border: 1px solid var(--models-warning-border, #e6c66a); border-radius: 6px; background: var(--models-warning-surface, #fff9e8); color: var(--models-warning-text, #684f00); font-size: 12px; }
      </style>
      <div class="options ${this.#layout}" part="options">
        ${options.length === 0 ? '<p class="empty muted">No selectable details for this view.</p>' : options.map((option) => renderOption(option, this.#values[option.key], this.#layout)).join("")}
        ${renderIssues(model, this.#values)}
        ${this.#layout === "stacked" ? renderRequirements(model) : ""}
      </div>
    `;
    for (const control of this.#root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "[data-option]",
    )) {
      control.addEventListener("change", () => this.onChange(control));
    }
  }

  private onChange(control: HTMLInputElement | HTMLSelectElement): void {
    const key = control.dataset.option;
    const model = this.#model;
    if (key === undefined || model === undefined) {
      return;
    }
    const definition = model.options.find((option) => option.key === key);
    if (definition === undefined) {
      return;
    }
    const next = { ...this.#values };
    const value = readControlValue(control, definition);
    if (value === undefined || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    this.#values = next;
    this.dispatchEvent(
      new CustomEvent(OPTIONS_CHANGE_EVENT, {
        detail: next as OptionValues<typeof model.options>,
        bubbles: true,
        composed: true,
      }),
    );
    this.render();
    this.#root.querySelector<HTMLElement>(`[data-option="${CSS.escape(key)}"]`)?.focus();
  }
}

function renderIssues(
  model: ModelDescriptor | undefined,
  values: Readonly<Record<string, unknown>>,
): string {
  if (model === undefined) {
    return "";
  }
  const optionResult = validateOptions(model.options, values);
  const issues = [
    ...(optionResult.ok ? [] : optionResult.issues),
    ...validateConstraints(model, values),
  ];
  return issues.length === 0
    ? ""
    : `<ul class="issues" role="alert">${issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul>`;
}

function renderOption(option: OptionDefinition, value: unknown, layout: OptionsLayout): string {
  const id = `models-option-${safeId(option.key)}`;
  if (option.kind === "boolean") {
    const input = `<input data-option="${escapeHtml(option.key)}" type="checkbox" ${value === true ? "checked" : ""}>`;
    const text = `<span><strong>${escapeHtml(option.label)}</strong><span class="help">${escapeHtml(option.description)}</span></span>`;
    return `<label class="check" part="option" title="${escapeHtml(option.description)}">${layout === "inline" ? `${text}${input}` : `${input}${text}`}</label>`;
  }
  const control =
    option.kind === "enum"
      ? `<select id="${id}" class="control" data-option="${escapeHtml(option.key)}"><option value="">Provider default</option>${option.values.map((candidate) => `<option value="${escapeHtml(candidate)}" ${candidate === value ? "selected" : ""}>${escapeHtml(candidate)}</option>`).join("")}</select>`
      : option.kind === "string-list"
        ? `<input id="${id}" class="control" data-option="${escapeHtml(option.key)}" value="${escapeHtml(Array.isArray(value) ? value.join(", ") : "")}"${layout === "inline" ? "" : ` placeholder="${escapeHtml(option.label)}"`}>`
        : `<input id="${id}" class="control" data-option="${escapeHtml(option.key)}" type="number" ${option.min === undefined ? "" : `min="${option.min}"`} ${option.max === undefined ? "" : `max="${option.max}"`} ${option.step === undefined ? "" : `step="${option.step}"`} value="${typeof value === "number" ? value : ""}"${layout === "inline" ? "" : ` placeholder="${escapeHtml(option.label)}"`}>`;
  return `<label class="field" part="option" for="${id}" title="${escapeHtml(option.description)}"><span class="label">${escapeHtml(option.label)}</span><span class="option-shell">${control}</span><span class="help">${escapeHtml(option.description)}</span></label>`;
}

function isOptionVisible(
  option: OptionDefinition,
  options: readonly OptionDefinition[],
  values: Readonly<Record<string, unknown>>,
): boolean {
  if (
    option.visibleWhen !== undefined &&
    values[option.visibleWhen.key] !== option.visibleWhen.equals
  ) {
    return false;
  }
  if (!option.key.endsWith("maxTokens")) {
    return true;
  }
  const toggle = options.find(
    (candidate) =>
      candidate.group === option.group &&
      candidate.kind === "boolean" &&
      candidate.key.endsWith("enabled"),
  );
  return toggle === undefined || values[toggle.key] === true;
}

function renderRequirements(model: ModelDescriptor | undefined): string {
  if (model === undefined || model.requirements.length === 0) {
    return "";
  }
  return `<details class="requirements" part="requirements"><summary>Integration notes · ${model.requirements.length}</summary><ul>${model.requirements.map((requirement) => `<li><strong>${escapeHtml(requirement.title)}:</strong> ${escapeHtml(requirement.description)}</li>`).join("")}</ul></details>`;
}

function readControlValue(
  control: HTMLInputElement | HTMLSelectElement,
  definition: OptionDefinition,
): unknown {
  if (definition.kind === "boolean" && control instanceof HTMLInputElement) {
    return control.checked;
  }
  if ((definition.kind === "number" || definition.kind === "integer") && control.value !== "") {
    return Number(control.value);
  }
  if (definition.kind === "string-list") {
    return control.value
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return control.value;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
