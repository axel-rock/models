import type { ModelDescriptor, ModelSelection } from "@models/core";

/** The event name emitted when a model changes. */
export const MODEL_CHANGE_EVENT = "models-model-change";

/** The event name emitted when a complete selection changes. */
export const SELECTION_CHANGE_EVENT = "models-selection-change";

/** The event name emitted for option drafts, including temporarily invalid combinations. */
export const OPTIONS_CHANGE_EVENT = "models-options-change";

/** Emit a standard bubbling, composed custom event. */
export function emitModelChange(target: EventTarget, model: ModelDescriptor): void {
  target.dispatchEvent(
    new CustomEvent(MODEL_CHANGE_EVENT, {
      detail: model,
      bubbles: true,
      composed: true,
    }),
  );
}

/** Emit a complete model and option selection. */
export function emitSelectionChange(target: EventTarget, selection: ModelSelection): void {
  target.dispatchEvent(
    new CustomEvent(SELECTION_CHANGE_EVENT, {
      detail: selection,
      bubbles: true,
      composed: true,
    }),
  );
}
