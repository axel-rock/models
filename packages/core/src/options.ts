import type {
  ModelDescriptor,
  ModelSelection,
  OptionDefinition,
  OptionValidationIssue,
  OptionValidationResult,
  OptionValues,
} from "./types.ts";

/** Preserve literal option definitions while checking their public shape. */
export function defineOptions<const T extends readonly OptionDefinition[]>(definitions: T): T {
  return definitions;
}

/** Preserve a model's provider and literal option types. */
export function defineModel<const T extends ModelDescriptor>(model: T): T {
  return model;
}

/** Validate dynamic values against the definitions shipped for a model. */
export function validateOptions<const TDefinitions extends readonly OptionDefinition[]>(
  definitions: TDefinitions,
  values: Readonly<Record<string, unknown>>,
): OptionValidationResult<OptionValues<TDefinitions>> {
  const byKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const issues: OptionValidationIssue[] = [];

  for (const [key, value] of Object.entries(values)) {
    const definition = byKey.get(key);
    if (definition === undefined) {
      issues.push({ key, message: "This option is not available for the selected model." });
      continue;
    }

    if (definition.support.status !== "supported") {
      issues.push({
        key,
        message: `This option is ${definition.support.status} for the selected model.`,
      });
      continue;
    }

    validateOptionValue(definition, value, issues);
  }

  for (const definition of definitions) {
    const condition = definition.visibleWhen;
    if (
      condition !== undefined &&
      values[definition.key] !== undefined &&
      values[condition.key] !== condition.equals
    ) {
      issues.push({
        key: definition.key,
        message: `This option requires ${condition.key} to equal ${String(condition.equals)}.`,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: values as OptionValues<TDefinitions> };
}

/** Create a type-safe selection for a literal generated model. */
export function selectModel<const TModel extends ModelDescriptor>(
  model: TModel,
  options: OptionValues<TModel["options"]>,
): ModelSelection<TModel> {
  const result = validateOptions(model.options, options);
  if (!result.ok) {
    throw new TypeError(result.issues.map((issue) => `${issue.key}: ${issue.message}`).join("\n"));
  }

  const constraintIssues = validateConstraints(model, options);
  if (constraintIssues.length > 0) {
    throw new TypeError(
      constraintIssues.map((issue) => `${issue.key}: ${issue.message}`).join("\n"),
    );
  }

  return {
    model,
    options: result.value as OptionValues<TModel["options"]>,
  };
}

/** Validate rules that depend on more than one option. */
export function validateConstraints(
  model: ModelDescriptor,
  values: Readonly<Record<string, unknown>>,
): readonly OptionValidationIssue[] {
  const issues: OptionValidationIssue[] = [];
  for (const constraint of model.constraints ?? []) {
    if (constraint.kind === "less-than") {
      const left = values[constraint.leftKey];
      const right = values[constraint.rightKey];
      if (typeof left === "number" && typeof right === "number" && left >= right) {
        issues.push({ key: constraint.leftKey, message: constraint.message });
      }
      continue;
    }

    if (values[constraint.when.key] !== constraint.when.equals) {
      continue;
    }
    if (constraint.kind === "requires" && values[constraint.key] === undefined) {
      issues.push({ key: constraint.key, message: constraint.message });
    }
    if (constraint.kind === "forbids" && values[constraint.key] !== undefined) {
      issues.push({ key: constraint.key, message: constraint.message });
    }
  }
  return issues;
}

function validateOptionValue(
  definition: OptionDefinition,
  value: unknown,
  issues: OptionValidationIssue[],
): void {
  switch (definition.kind) {
    case "boolean":
      if (typeof value !== "boolean") {
        issues.push({ key: definition.key, message: "Expected a boolean value." });
      }
      return;
    case "enum":
      if (typeof value !== "string" || !definition.values.includes(value)) {
        issues.push({
          key: definition.key,
          message: `Expected one of: ${definition.values.join(", ")}.`,
        });
      }
      return;
    case "integer":
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        issues.push({ key: definition.key, message: "Expected a finite number." });
        return;
      }
      if (definition.kind === "integer" && !Number.isInteger(value)) {
        issues.push({ key: definition.key, message: "Expected an integer." });
      }
      if (definition.min !== undefined && value < definition.min) {
        issues.push({ key: definition.key, message: `Expected at least ${definition.min}.` });
      }
      if (definition.max !== undefined && value > definition.max) {
        issues.push({ key: definition.key, message: `Expected at most ${definition.max}.` });
      }
      return;
    case "string-list":
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        issues.push({ key: definition.key, message: "Expected a list of strings." });
      }
  }
}
