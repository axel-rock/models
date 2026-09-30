import { describe, expect, it } from "vitest";
import { sortModels, type OrderableModel } from "./ordering.ts";

/** Prices are per million tokens: `[input, output]`. */
function model(id: string, price?: readonly [number, number], releasedAt?: string): OrderableModel {
  const rate = (unit: "input-token" | "output-token", usd: number) => ({
    unit,
    usd: String(usd),
    per: 1_000_000,
    evidence: [],
  });
  return {
    id,
    name: id.split("/").at(-1) ?? id,
    ...(releasedAt === undefined ? {} : { releasedAt }),
    prices:
      price === undefined ? [] : [rate("input-token", price[0]), rate("output-token", price[1])],
  };
}

const ids = (models: readonly OrderableModel[]) => sortModels(models).map((entry) => entry.id);

describe("model ordering", () => {
  it("puts the newest of each tier first, best tier first, then older versions", () => {
    const claude = [
      model("anthropic/claude-3-haiku", [0.25, 1.25]),
      model("anthropic/claude-sonnet-4.5", [3, 15]),
      model("anthropic/claude-haiku-4.5", [1, 5]),
      model("anthropic/claude-opus-4.6", [5, 25]),
      model("anthropic/claude-sonnet-5", [3, 15]),
      model("anthropic/claude-opus-5", [5, 25]),
      model("anthropic/claude-opus-4.5", [5, 25]),
      model("anthropic/claude-fable-5", [15, 75]),
    ];
    expect(ids(claude)).toEqual([
      "anthropic/claude-fable-5",
      "anthropic/claude-opus-5",
      "anthropic/claude-sonnet-5",
      "anthropic/claude-haiku-4.5",
      "anthropic/claude-opus-4.6",
      "anthropic/claude-opus-4.5",
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-3-haiku",
    ]);
  });

  it("compares dotted versions as numbers, not text", () => {
    const order = ids([
      model("anthropic/claude-opus-4.9", [5, 25]),
      model("anthropic/claude-opus-4.10", [5, 25]),
      model("anthropic/claude-opus-4.2", [5, 25]),
    ]);
    expect(order).toEqual([
      "anthropic/claude-opus-4.10",
      "anthropic/claude-opus-4.9",
      "anthropic/claude-opus-4.2",
    ]);
  });

  it("reads the version wherever the name puts it", () => {
    const order = ids([
      model("anthropic/claude-3-5-sonnet-20241022", [3, 15]),
      model("anthropic/claude-sonnet-4", [3, 15]),
      model("anthropic/claude-3-7-sonnet-latest", [3, 15]),
    ]);
    expect(order).toEqual([
      "anthropic/claude-sonnet-4",
      "anthropic/claude-3-7-sonnet-latest",
      "anthropic/claude-3-5-sonnet-20241022",
    ]);
  });

  it("treats letters glued to the version (4o, o3) as part of the name", () => {
    const order = ids([
      model("openai/gpt-4o-mini", [0.15, 0.6]),
      model("openai/gpt-4o", [2.5, 10]),
      model("openai/o3", [2, 8]),
      model("openai/o4-mini", [1.1, 4.4]),
    ]);
    expect(order).toEqual(["openai/gpt-4o", "openai/o3", "openai/o4-mini", "openai/gpt-4o-mini"]);
  });

  it("keeps fast, preview and dated variants next to their base model", () => {
    const order = ids([
      model("anthropic/claude-opus-5-fast", [30, 150]),
      model("anthropic/claude-sonnet-5", [3, 15]),
      model("anthropic/claude-opus-5", [5, 25]),
      model("anthropic/claude-opus-4.8", [5, 25]),
    ]);
    expect(order).toEqual([
      "anthropic/claude-opus-5",
      "anthropic/claude-opus-5-fast",
      "anthropic/claude-sonnet-5",
      "anthropic/claude-opus-4.8",
    ]);
  });

  it("sorts sizes of one model largest first", () => {
    expect(
      ids([model("meta/llama-3.3-8b", [0.1, 0.1]), model("meta/llama-3.3-70b", [0.6, 0.6])]),
    ).toEqual(["meta/llama-3.3-70b", "meta/llama-3.3-8b"]);
  });

  it("does not let a retired expensive line outrank current models", () => {
    const order = ids([
      model("openai/gpt-4-turbo", [10, 30], "2024-04-09T00:00:00Z"),
      model("openai/gpt-5.5", [5, 30], "2026-08-01T00:00:00Z"),
      model("openai/gpt-5.5-mini", [1, 6], "2026-08-01T00:00:00Z"),
    ]);
    expect(order).toEqual(["openai/gpt-5.5", "openai/gpt-5.5-mini", "openai/gpt-4-turbo"]);
  });

  it("puts models without a price after priced models of the same kind of standing", () => {
    expect(ids([model("acme/nova-1"), model("acme/pulse-1", [1, 2])])).toEqual([
      "acme/pulse-1",
      "acme/nova-1",
    ]);
  });

  it("keeps providers in the order they first appear", () => {
    expect(
      ids([
        model("openai/gpt-5", [1, 10]),
        model("anthropic/claude-opus-5", [5, 25]),
        model("openai/gpt-5-mini", [0.25, 2]),
      ]),
    ).toEqual(["openai/gpt-5", "openai/gpt-5-mini", "anthropic/claude-opus-5"]);
  });

  it("is stable across input order and leaves the input untouched", () => {
    const input = [
      model("anthropic/claude-sonnet-5", [3, 15]),
      model("anthropic/claude-opus-5", [5, 25]),
      model("anthropic/claude-opus-4.8", [5, 25]),
    ];
    const snapshot = input.map((entry) => entry.id);
    expect(ids(input.toReversed())).toEqual(ids(input));
    expect(input.map((entry) => entry.id)).toEqual(snapshot);
  });
});
