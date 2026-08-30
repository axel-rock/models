export const elementStyles = String.raw`
  :host {
    color: var(--models-color, #171717);
    font: var(--models-font, 14px/1.45 ui-sans-serif, system-ui, sans-serif);
  }
  * { box-sizing: border-box; }
  button, input, select { font: inherit; color: inherit; }
  button:focus-visible, input:focus-visible, select:focus-visible {
    outline: 2px solid var(--models-focus, #2563eb);
    outline-offset: 2px;
  }
  .field { display: grid; gap: 6px; }
  .label { color: var(--models-muted, #646464); font-size: 12px; font-weight: 650; }
  .control {
    width: 100%; min-height: 38px; border: 1px solid var(--models-border, #d6d6d6);
    border-radius: var(--models-radius, 7px); background: var(--models-surface, #fff);
    padding: 8px 10px;
  }
  .muted { color: var(--models-muted, #646464); }
  .badge {
    display: inline-flex; align-items: center; border: 1px solid var(--models-border, #d6d6d6);
    border-radius: 999px; padding: 2px 7px; color: var(--models-muted, #646464);
    font-size: 11px; white-space: nowrap;
  }
`;
