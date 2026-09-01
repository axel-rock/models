// @vitest-environment happy-dom

import {
  capability,
  unknownCapabilities,
  type ModelCatalog,
  type ModelDescriptor,
  type ModelSelection,
} from "@models/core";
import { describe, expect, it } from "vitest";
import { defineModelsElements, SELECTION_CHANGE_EVENT } from "./index.ts";
import { ModelsComposerElement } from "./composer.ts";
import { modelIcon, providerIcon } from "./icons.ts";
import { ModelsPickerElement } from "./picker.ts";
import { ModelsOptionsElement } from "./options.ts";
import { ModelsSelectElement } from "./select.ts";

defineModelsElements();

describe("models elements", () => {
  it("registers explicitly and tolerates duplicate registration", () => {
    expect(customElements.get("models-picker")).toBe(ModelsPickerElement);
    expect(() => defineModelsElements()).not.toThrow();
  });

  it("opens a composer dialog and commits quick details", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    document.body.append(composer);
    let detail: ModelSelection | undefined;
    composer.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
      detail = (event as CustomEvent<ModelSelection>).detail;
    });
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    expect(composer.open).toBe(true);
    expect(composer.shadowRoot?.querySelector('[role="dialog"]')).not.toBeNull();
    expect(composer.shadowRoot?.querySelector(".chevron svg")).not.toBeNull();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="effort"]')?.click();
    expect(composer.shadowRoot?.activeElement).toBe(
      composer.shadowRoot?.querySelector('[data-option="reasoning.effort"]'),
    );
    composer.shadowRoot
      ?.querySelector<HTMLButtonElement>('[data-option="reasoning.effort"][data-value="high"]')
      ?.click();
    expect(composer.value?.options).toEqual({ "reasoning.effort": "high" });
    expect(detail?.options).toEqual({ "reasoning.effort": "high" });
    expect(composer.shadowRoot?.querySelector(".summary")?.textContent).toContain("High");
    expect(composer.shadowRoot?.activeElement).toBe(
      composer.shadowRoot?.querySelector('[data-section="effort"]'),
    );
    expect(composer.shadowRoot?.querySelector('[role="option"]')).toBeNull();
  });

  it("uses reviewed Claude and Qwen marks without fabricating unknown brands", () => {
    const model = catalog("anthropic").models[0];
    if (model === undefined) {
      throw new TypeError("Expected a fixture model.");
    }
    expect(providerIcon("anthropic")).toContain('viewBox="0 0 24 24"');
    expect(modelIcon({ ...model, name: "Qwen 3.5" }, "model-maker")).toContain(
      'viewBox="0 0 24 24"',
    );
    expect(providerIcon("unknown-model-company")).toBe("");
  });

  it("searches models inside the composer without empty groups", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="model"]')?.click();
    expect(composer.shadowRoot?.querySelector(".panel")).toBeNull();
    expect(
      composer.shadowRoot
        ?.querySelector('[data-model="openai:first"]')
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(composer.shadowRoot?.querySelector(".submenu > .submenu-list")).not.toBeNull();
    const search = composer.shadowRoot?.querySelector<HTMLInputElement>(".search");
    if (search === undefined || search === null) {
      throw new TypeError("Expected a composer model search.");
    }
    expect(composer.shadowRoot?.activeElement).toBe(search);
    search.value = "missing";
    search.dispatchEvent(new Event("input"));
    expect(composer.shadowRoot?.querySelector(".empty")?.textContent).toBe("No matching models");
    expect(composer.shadowRoot?.querySelector(".group")).toBeNull();
  });

  it("backs out of a composer detail before closing", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="model"]')?.click();
    composer.shadowRoot
      ?.querySelector<HTMLInputElement>(".search")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(composer.open).toBe(true);
    expect(composer.shadowRoot?.querySelector(".submenu")).toBeNull();
    composer.shadowRoot
      ?.querySelector<HTMLButtonElement>(".trigger")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(composer.open).toBe(false);
  });

  it("keeps advanced controls absent until requested", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    expect(composer.shadowRoot?.querySelector("models-options")).toBeNull();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="advanced"]')?.click();
    const options = composer.shadowRoot?.querySelector("models-options");
    expect(options).not.toBeNull();
    expect(options?.shadowRoot?.querySelector('[data-option="caching.auto"]')).not.toBeNull();
    expect(options?.shadowRoot?.querySelector('[data-option="reasoning.effort"]')).toBeNull();
    expect(options?.shadowRoot?.querySelector('[data-option="speed.mode"]')).toBeNull();
    expect(options?.shadowRoot?.activeElement).toBe(
      options?.shadowRoot?.querySelector('[data-option="caching.auto"]'),
    );
  });

  it("composes model, reasoning, and speed as independent groups", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.groups = ["speed"];
    composer.catalogs = [composerCatalog()];
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    expect(composer.shadowRoot?.querySelector('[data-section="model"]')).not.toBeNull();
    expect(composer.shadowRoot?.querySelector('[data-section="effort"]')).toBeNull();
    expect(composer.shadowRoot?.querySelector('[data-section="speed"]')).not.toBeNull();
    expect(composer.shadowRoot?.querySelector('[data-section="advanced"]')).toBeNull();

    composer.groups = [];
    expect(composer.shadowRoot?.querySelector('[data-section="model"]')).not.toBeNull();
    expect(composer.shadowRoot?.querySelector('[data-section="speed"]')).toBeNull();
  });

  it("places a left-edge composer below and toward available space", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    composer.getBoundingClientRect = () =>
      ({
        bottom: 38,
        height: 38,
        left: 0,
        right: 360,
        top: 0,
        width: 360,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    const popover = composer.shadowRoot?.querySelector<HTMLElement>(".popover");
    expect(popover?.dataset.horizontal).toBe("start");
    expect(popover?.dataset.vertical).toBe("below");
  });

  it("uses the roomier side and caps a constrained composer submenu", () => {
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [composerCatalog()];
    composer.getBoundingClientRect = () =>
      ({
        bottom: 438,
        height: 38,
        left: 200,
        right: 360,
        top: 400,
        width: 160,
        x: 200,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="model"]')?.click();
    const popover = composer.shadowRoot?.querySelector<HTMLElement>(".popover");
    expect(popover?.dataset.vertical).toBe("above");
    expect(popover?.style.getPropertyValue("--models-popover-space")).toBe("376px");
  });

  it("keeps a compact composer overlay inside a narrow viewport", () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      const composer = document.createElement("models-composer") as ModelsComposerElement;
      composer.catalogs = [composerCatalog()];
      composer.getBoundingClientRect = () =>
        ({
          bottom: 438,
          height: 38,
          left: 112,
          right: 278,
          top: 400,
          width: 166,
          x: 112,
          y: 400,
          toJSON: () => ({}),
        }) as DOMRect;
      document.body.append(composer);
      composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
      const popover = composer.shadowRoot?.querySelector<HTMLElement>(".popover");
      expect(popover?.dataset.horizontal).toBe("overlay");
      expect(popover?.style.left).toBe("-78px");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
  });

  it("repositions an open composer when the viewport changes", () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      const composer = document.createElement("models-composer") as ModelsComposerElement;
      composer.catalogs = [composerCatalog()];
      composer.getBoundingClientRect = () =>
        ({
          bottom: 438,
          height: 38,
          left: 112,
          right: 278,
          top: 400,
          width: 166,
          x: 112,
          y: 400,
          toJSON: () => ({}),
        }) as DOMRect;
      document.body.append(composer);
      composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
      const popover = composer.shadowRoot?.querySelector<HTMLElement>(".popover");
      expect(popover?.dataset.horizontal).toBe("overlay");
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
      window.dispatchEvent(new Event("resize"));
      expect(popover?.dataset.horizontal).toBe("start");
      expect(popover?.style.left).toBe("");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth });
    }
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

  it("resets a stale selection when the catalog source changes", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    document.body.append(picker);
    const search = picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    if (search === null || search === undefined) {
      throw new TypeError("Expected a picker search input.");
    }
    search.value = "second";
    search.dispatchEvent(new Event("input"));
    picker.shadowRoot
      ?.querySelector<HTMLButtonElement>('button[data-key="openai:second"]')
      ?.click();
    picker.catalogs = [catalog("anthropic")];
    expect(picker.value?.model.key).toBe("anthropic:first");
    expect(picker.value?.options).toEqual({});
    expect(picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]")?.value).toBe(
      "",
    );
  });

  it("opens a grouped model combobox without native datalist output", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    const value = catalog();
    select.groupBy = "author";
    select.catalogs = [
      {
        ...value,
        models: value.models.map((model) => ({ ...model, author: "openai" })),
      },
    ];
    document.body.append(select);
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    expect(select.shadowRoot?.querySelector("datalist")).toBeNull();
    expect(select.shadowRoot?.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(select.shadowRoot?.querySelector(".group")?.textContent).toBe("OpenAI");
    select.value = "openai:first";
    select.catalogs = [catalog("anthropic")];
    expect(select.value).toBe("");
  });

  it("renders compact model controls with optional logos and labeled options", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    const value = catalog();
    select.density = "compact";
    select.iconMode = "model-maker";
    select.catalogs = [value];
    select.value = "openai:first";
    document.body.append(select);
    expect(select.shadowRoot?.querySelector(".field")?.classList.contains("compact")).toBe(true);
    expect(select.shadowRoot?.querySelector(".search-icon svg")).not.toBeNull();

    const model = value.models[0];
    if (model === undefined) {
      throw new TypeError("Expected a fixture model.");
    }
    const options = document.createElement("models-options") as ModelsOptionsElement;
    options.layout = "inline";
    options.model = {
      ...model,
      options: [
        {
          key: "reasoning.effort",
          kind: "enum",
          label: "Reasoning",
          description: "Select reasoning effort.",
          group: "reasoning",
          support: capability("supported", [value.source]),
          values: ["low", "high"],
        },
      ],
    };
    document.body.append(options);
    expect(options.shadowRoot?.querySelector(".options")?.classList.contains("inline")).toBe(true);
    expect(options.shadowRoot?.querySelector(".label")?.textContent).toBe("Reasoning");
    expect(options.shadowRoot?.querySelector(".option-icon")).toBeNull();
  });

  it("hides logos when icon mode is disabled", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.catalogs = [catalog()];
    select.value = "openai:first";
    document.body.append(select);
    expect(select.shadowRoot?.querySelector(".search-icon")).toBeNull();
    select.iconMode = "model-maker";
    expect(select.shadowRoot?.querySelector(".search-icon svg")).not.toBeNull();
  });

  it("shows model-maker logos in an open model-only list and after selection", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.iconMode = "model-maker";
    select.catalogs = [catalog()];
    document.body.append(select);
    expect(select.shadowRoot?.querySelector(".search-icon")).toBeNull();
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    expect(select.shadowRoot?.querySelector(".option-icon svg")).not.toBeNull();
    select.shadowRoot?.querySelector<HTMLButtonElement>('[data-key="openai:first"]')?.click();
    expect(select.shadowRoot?.querySelector(".search-icon svg")).not.toBeNull();
  });

  it("shows an explicit empty picker state without stale details", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    document.body.append(picker);
    const search = picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    if (search === undefined || search === null) {
      throw new TypeError("Expected a picker search input.");
    }
    search.value = "not-a-real-model";
    search.dispatchEvent(new Event("input"));
    expect(picker.shadowRoot?.querySelector(".no-results")?.hasAttribute("hidden")).toBe(false);
    expect(picker.shadowRoot?.querySelector(".detail")?.hasAttribute("hidden")).toBe(true);
  });

  it("keeps inline numeric options visibly identifiable without repeating placeholders", () => {
    const value = constrainedCatalog();
    const model = value.models[0];
    if (model === undefined) {
      throw new TypeError("Expected a fixture model.");
    }
    const options = document.createElement("models-options") as ModelsOptionsElement;
    options.layout = "inline";
    options.model = model;
    options.value = { "reasoning.mode": "enabled" };
    document.body.append(options);
    const budget = options.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-option="reasoning.budgetTokens"]',
    );
    expect(budget?.getAttribute("placeholder")).toBeNull();
    expect(budget?.closest("label")?.querySelector(".label")?.textContent).toBe("Thinking budget");
  });

  it("commits an exact combobox value or an active keyboard option", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.catalogs = [catalog()];
    document.body.append(select);
    let selectedKey = "";
    select.addEventListener("models-model-change", (event) => {
      selectedKey = (event as CustomEvent<ModelDescriptor>).detail.key;
    });
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    const input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (input === undefined || input === null) {
      throw new TypeError("Expected a model search input.");
    }
    input.value = "fir";
    input.dispatchEvent(new Event("input"));
    expect(select.value).toBe("");
    expect(selectedKey).toBe("");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(select.value).toBe("");
    input.value = "first";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(select.value).toBe("openai:first");
    expect(selectedKey).toBe("openai:first");
  });

  it("reopens a closed combobox from the keyboard and exposes its active option", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.catalogs = [catalog()];
    select.value = "openai:first";
    document.body.append(select);
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    let input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    expect(input?.getAttribute("aria-expanded")).toBe("false");
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    const activeId = input?.getAttribute("aria-activedescendant");
    expect(activeId).not.toBeNull();
    expect(select.shadowRoot?.getElementById(activeId ?? "")).not.toBeNull();
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (input === undefined || input === null) {
      throw new TypeError("Expected a model search input.");
    }
    input.value = "fir";
    input.dispatchEvent(new Event("input"));
    input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    expect(input?.value).toBe("fir");
  });

  it("clears a committed combobox selection explicitly", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.catalogs = [catalog()];
    select.value = "openai:first";
    document.body.append(select);
    let clears = 0;
    select.addEventListener("models-model-clear", () => {
      clears += 1;
    });
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    const input = select.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (input === undefined || input === null) {
      throw new TypeError("Expected a model search input.");
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(select.value).toBe("");
    expect(clears).toBe(1);
  });

  it("makes duplicate cross-gateway combobox rows unique", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    const firstCatalog = catalog();
    const secondCatalog = catalog("anthropic");
    const first = firstCatalog.models[0];
    const second = secondCatalog.models[0];
    if (first === undefined || second === undefined) {
      throw new TypeError("Expected fixture models.");
    }
    select.catalogs = [
      { ...firstCatalog, models: [{ ...first, name: "Shared", id: "same" }] },
      { ...secondCatalog, models: [{ ...second, name: "Shared", id: "same" }] },
    ];
    document.body.append(select);
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    const values = [...(select.shadowRoot?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.textContent?.trim(),
    );
    expect(new Set(values).size).toBe(2);
    expect(values).toEqual(["Shared· same · openai:first", "Shared· same · anthropic:first"]);
  });

  it("shows app-owned recommendations once above ordinary model groups", () => {
    const select = document.createElement("models-select") as ModelsSelectElement;
    select.catalogs = [catalog()];
    select.recommendations = [
      { model: "openai:second", label: "Recommended for this app" },
      { model: "second", label: "Lowest input price" },
    ];
    document.body.append(select);
    select.shadowRoot?.querySelector<HTMLInputElement>("input")?.click();
    const groups = [...(select.shadowRoot?.querySelectorAll(".group") ?? [])].map(
      (group) => group.textContent,
    );
    expect(groups).toEqual(["Recommended", "All models"]);
    const recommended = select.shadowRoot?.querySelector('[data-key="openai:second"]');
    expect(recommended?.textContent).toContain("Recommended for this app");
    expect(recommended?.textContent).toContain("Lowest input price");
    expect(select.shadowRoot?.querySelectorAll('[data-key="openai:second"]')).toHaveLength(1);
  });

  it("shows shared recommendation labels in composer and inspector model lists", () => {
    const recommendation = [
      { model: "openai:second", label: "Recommended for this app" },
      { model: "second", label: "Lowest input price" },
    ];
    const composer = document.createElement("models-composer") as ModelsComposerElement;
    composer.catalogs = [catalog()];
    composer.recommendations = recommendation;
    document.body.append(composer);
    composer.shadowRoot?.querySelector<HTMLButtonElement>(".trigger")?.click();
    composer.shadowRoot?.querySelector<HTMLButtonElement>('[data-section="model"]')?.click();
    expect(
      composer.shadowRoot?.querySelector('[data-model="openai:second"]')?.textContent,
    ).toContain("Recommended for this app");
    expect(
      composer.shadowRoot?.querySelector('[data-model="openai:second"]')?.textContent,
    ).toContain("Lowest input price");
    const search = composer.shadowRoot?.querySelector<HTMLInputElement>(".search");
    if (search === undefined || search === null) {
      throw new TypeError("Expected a composer search input.");
    }
    search.value = "recommended";
    search.dispatchEvent(new Event("input"));
    expect(composer.shadowRoot?.querySelectorAll("[data-model]")).toHaveLength(1);

    const picker = document.createElement("models-picker") as ModelsPickerElement;
    picker.catalogs = [catalog()];
    picker.recommendations = recommendation;
    document.body.append(picker);
    expect(picker.shadowRoot?.querySelector('[data-key="openai:second"]')?.textContent).toContain(
      "Recommended for this app",
    );
    expect(picker.shadowRoot?.querySelector('[data-key="openai:second"]')?.textContent).toContain(
      "Lowest input price",
    );
  });

  it("groups non-adjacent picker models into one author section", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    const value = catalog();
    const first = value.models[0];
    const second = value.models[1];
    if (first === undefined || second === undefined) {
      throw new TypeError("Expected two fixture models.");
    }
    picker.groupBy = "author";
    picker.catalogs = [
      {
        ...value,
        models: [
          { ...first, author: "openai" },
          { ...second, key: "openai:other", author: "other" },
          { ...second, author: "openai" },
        ],
      },
    ];
    document.body.append(picker);
    expect(
      [...(picker.shadowRoot?.querySelectorAll(".group") ?? [])].map((group) => group.textContent),
    ).toEqual(["OpenAI", "Other"]);
  });

  it("hides empty maker groups while searching", () => {
    const picker = document.createElement("models-picker") as ModelsPickerElement;
    const value = catalog();
    const first = value.models[0];
    const second = value.models[1];
    if (first === undefined || second === undefined) {
      throw new TypeError("Expected two fixture models.");
    }
    picker.groupBy = "author";
    picker.catalogs = [
      {
        ...value,
        models: [
          { ...first, author: "openai" },
          { ...second, author: "anthropic" },
        ],
      },
    ];
    document.body.append(picker);
    const search = picker.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
    if (search === undefined || search === null) {
      throw new TypeError("Expected a picker search input.");
    }
    search.value = "first";
    search.dispatchEvent(new Event("input"));
    const groups = picker.shadowRoot?.querySelectorAll<HTMLElement>("[data-model-group]");
    expect(groups?.[0]?.hidden).toBe(false);
    expect(groups?.[1]?.hidden).toBe(true);
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

function catalog<TProvider extends "anthropic" | "openai" = "openai">(
  provider: TProvider = "openai" as TProvider,
): ModelCatalog<TProvider> {
  const source = {
    kind: "generated-snapshot" as const,
    url: "https://example.test/catalog",
    retrievedAt: "2026-08-30T00:00:00.000Z",
  };
  const makeModel = (id: string): ModelDescriptor<TProvider> => ({
    key: `${provider}:${id}`,
    provider,
    id,
    name: id,
    kind: "language",
    lifecycle: "unknown",
    capabilities: {
      ...unknownCapabilities(),
      reasoning: capability("supported", [source]),
    },
    interfaces: provider === "anthropic" ? ["anthropic-messages"] : ["openai-responses"],
    prices: [],
    routes: [],
    options: [],
    requirements: [],
    sources: [source],
  });
  return {
    schemaVersion: 1,
    provider,
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

function composerCatalog(): ModelCatalog<"openai"> {
  const base = catalog();
  const first = base.models[0];
  const second = base.models[1];
  if (first === undefined || second === undefined) {
    throw new TypeError("Expected fixture models.");
  }
  return {
    ...base,
    models: [
      {
        ...first,
        name: "Primary",
        author: "openai",
        options: [
          {
            key: "reasoning.effort",
            kind: "enum",
            label: "Effort",
            description: "Select reasoning effort.",
            group: "reasoning",
            support: capability("supported", [base.source]),
            values: ["low", "medium", "high"],
          },
          {
            key: "speed.mode",
            kind: "enum",
            label: "Speed",
            description: "Select serving speed.",
            group: "speed",
            support: capability("supported", [base.source]),
            values: ["standard", "fast"],
          },
          {
            key: "caching.auto",
            kind: "boolean",
            label: "Automatic caching",
            description: "Enable automatic prompt caching.",
            group: "caching",
            support: capability("supported", [base.source]),
          },
        ],
      },
      { ...second, name: "Secondary", author: "anthropic" },
    ],
  };
}
