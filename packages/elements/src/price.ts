import { formatUsd, pricePerMillion, type ModelDescriptor } from "@models/core";
import { ModelsHTMLElement } from "./base.ts";
import { elementStyles } from "./styles.ts";

/** An optional compact price summary for a selected model. */
export class ModelsPriceElement extends ModelsHTMLElement {
  #model: ModelDescriptor | undefined;
  readonly #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  /** The model whose base token prices should be shown. */
  get model(): ModelDescriptor | undefined {
    return this.#model;
  }

  set model(value: ModelDescriptor | undefined) {
    this.#model = value;
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const model = this.#model;
    const input = model === undefined ? undefined : pricePerMillion(model.prices, "input-token");
    const output = model === undefined ? undefined : pricePerMillion(model.prices, "output-token");
    const cache =
      model === undefined ? undefined : pricePerMillion(model.prices, "cache-read-token");
    this.#root.innerHTML = `
      <style>
        ${elementStyles}
        dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
        div { min-width: 0; }
        dt { color: var(--models-muted, #646464); font-size: 11px; }
        dd { margin: 2px 0 0; font-weight: 650; }
      </style>
      <dl part="prices">
        ${priceItem("Input", input)}
        ${priceItem("Output", output)}
        ${priceItem("Cached", cache)}
      </dl>
    `;
  }
}

function priceItem(label: string, value: string | undefined): string {
  return `<div part="price"><dt>${label} / 1M</dt><dd>${value === undefined ? "Not listed" : formatUsd(value)}</dd></div>`;
}
