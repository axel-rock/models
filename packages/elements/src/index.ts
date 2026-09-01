export {
  MODEL_CLEAR_EVENT,
  MODEL_CHANGE_EVENT,
  OPTIONS_CHANGE_EVENT,
  SELECTION_CHANGE_EVENT,
  emitModelClear,
  emitModelChange,
  emitSelectionChange,
} from "./events.ts";
export { ModelsOptionsElement } from "./options.ts";
export type { OptionsLayout, VisibleOptionGroup } from "./options.ts";
export type { ModelGrouping } from "./grouping.ts";
export { modelIcon, providerIcon } from "./icons.ts";
export type { ModelIconMode } from "./icons.ts";
export { ModelsComposerElement } from "./composer.ts";
export { ModelsPickerElement } from "./picker.ts";
export { ModelsPriceElement } from "./price.ts";
export { ModelsSelectElement } from "./select.ts";
export type { SelectDensity } from "./select.ts";

import { ModelsOptionsElement } from "./options.ts";
import { ModelsComposerElement } from "./composer.ts";
import { ModelsPickerElement } from "./picker.ts";
import { ModelsPriceElement } from "./price.ts";
import { ModelsSelectElement } from "./select.ts";

/** Explicitly register the Models custom elements without import side effects. */
export function defineModelsElements(registry: CustomElementRegistry = customElements): void {
  defineIfMissing(registry, "models-select", ModelsSelectElement);
  defineIfMissing(registry, "models-options", ModelsOptionsElement);
  defineIfMissing(registry, "models-price", ModelsPriceElement);
  defineIfMissing(registry, "models-picker", ModelsPickerElement);
  defineIfMissing(registry, "models-composer", ModelsComposerElement);
}

function defineIfMissing(
  registry: CustomElementRegistry,
  name: string,
  constructor: CustomElementConstructor,
): void {
  if (registry.get(name) === undefined) {
    registry.define(name, constructor);
  }
}
