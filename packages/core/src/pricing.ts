import type { PriceRate, PriceUnit } from "./types.ts";

/** Return a token price normalized to one million tokens. */
export function pricePerMillion(
  rates: readonly PriceRate[],
  unit: Extract<PriceUnit, `${string}-token`>,
): string | undefined {
  const rate = rates.find(
    (candidate) => candidate.unit === unit && candidate.condition === undefined,
  );
  return rate === undefined ? undefined : scaleDecimal(rate.usd, 1_000_000, rate.per);
}

/** Format a USD price without implying more precision than the source. */
export function formatUsd(value: string): string {
  return `$${trimDecimal(value)}`;
}

function scaleDecimal(value: string, multiplier: number, divisor: number): string {
  if (
    !/^\d+(?:\.\d+)?$/.test(value) ||
    !Number.isSafeInteger(multiplier) ||
    !Number.isSafeInteger(divisor)
  ) {
    throw new TypeError("Prices must be unsigned decimal strings with safe integer scales.");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const integer = BigInt(`${whole}${fraction}`);
  const numerator = integer * BigInt(multiplier);
  const denominator = BigInt(divisor) * scale;
  const resultWhole = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return resultWhole.toString();
  }
  const digits = ((remainder * 10n ** 12n) / denominator).toString().padStart(12, "0");
  return trimDecimal(`${resultWhole}.${digits}`);
}

function trimDecimal(value: string): string {
  return value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
}
