import { describe, expect, it } from "vitest";
import { formatUsd, pricePerMillion } from "./pricing.ts";

describe("pricing", () => {
  it("scales decimal-string token prices without floating-point math", () => {
    expect(
      pricePerMillion(
        [
          {
            unit: "input-token",
            usd: "0.00000012",
            per: 1,
            evidence: [],
          },
        ],
        "input-token",
      ),
    ).toBe("0.12");
    expect(formatUsd("0.120000")).toBe("$0.12");
  });
});
