export const elementStyles = String.raw`
  :host {
    color: inherit;
    font: var(--models-font, 14px/1.45 ui-sans-serif, system-ui, sans-serif);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input, select { font: inherit; color: inherit; }
  button:focus-visible, input:focus-visible, select:focus-visible {
    outline: 1.5px solid var(--models-focus, #2563eb);
    outline-offset: 2px;
  }
  .field { display: grid; gap: 5px; }
  .label { color: var(--models-muted, #646464); font-size: 12px; font-weight: 650; }
  .control {
    width: 100%; min-height: 38px; border: 1px solid var(--models-border, #d6d6d6);
    border-radius: var(--models-radius, 7px); background: var(--models-surface, #fff);
    padding: 7px 9px;
  }
  .muted { color: var(--models-muted, #646464); }
`;
