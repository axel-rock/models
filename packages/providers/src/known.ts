import { selectModel, type ModelCatalog, type ModelDescriptor } from "@models/core";
import type { KnownGatewayModelKey, KnownGatewayOptionValues } from "./generated/modelIds.ts";

/** A reviewed gateway model narrowed to its provider-qualified key. */
export type KnownGatewayModel<TKey extends KnownGatewayModelKey> = ModelDescriptor<
  TKey extends `${infer TProvider}:${string}` ? TProvider : never
> & {
  readonly key: TKey;
  readonly id: TKey extends `${string}:${infer TId}` ? TId : never;
};

/** A compile-time exact selection from a reviewed gateway snapshot. */
export interface KnownGatewaySelection<TKey extends KnownGatewayModelKey> {
  readonly model: KnownGatewayModel<TKey>;
  readonly options: KnownGatewayOptionValues<TKey>;
}

/** Select a reviewed gateway model with its exact generated option type. */
export function selectKnownGatewayModel<TKey extends KnownGatewayModelKey>(
  catalogs: readonly ModelCatalog[],
  key: TKey,
  options: KnownGatewayOptionValues<NoInfer<TKey>>,
): KnownGatewaySelection<TKey> {
  const model = catalogs.flatMap((catalog) => catalog.models).find((item) => item.key === key);
  if (model === undefined) {
    throw new RangeError(`The reviewed model ${key} is not present in these catalogs.`);
  }
  return selectModel(model, options) as unknown as KnownGatewaySelection<TKey>;
}
