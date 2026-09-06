import type { ModelIconMode } from "@models/elements";

const chatMarkup = `<div class="prompt-bar">
  <textarea aria-label="Prompt" placeholder="Ask anything…"></textarea>
  <models-composer></models-composer>
</div>`;

const chatStyles = `.prompt-bar {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  border: 1px solid #d6d6d6;
  border-radius: 16px;
  background: #fff;
  color: #171717;
  --models-surface: #fff;
  --models-border: #d6d6d6;
  --models-radius: 7px;
  --models-control-height: 36px;
  --models-font-size: 13px;
}

.prompt-bar textarea {
  flex: 1 1 200px;
  min-width: 0;
  min-height: 36px;
  border: 0;
  padding: 8px;
  resize: vertical;
  background: transparent;
  color: inherit;
  font: 13px/1.5 system-ui, sans-serif;
}

.prompt-bar models-composer {
  margin-left: auto;
  max-width: 100%;
}`;

/** Starter code for each gallery presentation, using a public live catalog. */
export function exampleCode(
  tab: "minimal" | "standalone" | "composer" | "inspector",
  iconMode: ModelIconMode = "model-maker",
) {
  const tag =
    tab === "minimal" ? "models-select" : tab === "inspector" ? "models-picker" : "models-composer";
  const isMinimal = tab === "minimal";
  const setup = `import { defineModelsElements, vercelGatewayAdapter } from "./models.js";

defineModelsElements();
const selector = document.querySelector("${tag}");
const status = document.querySelector("#catalog-status");
const retry = document.querySelector("#catalog-retry");
selector.iconMode = "${iconMode}";
selector.groupBy = "author";${isMinimal ? "" : '\nselector.groups = ["reasoning", "speed"];'}${tab === "inspector" ? '\nselector.optionsLayout = "inline";' : ""}

selector.addEventListener("${isMinimal ? "models-model-change" : "models-selection-change"}", (event) => {
  document.querySelector("#selection").textContent = JSON.stringify(event.detail, null, 2);
});
selector.addEventListener("models-model-clear", () => {
  document.querySelector("#selection").textContent = "No model selected.";
});

async function loadCatalog() {
  retry.hidden = true;
  status.textContent = "Loading models…";
  try {
    const catalog = await vercelGatewayAdapter.discover({ signal: AbortSignal.timeout(10000) });
    selector.catalogs = [catalog];
    status.textContent = catalog.models.length ? "Choose a model to begin." : "No models are available. Try again.";
    retry.hidden = catalog.models.length > 0;
  } catch {
    status.textContent = "Could not load models. Check your connection and retry.";
    retry.hidden = false;
  }
}
retry.addEventListener("click", loadCatalog);
loadCatalog();`;
  return {
    html: `${tab === "composer" ? chatMarkup : `<${tag}${isMinimal ? ' label="Model"' : ""}></${tag}>`}
<p id="catalog-status" role="status">Loading models…</p>
<button id="catalog-retry" type="button" hidden>Retry catalog</button>
<pre id="selection" aria-label="Selected model" tabindex="0">Select a model or change an option to see its value.</pre>`,
    javascript: setup,
    css: tab === "composer" ? chatStyles : "",
  };
}

/** A complete browser example using the adjacent, self-contained library file. */
export function exampleDocument(
  tab: "minimal" | "standalone" | "composer" | "inspector",
  iconMode: ModelIconMode = "model-maker",
): string {
  const code = exampleCode(tab, iconMode);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Models example</title>
<style>
* { box-sizing: border-box; }
body { max-width: 800px; margin: 64px auto; padding: 24px; font: 14px/1.5 system-ui; color: #242528; background: #fafafa; }
button { font: inherit; padding: 8px 12px; cursor: pointer; }
pre { overflow: auto; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
${code.css}
</style>
</head>
<body>
<h1>Choose your model</h1>
${code.html}
<p>This example selects models. Connect your own request handler to send a prompt.</p>
<script type="module">
${code.javascript}
</script>
</body>
</html>`;
}
