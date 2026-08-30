import { selectModel, type ModelCatalog, type ModelSelection } from "@models/core";
import type { KnownGatewayModelKey, KnownGatewayOptionValues } from "./generated/modelIds.ts";

/** Select a reviewed gateway model with its exact generated option type. */
export function selectKnownGatewayModel<TKey extends KnownGatewayModelKey>(
  catalogs: readonly ModelCatalog[],
  key: TKey,
  options: KnownGatewayOptionValues<TKey>,
): ModelSelection {
  const model = catalogs.flatMap((catalog) => catalog.models).find((item) => item.key === key);
  if (model === undefined) {
    throw new RangeError(`The reviewed model ${key} is not present in these catalogs.`);
  }
  return selectModel(model, options);
}
