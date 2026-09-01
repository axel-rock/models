# @models/elements

Framework-neutral custom elements for model, option, and price selection. See
the [repository](https://github.com/axel-rock/models) for examples and styling
hooks.

Brand marks are optional on every model selector:

```ts
const selector = document.querySelector("models-select");
selector.iconMode = "model-maker"; // or "none"
```

`models-picker` and `models-composer` use the same property. Marks are bundled
from a pinned, reviewed Lobe Icons release. There is no runtime request and no
icon API key.
