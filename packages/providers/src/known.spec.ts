import type { ModelCatalog } from "@models/core";
import { expectTypeOf, it } from "vitest";
import type { KnownGatewayOptionValues } from "./generated/modelIds.ts";
import { selectKnownGatewayModel } from "./known.ts";

it("connects a reviewed model key to its exact option values", () => {
  const catalogs = [] as readonly ModelCatalog[];
  if (catalogs.length > 0) {
    const selection = selectKnownGatewayModel(catalogs, "vercel:openai/gpt-5.6-luna", {
      "reasoning.effort": "high",
      "service.tier": "flex",
    });
    expectTypeOf(selection.model.key).toEqualTypeOf<"vercel:openai/gpt-5.6-luna">();
    expectTypeOf(selection.model.id).toEqualTypeOf<"openai/gpt-5.6-luna">();
    expectTypeOf(selection.options).toEqualTypeOf<
      KnownGatewayOptionValues<"vercel:openai/gpt-5.6-luna">
    >();

    selectKnownGatewayModel(catalogs, "vercel:openai/gpt-5.6-luna", {
      // @ts-expect-error The generated snapshot does not advertise this effort.
      "reasoning.effort": "extreme",
    });
    selectKnownGatewayModel(catalogs, "vercel:openai/gpt-5.6-luna", {
      // @ts-expect-error This key belongs to Anthropic models, not the selected OpenAI model.
      "speed.mode": "fast",
    });
  }
});
