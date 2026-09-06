# @axelrock/models

One package for model catalogs, discovery, options, pricing, and request mappings.
The UI stays in your codebase as copied source.

```ts
import { selectModel } from "@axelrock/models/core";
import { vercelGatewayAdapter } from "@axelrock/models/providers";
import { prepareAiSdkCall } from "@axelrock/models/ai-sdk";
```

The root import exports the same API as `/core`. It has no runtime dependencies.
`/providers` uses Zod to validate provider responses. `/ai-sdk` provides an optional
bridge to AI SDK 7. Install `ai` only if you use that integration. Subpath imports
share one version and load only their own module dependencies.

Install the package:

```sh
npm install @axelrock/models
```

For the optional AI SDK bridge, also install `ai@^7`.

See the [repository documentation](https://github.com/axel-rock/models#readme)
for discovery examples, evidence boundaries, and copying the UI. Keep provider
credentials on the server. Model selection does not execute a model request.

MIT licensed.
