import type { ActionType, LogicOperator, MatchType, RuleField } from "../validation/ruleset";

/**
 * Mirrors the `rulesets` D1 table for API payloads. Nested conditions and
 * actions are included in the ruleset detail payload.
 */
export interface RulesetCondition {
  id: string;
  ruleset_id: string;
  field: RuleField;
  match_type: MatchType;
  condition_value: string;
  condition_order: number;
}

export interface RulesetAction {
  id: string;
  ruleset_id: string;
  action_type: ActionType;
  action_value: string | null;
  action_order: number;
}

export interface Ruleset {
  id: string;
  mailbox_id: string;
  name: string;
  priority: number;
  logic_operator: LogicOperator;
  is_enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface RulesetDetail extends Ruleset {
  conditions: RulesetCondition[];
  actions: RulesetAction[];
}
