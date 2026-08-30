import type { ModelCatalog, ModelSelection } from "@models/core";
import {
  defineModelsElements,
  ModelsPickerElement,
  ModelsSelectElement,
  SELECTION_CHANGE_EVENT,
} from "@models/elements";
import { openRouterAdapter, vercelGatewayAdapter } from "@models/providers";
import { directProviderExamples } from "./demoCatalogs.ts";
import "./style.css";

defineModelsElements();

const publicResults = await Promise.allSettled([
  vercelGatewayAdapter.discover(),
  openRouterAdapter.discover(),
]);
const liveCatalogs = publicResults.flatMap((result) =>
  result.status === "fulfilled" ? [result.value] : [],
);
const catalogs: readonly ModelCatalog[] = [...liveCatalogs, ...directProviderExamples()];
const failures = publicResults.filter((result) => result.status === "rejected").length;

const simpleSelect = document.querySelector("#simple-select");
if (simpleSelect instanceof ModelsSelectElement) {
  simpleSelect.catalogs = focusedCatalogs(catalogs);
  simpleSelect.addEventListener("models-model-change", (event) => {
    const model = (event as CustomEvent).detail as { name: string; provider: string };
    setText("#simple-output", `${model.name} via ${model.provider}`);
  });
}

const reasoningPicker = document.querySelector("#reasoning-picker");
if (reasoningPicker instanceof ModelsPickerElement) {
  reasoningPicker.groups = ["reasoning"];
  reasoningPicker.catalogs = reasoningCatalogs(catalogs);
}

const advancedPicker = document.querySelector("#advanced-picker");
if (advancedPicker instanceof ModelsPickerElement) {
  advancedPicker.groups = ["reasoning", "speed", "caching", "beta"];
  advancedPicker.catalogs = focusedCatalogs(catalogs, 120);
  advancedPicker.addEventListener(SELECTION_CHANGE_EVENT, (event) => {
    const selection = (event as CustomEvent<ModelSelection>).detail;
    setText(
      "#selection-output",
      JSON.stringify(
        {
          model: selection.model.id,
          provider: selection.model.provider,
          options: selection.options,
        },
        null,
        2,
      ),
    );
  });
}

renderSummary(catalogs, liveCatalogs, failures);
renderFreshness(catalogs, failures);

function focusedCatalogs(values: readonly ModelCatalog[], maxModels = 50): readonly ModelCatalog[] {
  return values.map((catalog) => ({
    ...catalog,
    models: catalog.models
      .filter((model) => model.kind === "language")
      .sort((left, right) => optionScore(right) - optionScore(left))
      .slice(0, maxModels),
  }));
}

function reasoningCatalogs(values: readonly ModelCatalog[]): readonly ModelCatalog[] {
  return values
    .map((catalog) => ({
      ...catalog,
      models: catalog.models
        .filter((model) => model.options.some((option) => option.group === "reasoning"))
        .slice(0, 40),
    }))
    .filter((catalog) => catalog.models.length > 0);
}

function optionScore(model: ModelCatalog["models"][number]): number {
  return model.options.length * 10 + (model.capabilities.reasoning.status === "supported" ? 4 : 0);
}

function renderSummary(
  values: readonly ModelCatalog[],
  live: readonly ModelCatalog[],
  failureCount: number,
): void {
  const total = values.reduce((sum, catalog) => sum + catalog.models.length, 0);
  const summary = document.querySelector("#catalog-summary");
  if (summary !== null) {
    summary.innerHTML = `
      <span><strong>${total}</strong> models available</span>
      <span><strong>${live.length}</strong> live public catalogs</span>
      <span><strong>5</strong> provider adapters</span>
      ${failureCount > 0 ? `<span class="warning"><strong>${failureCount}</strong> public source error</span>` : ""}
    `;
  }
  setText(
    "#sidebar-status",
    failureCount === 0 ? "Public catalogs are live" : "Using a partial live catalog",
  );
}

function renderFreshness(values: readonly ModelCatalog[], failureCount: number): void {
  const grid = document.querySelector("#freshness-grid");
  if (grid === null) {
    return;
  }
  grid.innerHTML =
    values
      .map(
        (catalog) => `
        <article class="source-row">
          <div><strong>${escapeHtml(catalog.provider)}</strong><span>${catalog.models.length} models</span></div>
          <span class="source-kind">${catalog.source.kind}</span>
          <time datetime="${catalog.fetchedAt}">${catalog.fetchedAt.slice(0, 10)}</time>
        </article>`,
      )
      .join("") +
    `<p class="freshness-note ${failureCount > 0 ? "warning" : ""}">${failureCount === 0 ? "Live public sources loaded. CI compares them with reviewed snapshots every day." : "One public source failed. The component keeps the remaining sources visible instead of pretending the catalog is complete."}</p>`;
}

function setText(selector: string, value: string): void {
  const element = document.querySelector(selector);
  if (element !== null) {
    element.textContent = value;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
