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

/** Framework-neutral controls generated from a model's option schema. */
export class ModelsOptionsElement extends ModelsHTMLElement {
  #model: ModelDescriptor | undefined;
  #values: Readonly<Record<string, unknown>> = {};
  #groups: readonly VisibleOptionGroup[] = ["reasoning", "speed", "caching", "beta", "generation"];
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
          (option.visibleWhen === undefined ||
            this.#values[option.visibleWhen.key] === option.visibleWhen.equals),
      ) ?? [];
    this.#root.innerHTML = `
      <style>
        ${elementStyles}
        .options { display: grid; gap: 14px; }
        .empty { margin: 0; }
        .check { display: flex; align-items: center; gap: 8px; }
        .help { margin: 0; font-size: 12px; }
        .requirements { border-top: 1px solid var(--models-border, #d6d6d6); padding-top: 12px; }
        .requirements h4 { margin: 0 0 6px; font-size: 12px; }
        .requirements ul { margin: 0; padding-left: 18px; color: var(--models-muted, #646464); }
        .issues { margin: 0; padding: 10px 12px 10px 28px; border: 1px solid var(--models-warning-border, #e6c66a); border-radius: 6px; background: var(--models-warning-surface, #fff9e8); color: var(--models-warning-text, #684f00); font-size: 12px; }
      </style>
      <div class="options" part="options">
        ${options.length === 0 ? '<p class="empty muted">No selectable details for this view.</p>' : options.map((option) => renderOption(option, this.#values[option.key])).join("")}
        ${renderIssues(model, this.#values)}
        ${renderRequirements(model)}
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

function renderOption(option: OptionDefinition, value: unknown): string {
  const id = `models-option-${safeId(option.key)}`;
  if (option.kind === "boolean") {
    return `<label class="check" part="option"><input data-option="${escapeHtml(option.key)}" type="checkbox" ${value === true ? "checked" : ""}><span><strong>${escapeHtml(option.label)}</strong><br><span class="muted">${escapeHtml(option.description)}</span></span></label>`;
  }
  const control =
    option.kind === "enum"
      ? `<select id="${id}" class="control" data-option="${escapeHtml(option.key)}"><option value="">Provider default</option>${option.values.map((candidate) => `<option value="${escapeHtml(candidate)}" ${candidate === value ? "selected" : ""}>${escapeHtml(candidate)}</option>`).join("")}</select>`
      : option.kind === "string-list"
        ? `<input id="${id}" class="control" data-option="${escapeHtml(option.key)}" value="${escapeHtml(Array.isArray(value) ? value.join(", ") : "")}" placeholder="feature-one, feature-two">`
        : `<input id="${id}" class="control" data-option="${escapeHtml(option.key)}" type="number" ${option.min === undefined ? "" : `min="${option.min}"`} ${option.max === undefined ? "" : `max="${option.max}"`} ${option.step === undefined ? "" : `step="${option.step}"`} value="${typeof value === "number" ? value : ""}">`;
  return `<label class="field" part="option" for="${id}"><span class="label">${escapeHtml(option.label)}</span>${control}<span class="help muted">${escapeHtml(option.description)}</span></label>`;
}

function renderRequirements(model: ModelDescriptor | undefined): string {
  if (model === undefined || model.requirements.length === 0) {
    return "";
  }
  return `<section class="requirements" part="requirements"><h4>Integration notes</h4><ul>${model.requirements.map((requirement) => `<li><strong>${escapeHtml(requirement.title)}:</strong> ${escapeHtml(requirement.description)}</li>`).join("")}</ul></section>`;
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
