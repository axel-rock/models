# @models/elements

Framework-neutral custom elements for model, option, and price selection. See
the [repository](https://github.com/axel-rock/models) for examples and styling
hooks.

Brand marks are optional on every model selector:

```ts
const selector = document.querySelector("models-select");
selector.iconMode = "model-maker"; // or "monochrome" or "none"
```

`models-picker` and `models-composer` use the same property. Marks are bundled
from a pinned, reviewed Lobe Icons release. There is no runtime request and no
icon API key.

Importing this module adds TypeScript tag-name declarations, so
`document.querySelector("models-composer")` returns a typed composer or `null`.
Call `defineModelsElements()` on the client before using an element. Imports are
safe during server rendering; element registration requires a browser.

The product page provides a self-contained browser module for copying without
installing the workspace packages. Its source is generated from these same
components. Keep the included license notices.
