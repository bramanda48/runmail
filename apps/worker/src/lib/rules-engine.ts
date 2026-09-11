import type { ActionType, LogicOperator, MatchType, RuleField } from "@runmail/db";

export type RuleCondition = {
  field: RuleField;
  match_type: MatchType;
  condition_value: string;
};

export type RuleAction = {
  action_type: ActionType;
  action_value: string | null;
};

export type EvaluableRuleset = {
  id: string;
  priority: number;
  logic_operator: LogicOperator;
  conditions: RuleCondition[];
  actions: RuleAction[];
};

export type MessageRuleContext = {
  from: string;
  subject: string;
  rawHeaders: string;
};

export type RulesDecision = {
  matched: boolean;
  folder_id: string | null;
  is_starred: boolean;
  is_read: boolean;
  matched_ruleset_ids: string[];
};

function targetFor(field: RuleField, ctx: MessageRuleContext): string {
  if (field === "from") return ctx.from;
  if (field === "subject") return ctx.subject;
  return ctx.rawHeaders;
}

function matchCondition(matchType: MatchType, target: string, value: string): boolean {
  switch (matchType) {
    case "contains":
      return target.toLowerCase().includes(value.toLowerCase());
    case "not contains":
      return !target.toLowerCase().includes(value.toLowerCase());
    case "equal":
      return target.toLowerCase() === value.toLowerCase();
    case "not equal":
      return target.toLowerCase() !== value.toLowerCase();
    case "start with":
      return target.toLowerCase().startsWith(value.toLowerCase());
    case "end with":
      return target.toLowerCase().endsWith(value.toLowerCase());
    case "match regex": {
      try {
        // bounds regex execution against large header blocks; matches beyond
        // 8KB of the target are not evaluated
        return new RegExp(value).test(target.slice(0, 8192));
      } catch {
        return false;
      }
    }
  }
}

function rulesetMatches(ruleset: EvaluableRuleset, ctx: MessageRuleContext): boolean {
  const results = ruleset.conditions.map((c) =>
    matchCondition(c.match_type, targetFor(c.field, ctx), c.condition_value)
  );
  if (ruleset.logic_operator === "OR") return results.some(Boolean);
  return results.every(Boolean);
}

function applyAction(action: RuleAction, decision: RulesDecision): void {
  switch (action.action_type) {
    case "move_to_folder": {
      const folderId = action.action_value;
      if (folderId === null || folderId.trim() === "") return;
      decision.folder_id = folderId;
      return;
    }
    case "mark_as_star":
      decision.is_starred = true;
      return;
    case "mark_as_read":
      decision.is_read = true;
      return;
  }
}

export function evaluateRulesets(
  rulesets: EvaluableRuleset[],
  ctx: MessageRuleContext
): RulesDecision {
  const ordered = [...rulesets].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
  });

  const decision: RulesDecision = {
    matched: false,
    folder_id: null,
    is_starred: false,
    is_read: false,
    matched_ruleset_ids: []
  };

  for (const ruleset of ordered) {
    if (ruleset.conditions.length === 0) continue;
    if (!rulesetMatches(ruleset, ctx)) continue;

    decision.matched = true;
    decision.matched_ruleset_ids.push(ruleset.id);
    // Actions arrive in action_order ascending from the caller (see
    // RuleAction: no order field); execute in array order so ties keep
    // their stable relative order, skipping failures without aborting.
    for (const action of ruleset.actions) {
      applyAction(action, decision);
    }
  }

  return decision;
}
