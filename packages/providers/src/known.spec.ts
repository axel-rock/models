import type { ModelCatalog } from "@models/core";
import { expectTypeOf, it } from "vitest";
import { selectKnownGatewayModel } from "./known.ts";

it("connects a reviewed model key to its exact option values", () => {
  const catalogs = [] as readonly ModelCatalog[];
  if (catalogs.length > 0) {
    const selection = selectKnownGatewayModel(catalogs, "vercel:openai/gpt-5.6-luna", {
      "reasoning.effort": "high",
      "service.tier": "flex",
    });
    expectTypeOf(selection).toMatchTypeOf<import("@models/core").ModelSelection>();

    selectKnownGatewayModel(catalogs, "vercel:openai/gpt-5.6-luna", {
      // @ts-expect-error The generated snapshot does not advertise this effort.
      "reasoning.effort": "extreme",
    });
  }
});
