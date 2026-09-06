// @vitest-environment happy-dom

import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineModelsElements } from "@models/elements";
import { directProviderExamples } from "./demoCatalogs.ts";
import { exampleCode, exampleDocument } from "./examples.ts";

afterEach(() => document.body.replaceChildren());

function mount(
  tab: "minimal" | "standalone" | "composer" | "inspector",
  discover: () => Promise<unknown>,
): void {
  const code = exampleCode(tab);
  document.body.innerHTML = code.html;
  runInNewContext(code.javascript.replace(/^import .*;\n/m, ""), {
    document,
    defineModelsElements,
    vercelGatewayAdapter: { discover },
    AbortSignal,
  });
}

describe("copyable browser examples", () => {
  for (const tab of ["minimal", "standalone", "composer", "inspector"] as const) {
    it(`${tab} runs its displayed markup and setup without workspace imports`, async () => {
      const catalog = directProviderExamples()[0]!;
      mount(tab, () => Promise.resolve(catalog));
      await vi.waitFor(() =>
        expect(document.querySelector("#catalog-status")?.textContent).toBe(
          "Choose a model to begin.",
        ),
      );
      const selector = document.querySelector("models-select, models-composer, models-picker")!;
      const detail =
        tab === "minimal"
          ? catalog.models[0]!
          : { provider: catalog.provider, model: catalog.models[0]!, options: {} };
      selector.dispatchEvent(
        new CustomEvent(tab === "minimal" ? "models-model-change" : "models-selection-change", {
          detail,
        }),
      );
      expect(document.querySelector("#selection")?.textContent).toBe(
        JSON.stringify(detail, null, 2),
      );
      selector.dispatchEvent(new CustomEvent("models-model-clear"));
      expect(document.querySelector("#selection")?.textContent).toBe("No model selected.");
      expect(exampleDocument(tab)).not.toContain("@models/");
    });
  }

  it("recovers from discovery failure and keeps an empty catalog retryable", async () => {
    const catalog = directProviderExamples()[0]!;
    const discover = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ...catalog, models: [] })
      .mockResolvedValueOnce(catalog);
    mount("composer", discover);
    const retry = document.querySelector<HTMLButtonElement>("#catalog-retry")!;
    await vi.waitFor(() => expect(retry.hidden).toBe(false));
    expect(document.querySelector("#catalog-status")?.textContent).toContain("Could not load");
    retry.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#catalog-status")?.textContent).toContain("No models"),
    );
    expect(retry.hidden).toBe(false);
    retry.click();
    await vi.waitFor(() =>
      expect(document.querySelector("#catalog-status")?.textContent).toBe(
        "Choose a model to begin.",
      ),
    );
    expect(retry.hidden).toBe(true);
  });
});
