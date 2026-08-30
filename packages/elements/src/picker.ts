import {
  validateConstraints,
  validateOptions,
  type ModelCatalog,
  type ModelDescriptor,
  type ModelSelection,
  type OptionValues,
} from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { emitSelectionChange, OPTIONS_CHANGE_EVENT } from "./events.ts";
import type { VisibleOptionGroup } from "./options.ts";
import { ModelsOptionsElement } from "./options.ts";
import { ModelsPriceElement } from "./price.ts";
import { elementStyles } from "./styles.ts";

/** A searchable, composed model picker with optional detail groups and pricing. */
export class ModelsPickerElement extends ModelsHTMLElement {
  #catalogs: readonly ModelCatalog[] = [];
  #selected: ModelDescriptor | undefined;
  #options: OptionValues<ModelDescriptor["options"]> = {};
  #groups: readonly VisibleOptionGroup[] = ["reasoning", "speed", "caching", "beta"];
  #query = "";
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
    if (this.#selected === undefined) {
      this.#selected = value.flatMap((catalog) => catalog.models)[0];
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
        .picker { display: grid; grid-template-columns: minmax(240px, .9fr) minmax(280px, 1.1fr); border: 1px solid var(--models-border, #d6d6d6); border-radius: var(--models-panel-radius, 10px); overflow: hidden; background: var(--models-surface, #fff); }
        .models { min-width: 0; border-right: 1px solid var(--models-border, #d6d6d6); }
        .search { padding: 12px; border-bottom: 1px solid var(--models-border, #d6d6d6); }
        .list { max-height: var(--models-list-height, 390px); overflow: auto; padding: 6px; }
        .model { width: 100%; border: 0; border-radius: 6px; background: transparent; padding: 9px; text-align: left; cursor: pointer; }
        .model:hover { background: var(--models-hover, #f5f5f5); }
        .model[aria-selected="true"] { background: var(--models-selected, #eef4ff); }
        .model-name { display: flex; justify-content: space-between; gap: 8px; font-weight: 650; }
        .meta { display: flex; gap: 5px; margin-top: 4px; overflow: hidden; }
        .detail { display: grid; align-content: start; gap: 18px; padding: 18px; min-width: 0; }
        .detail h3 { margin: 0; font-size: 17px; }
        .detail-head { display: grid; gap: 5px; }
        .source { font-size: 11px; color: var(--models-muted, #646464); }
        @media (max-width: 640px) { .picker { grid-template-columns: 1fr; } .models { border-right: 0; border-bottom: 1px solid var(--models-border, #d6d6d6); } .list { max-height: 260px; } }
      </style>
      <div class="picker" part="picker">
        <section class="models" part="models">
          <div class="search"><label class="field"><span class="label">Find a model</span><input class="control" type="search" value="${escapeHtml(this.#query)}" placeholder="Name, provider, capability" aria-controls="models-list"></label></div>
          <div class="list" id="models-list" role="listbox" aria-label="Models">${models.map((model) => renderModel(model, selected?.key === model.key)).join("")}</div>
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

function renderModel(model: ModelDescriptor, selected: boolean): string {
  const badges = [
    model.capabilities.reasoning.status === "supported" ? "reasoning" : "",
    model.capabilities.tools.status === "supported" ? "tools" : "",
    model.contextWindow === undefined
      ? ""
      : `${Math.round(model.contextWindow.value / 1000)}K context`,
  ].filter(Boolean);
  const search =
    `${model.name} ${model.provider} ${model.id} ${badges.join(" ")}`.toLocaleLowerCase();
  return `<button class="model" part="model${selected ? " selected-model" : ""}" role="option" aria-selected="${selected}" tabindex="${selected ? "0" : "-1"}" data-key="${escapeHtml(model.key)}" data-search="${escapeHtml(search)}"><span class="model-name"><span>${escapeHtml(model.name)}</span><span class="muted">${escapeHtml(model.provider)}</span></span><span class="meta">${badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join("")}</span></button>`;
}

function renderDetailHead(model: ModelDescriptor): string {
  const source = model.sources[0];
  return `<header class="detail-head" part="detail-heading"><h3>${escapeHtml(model.name)}</h3><span class="muted">${escapeHtml(model.id)}</span><span class="source">${source === undefined ? "No source" : `${source.kind} · ${source.retrievedAt.slice(0, 10)} · ${source.scope ?? "provider"}`}</span></header>`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
