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
    const items = [
      ["Input", input],
      ["Output", output],
      ["Cached", cache],
    ] as const;
    const listed = items.flatMap(([label, value]) =>
      value === undefined ? [] : [{ label, value }],
    );
    this.#root.innerHTML = `
      <style>
        ${elementStyles}
        dl { display: flex; flex-wrap: wrap; gap: 7px 14px; margin: 0; }
        div { display: flex; gap: 4px; min-width: 0; }
        dt { color: var(--models-muted, #646464); font-size: 11px; }
        dd { margin: 0; font-size: 11px; font-weight: 650; }
        p { margin: 0; color: var(--models-muted, #646464); font-size: 11px; }
      </style>
      ${listed.length === 0 ? '<p part="prices">No public token price</p>' : `<dl part="prices">${listed.map(({ label, value }) => priceItem(label, value)).join("")}</dl>`}
    `;
  }
}

function priceItem(label: string, value: string): string {
  return `<div part="price"><dt>${label}</dt><dd>${formatUsd(value)} / 1M</dd></div>`;
}
