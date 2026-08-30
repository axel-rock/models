import { describe, expect, expectTypeOf, it } from "vitest";
import { capability } from "./defaults.ts";
import { defineOptions, validateOptions } from "./options.ts";
import type { OptionValues } from "./types.ts";

const options = defineOptions([
  {
    key: "reasoning.effort",
    kind: "enum",
    label: "Reasoning effort",
    description: "Controls reasoning depth.",
    group: "reasoning",
    support: capability("supported"),
    values: ["low", "medium", "high"] as const,
  },
  {
    key: "speed.fast",
    kind: "boolean",
    label: "Fast mode",
    description: "Requests faster inference.",
    group: "speed",
    support: capability("supported"),
  },
] as const);

describe("validateOptions", () => {
  it("preserves literal option value types", () => {
    expectTypeOf<OptionValues<typeof options>>().toEqualTypeOf<{
      "reasoning.effort"?: "low" | "medium" | "high";
      "speed.fast"?: boolean;
    }>();
  });

  it("accepts valid dynamic values", () => {
    expect(validateOptions(options, { "reasoning.effort": "high" })).toEqual({
      ok: true,
      value: { "reasoning.effort": "high" },
    });
  });

  it("rejects unknown and invalid values", () => {
    const result = validateOptions(options, {
      "reasoning.effort": "extreme",
      "unknown.option": true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(2);
    }
  });
});
