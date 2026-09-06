import type { ModelIconMode } from "@models/elements";
import { initCodeView, updateCodeView } from "./codeView.ts";
import { exampleDocument } from "./examples.ts";

type Example = "minimal" | "standalone" | "composer" | "inspector";
interface IconEntry {
  id: string;
  name: string;
  color: string;
  monochrome: string;
}
let activeExample: Example = "composer";
let activeIconMode: ModelIconMode = "model-maker";
const base = new URL(import.meta.env.BASE_URL, window.location.origin);
const asset = (path: string) => new URL(path, base).href;

function prompt(): string {
  return `Add the Models ${activeExample === "composer" ? "chat composer" : activeExample} to my app. Read ${asset("llms.txt")} for source files and integration instructions. Copy the library locally; do not install a Models package. Use ${activeIconMode === "model-maker" ? "color" : activeIconMode === "none" ? "no" : "monochrome"} logos. Keep my framework and visual style. Include loading, retry, and keyboard behavior. Keep provider keys on the server.`;
}

/** Keep the copyable handoff in sync with the visible component. */
export function setProductExample(example: Example, iconMode: ModelIconMode): void {
  activeExample = example;
  activeIconMode = iconMode;
  updateCodeView(exampleDocument(example, iconMode));
  const output = document.querySelector("#agent-prompt");
  if (output) output.textContent = prompt();
}

async function copy(
  text: string,
  button: HTMLButtonElement,
  statusId = "product-status",
): Promise<void> {
  const status = document.getElementById(statusId);
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = "Copied";
    if (status) status.textContent = "Copied to clipboard.";
    window.setTimeout(() => {
      button.textContent = label;
    }, 1800);
  } catch {
    if (status)
      status.textContent =
        "Clipboard unavailable. Select the visible text or use the download link.";
  }
}

/** Initialize the source handoff and icon catalog independently of provider discovery. */
export function initProduct(): void {
  initCodeView();
  setProductExample(activeExample, activeIconMode);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy-prompt]")) {
    button.addEventListener("click", () => {
      void copy(prompt(), button);
    });
  }
  void initIcons();
}

async function initIcons(): Promise<void> {
  const grid = document.querySelector<HTMLElement>("#icon-grid");
  const search = document.querySelector<HTMLInputElement>("#icon-search");
  const count = document.querySelector("#icon-count");
  if (!grid || !search || !count) return;
  try {
    const response = await fetch(asset("distribution/icons.json"));
    if (!response.ok) throw new Error("Icon index unavailable");
    const { icons } = (await response.json()) as { icons: IconEntry[] };
    let variant: "color" | "monochrome" = "color";
    function render(): void {
      if (!grid || !search || !count) return;
      const query = search.value.trim().toLowerCase();
      const matches = icons.filter((icon) =>
        `${icon.id} ${icon.name}`.toLowerCase().includes(query),
      );
      count.textContent = `${matches.length} of ${icons.length} brand marks${matches.length ? "" : ". Try another name."}`;
      grid.replaceChildren();
      for (const icon of matches) {
        const card = document.createElement("article");
        card.className = "icon-card";
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Copy ${icon.name} ${variant} SVG`);
        const img = document.createElement("img");
        img.src = asset(`distribution/${icon[variant]}`);
        img.alt = "";
        img.width = 28;
        img.height = 28;
        const name = document.createElement("span");
        name.textContent = icon.name;
        const id = document.createElement("code");
        id.textContent = icon.id;
        button.append(img, name, id);
        button.addEventListener("click", async () => {
          try {
            const svg = await fetch(img.src);
            if (!svg.ok) throw new Error("Icon unavailable");
            await navigator.clipboard.writeText(await svg.text());
            const status = document.querySelector("#icon-status");
            if (status) status.textContent = `${icon.name} ${variant} SVG copied.`;
          } catch {
            const status = document.querySelector("#icon-status");
            if (status)
              status.textContent = "Could not copy. Open the SVG link and save its source.";
          }
        });
        const link = document.createElement("a");
        link.href = img.src;
        link.textContent = "SVG ↗";
        link.setAttribute("aria-label", `Open ${icon.name} ${variant} SVG`);
        card.append(button, link);
        grid.append(card);
      }
    }
    search.addEventListener("input", render);
    for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="icon-variant"]')) {
      radio.addEventListener("change", () => {
        variant = radio.value === "monochrome" ? "monochrome" : "color";
        render();
      });
    }
    render();
  } catch {
    count.textContent = "Icons could not load. Reload the page or open the JSON index.";
  }
}
