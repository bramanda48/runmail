import { z } from "zod";

export const RULE_FIELDS = ["from", "subject", "header"] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

export const MATCH_TYPES = [
  "contains",
  "not contains",
  "equal",
  "not equal",
  "start with",
  "end with",
  "match regex",
] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const ACTION_TYPES = ["move_to_folder", "mark_as_star", "mark_as_read"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const LOGIC_OPERATORS = ["AND", "OR"] as const;
export type LogicOperator = (typeof LOGIC_OPERATORS)[number];

export const CONDITION_VALUE_MAX_LENGTH = 500;

export const rulesetConditionSchema = z.object({
  field: z.enum(RULE_FIELDS),
  match_type: z.enum(MATCH_TYPES),
  condition_value: z
    .string()
    .min(1, "validation.ruleset.conditionValueRequired")
    .max(CONDITION_VALUE_MAX_LENGTH, "validation.ruleset.conditionValueMax"),
});

export const rulesetActionSchema = z.object({
  action_type: z.enum(ACTION_TYPES),
  action_value: z.string().nullable(),
});

export const rulesetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation.ruleset.nameRequired")
    .max(100, "validation.ruleset.nameMax"),
  priority: z.number().int().nonnegative("validation.ruleset.priorityNegative"),
  logic_operator: z.enum(LOGIC_OPERATORS),
  is_enabled: z.boolean(),
  conditions: z
    .array(rulesetConditionSchema)
    .min(1, "validation.ruleset.conditionsMin")
    .max(50, "validation.ruleset.conditionsMax"),
  actions: z
    .array(rulesetActionSchema)
    .min(1, "validation.ruleset.actionsMin")
    .max(50, "validation.ruleset.actionsMax"),
});

/**
 * Validates a regex expression for a ruleset "match regex" condition.
 * Returns true if the expression is safe to use with new RegExp.
 * ReDoS deep-mitigation (e.g., nested quantifier detection) is a runtime
 * concern handled by the ruleset evaluator, not this validation helper.
 */
export function validateRegexSafe(expr: string): boolean {
  if (expr.length > CONDITION_VALUE_MAX_LENGTH) return false;
  try {
    new RegExp(expr);
    return true;
  } catch {
    return false;
  }
}
