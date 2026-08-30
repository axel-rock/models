// @vitest-environment happy-dom

import {
  capability,
  unknownCapabilities,
  type ModelCatalog,
  type ModelDescriptor,
} from "@models/core";
import { describe, expect, it } from "vitest";
import { defineModelsElements, SELECTION_CHANGE_EVENT } from "./index.ts";
import { ModelsPickerElement } from "./picker.ts";

defineModelsElements();

describe("models elements", () => {
  it("registers explicitly and tolerates duplicate registration", () => {
    expect(customElements.get("models-picker")).toBe(ModelsPickerElement);
    expect(() => defineModelsElements()).not.toThrow();
  });

  it("emits a complete selection from the searchable picker", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    document.body.append(picker);
    let detail: unknown;
    picker.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
      detail = (event as CustomEvent).detail;
    });
    const second = picker.shadowRoot?.querySelectorAll<HTMLButtonElement>("button[data-key]")[1];
    second?.click();
    expect(detail).toMatchObject({ model: { key: "openai:second" }, options: {} });
    expect(picker.shadowRoot?.activeElement).toBe(
      picker.shadowRoot?.querySelector('button[data-key="openai:second"]'),
    );
  });

  it("supports listbox Home, End, and Escape navigation", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    document.body.append(picker);
    const buttons = picker.shadowRoot?.querySelectorAll<HTMLButtonElement>("button[data-key]");
    const search = picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    buttons?.[0]?.focus();
    buttons?.[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(picker.shadowRoot?.activeElement).toBe(buttons?.[1]);
    buttons?.[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(picker.shadowRoot?.activeElement).toBe(buttons?.[0]);
    buttons?.[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(picker.shadowRoot?.activeElement).toBe(search);
  });

  it("supports a model-only composition", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.groups = [];
    picker.catalogs = [catalog()];
    document.body.append(picker);
    expect(picker.groups).toEqual([]);
    expect(picker.shadowRoot?.querySelector("models-options")).not.toBeNull();
  });

  it("preserves a search query when a filtered model is selected", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    document.body.append(picker);
    const search = picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    if (search === undefined || search === null) {
      throw new TypeError("Expected a picker search input.");
    }
    search.value = "second";
    search.dispatchEvent(new Event("input"));
    picker.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[data-key="openai:second"]')
      ?.click();
    expect(picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]")?.value).toBe(
      "second",
    );
    expect(
      picker.shadowRoot?.querySelector<HTMLButtonElement>('button[data-key="openai:first"]')
        ?.hidden,
    ).toBe(true);
  });

  it("shows cross-field issues and emits only complete selections", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [constrainedCatalog()];
    document.body.append(picker);
    let selectionEvents = 0;
    picker.addEventListener(SELECTION_CHANGE_EVENT, () => {
      selectionEvents += 1;
    });
    const options = picker.shadowRoot?.querySelector("models-options");
    const mode = options?.shadowRoot?.querySelector<HTMLSelectElement>(
      '[data-option="reasoning.mode"]',
    );
    if (mode === undefined || mode === null) {
      throw new TypeError("Expected a thinking-mode control.");
    }
    mode.value = "enabled";
    mode.dispatchEvent(new Event("change"));
    expect(options?.shadowRoot?.activeElement).toBe(
      options?.shadowRoot?.querySelector('[data-option="reasoning.mode"]'),
    );
    expect(options?.shadowRoot?.querySelector('[role="alert"]')?.textContent).toContain(
      "requires a token budget",
    );
    expect(selectionEvents).toBe(0);

    const budget = options?.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option="reasoning.budgetTokens"]',
    );
    if (budget === undefined || budget === null) {
      throw new TypeError("Expected a thinking-budget control.");
    }
    budget.value = "2048";
    budget.dispatchEvent(new Event("change"));
    expect(options?.shadowRoot?.querySelector('[role="alert"]')).toBeNull();
    expect(selectionEvents).toBe(1);
  });
});

function catalog(): ModelCatalog<"openai"> {
  const source = {
    kind: "generated-snapshot" as const,
    url: "https://example.test/catalog",
    retrievedAt: "2026-08-30T00:00:00.000Z",
  };
  const makeModel = (id: string): ModelDescriptor<"openai"> => ({
    key: `openai:${id}`,
    provider: "openai",
    id,
    name: id,
    kind: "language",
    lifecycle: "unknown",
    capabilities: {
      ...unknownCapabilities(),
      reasoning: capability("supported", [source]),
    },
    interfaces: ["openai-responses"],
    prices: [],
    routes: [],
    options: [],
    requirements: [],
    sources: [source],
  });
  return {
    schemaVersion: 1,
    provider: "openai",
    fetchedAt: source.retrievedAt,
    source,
    models: [makeModel("first"), makeModel("second")],
  };
}

function constrainedCatalog(): ModelCatalog<"openai"> {
  const base = catalog();
  const model = base.models[0];
  if (model === undefined) {
    throw new TypeError("Expected a fixture model.");
  }
  return {
    ...base,
    models: [
      {
        ...model,
        options: [
          {
            key: "reasoning.mode",
            kind: "enum",
            label: "Thinking",
            description: "Enable manual thinking.",
            group: "reasoning",
            support: capability("supported", [base.source]),
            values: ["enabled", "disabled"],
          },
          {
            key: "reasoning.budgetTokens",
            kind: "integer",
            label: "Thinking budget",
            description: "Maximum thinking tokens.",
            group: "reasoning",
            support: capability("supported", [base.source]),
            min: 1024,
            visibleWhen: { key: "reasoning.mode", equals: "enabled" },
          },
        ],
        constraints: [
          {
            kind: "requires",
            when: { key: "reasoning.mode", equals: "enabled" },
            key: "reasoning.budgetTokens",
            message: "Manual thinking requires a token budget.",
          },
        ],
      },
    ],
  };
}
