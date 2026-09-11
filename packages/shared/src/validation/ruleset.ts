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
  "match regex"
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
    .min(1, "Condition value is required")
    .max(
      CONDITION_VALUE_MAX_LENGTH,
      `Condition value must be at most ${CONDITION_VALUE_MAX_LENGTH} characters`
    )
});

export const rulesetActionSchema = z.object({
  action_type: z.enum(ACTION_TYPES),
  action_value: z.string().nullable()
});

export const rulesetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ruleset name is required")
    .max(100, "Ruleset name must be at most 100 characters"),
  priority: z.number().int().nonnegative("Priority must be a non-negative integer"),
  logic_operator: z.enum(LOGIC_OPERATORS),
  is_enabled: z.boolean(),
  conditions: z
    .array(rulesetConditionSchema)
    .min(1, "At least one condition is required")
    .max(50, "At most 50 conditions are allowed"),
  actions: z
    .array(rulesetActionSchema)
    .min(1, "At least one action is required")
    .max(50, "At most 50 actions are allowed")
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
