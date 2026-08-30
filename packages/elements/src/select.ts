import type { ModelCatalog, ModelDescriptor } from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { emitModelChange } from "./events.ts";
import { elementStyles } from "./styles.ts";

/** A compact, accessible model-only select. */
export class ModelsSelectElement extends ModelsHTMLElement {
  #catalogs: readonly ModelCatalog[] = [];
  #value = "";
  readonly #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  /** Catalogs shown by the select. Pass rich values through this property. */
  get catalogs(): readonly ModelCatalog[] {
    return this.#catalogs;
  }

  set catalogs(value: readonly ModelCatalog[]) {
    this.#catalogs = value;
    this.render();
  }

  /** The selected provider-qualified model key. */
  get value(): string {
    return this.#value;
  }

  set value(value: string) {
    this.#value = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const models = this.#catalogs.flatMap((catalog) => catalog.models);
    this.#root.innerHTML = `
      <style>${elementStyles}</style>
      <label class="field" part="field">
        <span class="label" part="label">${escapeHtml(this.getAttribute("label") ?? "Model")}</span>
        <select class="control" part="select">
          <option value="">Choose a model</option>
          ${groupOptions(models)}
        </select>
      </label>
    `;
    const select = this.#root.querySelector("select");
    if (select instanceof HTMLSelectElement) {
      select.value = this.#value;
      select.addEventListener("change", () => {
        const model = models.find((candidate) => candidate.key === select.value);
        if (model !== undefined) {
          this.#value = model.key;
          emitModelChange(this, model);
        }
      });
    }
  }
}

function groupOptions(models: readonly ModelDescriptor[]): string {
  const byProvider = new Map<string, ModelDescriptor[]>();
  for (const model of models) {
    const providerModels = byProvider.get(model.provider) ?? [];
    providerModels.push(model);
    byProvider.set(model.provider, providerModels);
  }
  return [...byProvider]
    .map(
      ([provider, providerModels]) =>
        `<optgroup label="${escapeHtml(provider)}">${providerModels
          .map(
            (model) =>
              `<option value="${escapeHtml(model.key)}">${escapeHtml(model.name)}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
