import { gateway } from "ai";
import { selectModel } from "@axelrock/models/core";
import { vercelGatewayAdapter } from "@axelrock/models/providers";
import { prepareAiSdkCall } from "@axelrock/models/ai-sdk";

const catalog = await vercelGatewayAdapter.discover({ signal: AbortSignal.timeout(10_000) });
const model = catalog.models.find((entry) => entry.kind === "language");
if (!model) throw new Error("No language models returned. Try again later.");
const selection = selectModel(model, {});
const prepared = prepareAiSdkCall(vercelGatewayAdapter, selection, gateway);
console.log(
  JSON.stringify(
    {
      model: selection.model.id,
      callOptions: prepared.callOptions,
      warnings: prepared.warnings,
    },
    null,
    2,
  ),
);

// Your server can pass prepared.model and prepared.callOptions to generateText.
// Check warnings first. This example does not call a model or need a gateway key.
