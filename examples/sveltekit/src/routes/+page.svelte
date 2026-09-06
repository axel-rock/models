<script lang="ts">
  import { onMount } from "svelte";
  import type { ModelSelection } from "@axelrock/models/core";
  import { vercelGatewayAdapter } from "@axelrock/models/providers";
  import type { ModelsComposerElement } from "../lib/ui/index.ts";

  // eslint-disable-next-line no-unassigned-vars -- Svelte assigns this through bind:this.
  let selector: ModelsComposerElement;
  let status = $state("Loading models…");
  let selection = $state("Choose a model or change a setting.");
  let isLoading = $state(true);
  let canRetry = $state(false);
  let load = $state(() => {});

  onMount(() => {
    const lifetime = new AbortController();
    async function loadCatalog() {
      isLoading = true;
      canRetry = false;
      status = "Loading models…";
      try {
        const { defineModelsElements } = await import("../lib/ui/index.ts");
        if (lifetime.signal.aborted) return;
        defineModelsElements();
        const catalog = await vercelGatewayAdapter.discover({
          signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000)]),
        });
        if (lifetime.signal.aborted) return;
        selector.catalogs = [catalog];
        selector.groups = ["reasoning", "speed"];
        status = catalog.models.length ? "Live catalog. Choose a model." : "No models available. Try again.";
        canRetry = catalog.models.length === 0;
      } catch {
        if (lifetime.signal.aborted) return;
        status = "Could not load models. Check your connection and retry.";
        canRetry = true;
      } finally {
        if (!lifetime.signal.aborted) isLoading = false;
      }
    }
    load = () => { void loadCatalog(); };
    const changed = (event: Event) => {
      const { model, options } = (event as CustomEvent<ModelSelection>).detail;
      selection = JSON.stringify({ provider: model.provider, model: model.id, options }, null, 2);
    };
    const cleared = () => { selection = "No model selected."; };
    selector.addEventListener("models-selection-change", changed);
    selector.addEventListener("models-model-clear", cleared);
    load();
    return () => {
      lifetime.abort();
      selector.removeEventListener("models-selection-change", changed);
      selector.removeEventListener("models-model-clear", cleared);
    };
  });
</script>

<svelte:head><title>Models · SvelteKit composer</title></svelte:head>
<main>
  <p>Models / SvelteKit</p>
  <h1>Your model. Your settings.</h1>
  <p>A live catalog and a composer you can edit.</p>
  <div class="composer">
    <textarea aria-label="Prompt" placeholder="Ask anything…"></textarea>
    <models-composer bind:this={selector}></models-composer>
  </div>
  <p role="status">{status}</p>
  {#if canRetry}<button onclick={load} disabled={isLoading}>Retry catalog</button>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable output must be reachable by keyboard.) -->
  <pre role="region" aria-label="Selected model" tabindex="0">{selection}</pre>
  <p>This demo selects models. Your application owns sending the prompt.</p>
</main>
<style>
  :global(body) { margin: 0; background: #fafafa; color: #242528; font: 14px/1.6 system-ui; }
  main { max-width: 720px; margin: 64px auto; padding: 24px; }
  h1 { font-size: clamp(24px, 5vw, 36px); letter-spacing: -0.04em; }
  .composer { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 16px; }
  textarea { flex: 1 1 240px; border: 0; min-height: 60px; resize: vertical; font: inherit; background: transparent; }
  models-composer { margin-left: auto; max-width: 100%; }
  pre { overflow: auto; padding: 20px; background: #f0f0f0; border-radius: 8px; }
  button { padding: 8px 16px; font: inherit; }
</style>
