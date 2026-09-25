import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { mailboxes } from "./mailboxes";

export const logicOperators = ["AND", "OR"] as const;
export type LogicOperator = (typeof logicOperators)[number];

export const ruleFields = ["from", "subject", "header"] as const;
export type RuleField = (typeof ruleFields)[number];

export const matchTypes = [
  "contains",
  "not contains",
  "equal",
  "not equal",
  "start with",
  "end with",
  "match regex",
] as const;
export type MatchType = (typeof matchTypes)[number];

export const actionTypes = ["move_to_folder", "mark_as_star", "mark_as_read"] as const;
export type ActionType = (typeof actionTypes)[number];

export const rulesets = sqliteTable("rulesets", {
  id: text("id").primaryKey(),
  mailbox_id: text("mailbox_id")
    .notNull()
    .references(() => mailboxes.id),
  name: text("name").notNull(),
  priority: integer("priority").notNull(),
  logic_operator: text("logic_operator", { enum: logicOperators }).notNull().default("AND"),
  is_enabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  created_at: integer("created_at").notNull(),
  updated_at: integer("updated_at").notNull(),
});

export type Ruleset = typeof rulesets.$inferSelect;
export type NewRuleset = typeof rulesets.$inferInsert;

export const rulesetConditions = sqliteTable("ruleset_conditions", {
  id: text("id").primaryKey(),
  ruleset_id: text("ruleset_id")
    .notNull()
    .references(() => rulesets.id),
  field: text("field", { enum: ruleFields }).notNull(),
  match_type: text("match_type", { enum: matchTypes }).notNull(),
  condition_value: text("condition_value").notNull(),
  condition_order: integer("condition_order").notNull(),
});

export type RulesetCondition = typeof rulesetConditions.$inferSelect;
export type NewRulesetCondition = typeof rulesetConditions.$inferInsert;

export const rulesetActions = sqliteTable("ruleset_actions", {
  id: text("id").primaryKey(),
  ruleset_id: text("ruleset_id")
    .notNull()
    .references(() => rulesets.id),
  action_type: text("action_type", { enum: actionTypes }).notNull(),
  action_value: text("action_value"),
  action_order: integer("action_order").notNull(),
});

export type RulesetAction = typeof rulesetActions.$inferSelect;
export type NewRulesetAction = typeof rulesetActions.$inferInsert;
