let example = "";
let library: string | undefined;
let activeFile = "index.html";
let displayedSource = "";
let pendingLibrary: Promise<string> | undefined;

/** Highlight source as escaped markup, preserving its exact text for selection. */
export function highlightSource(source: string): string {
  const tokens =
    /<!--[^]*?-->|\/\*[^]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[a-zA-Z][^>]*>|\b(?:import|from|export|const|let|async|await|function|return|if|else|try|catch|new|throw|class|true|false|null|undefined)\b/g;
  const escape = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  let result = "";
  let offset = 0;
  for (const match of source.matchAll(tokens)) {
    const token = match[0];
    const kind =
      token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--")
        ? "comment"
        : token.startsWith("<")
          ? "tag"
          : /^["'`]/.test(token)
            ? "string"
            : "keyword";
    result +=
      escape(source.slice(offset, match.index)) +
      `<span class="syntax-${kind}">${escape(token)}</span>`;
    offset = match.index + token.length;
  }
  return result + escape(source.slice(offset));
}

/** Refresh the example file when the selected component or logo style changes. */
export function updateCodeView(source: string): void {
  example = source;
  if (activeFile === "index.html") render(source);
}

function render(source: string): void {
  displayedSource = source;
  const code = document.querySelector("#source-code");
  const lines = document.querySelector("#source-lines");
  const panel = document.querySelector("#source-panel");
  if (code) code.innerHTML = highlightSource(source);
  if (lines)
    lines.textContent = source
      ? source
          .split("\n")
          .map((_, index) => String(index + 1))
          .join("\n")
      : "";
  if (panel) {
    panel.scrollTop = 0;
    panel.scrollLeft = 0;
  }
  const copy = document.querySelector<HTMLButtonElement>("#copy-source");
  if (copy) {
    copy.disabled = !source;
    copy.textContent = "Copy";
    copy.setAttribute("aria-label", `Copy ${activeFile}`);
  }
}

async function selectFile(file: string): Promise<void> {
  activeFile = file;
  const status = document.querySelector("#code-copy-status");
  const retry = document.querySelector<HTMLButtonElement>("#retry-source");
  if (retry) retry.hidden = true;
  for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-source]")) {
    const selected = tab.dataset.source === file;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) document.querySelector("#source-panel")?.setAttribute("aria-labelledby", tab.id);
  }
  if (status) status.textContent = "";
  if (file === "index.html") {
    render(example);
    return;
  }
  if (library !== undefined) {
    render(library);
    return;
  }
  render("");
  if (status) status.textContent = "Loading models.js…";
  try {
    pendingLibrary ??= fetch(
      new URL(`${import.meta.env.BASE_URL}distribution/models.js`, window.location.origin),
      { signal: AbortSignal.timeout(10000) },
    ).then(async (response) => {
      if (!response.ok) throw new Error("Source unavailable");
      return response.text();
    });
    library = await pendingLibrary;
    if (activeFile !== "models.js") return;
    render(library);
    if (status) status.textContent = "";
  } catch {
    pendingLibrary = undefined;
    if (activeFile !== "models.js") return;
    if (status) status.textContent = "Could not load models.js. Retry or download the file.";
    if (retry) retry.hidden = false;
  }
}

/** Wire keyboard file tabs and copying to the exact displayed file. */
export function initCodeView(): void {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>("[data-source]")];
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => {
      void selectFile(tab.dataset.source!);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next =
        tabs[
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
        ]!;
      next.focus();
      void selectFile(next.dataset.source!);
    });
  }
  document.querySelector("#retry-source")?.addEventListener("click", () => {
    void selectFile(activeFile);
  });
  const copy = document.querySelector<HTMLButtonElement>("#copy-source");
  copy?.addEventListener("click", async () => {
    const source = displayedSource;
    const file = activeFile;
    const status = document.querySelector("#code-copy-status");
    try {
      await navigator.clipboard.writeText(source);
      if (file !== activeFile) return;
      copy.textContent = "Copied";
      if (status) status.textContent = `${file} copied.`;
    } catch {
      if (file !== activeFile) return;
      if (status) status.textContent = "Could not copy. Select the code or download the file.";
    }
  });
}
