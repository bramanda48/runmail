import { folders, rulesetActions, rulesetConditions, rulesets } from "@runmail/db";
import type { PageMeta, RulesetDetail, rulesetSchema } from "@runmail/shared";
import { buildIdCursor, buildPageMeta, validateRegexSafe } from "@runmail/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";

export type RulesetInput = z.infer<typeof rulesetSchema>;

export type RulesetErrorCode = "NOT_FOUND" | "RULESET_INVALID_REGEX" | "FOLDER_NOT_FOUND";

export type RulesetError = {
  error: RulesetErrorCode;
  details?: Record<string, unknown>;
};

type RulesetRow = typeof rulesets.$inferSelect;
type ConditionRow = typeof rulesetConditions.$inferSelect;
type ActionRow = typeof rulesetActions.$inferSelect;

function toDetail(
  row: RulesetRow,
  conditions: ConditionRow[],
  actions: ActionRow[]
): RulesetDetail {
  return {
    id: row.id,
    mailbox_id: row.mailbox_id,
    name: row.name,
    priority: row.priority,
    logic_operator: row.logic_operator,
    is_enabled: row.is_enabled,
    created_at: row.created_at,
    updated_at: row.updated_at,
    conditions: conditions
      .slice()
      .sort((a, b) => a.condition_order - b.condition_order)
      .map((c) => ({
        id: c.id,
        ruleset_id: c.ruleset_id,
        field: c.field,
        match_type: c.match_type,
        condition_value: c.condition_value,
        condition_order: c.condition_order
      })),
    actions: actions
      .slice()
      .sort((a, b) => a.action_order - b.action_order)
      .map((a) => ({
        id: a.id,
        ruleset_id: a.ruleset_id,
        action_type: a.action_type,
        action_value: a.action_value,
        action_order: a.action_order
      }))
  };
}

function validateRegexConditions(input: RulesetInput): RulesetError | null {
  for (let i = 0; i < input.conditions.length; i++) {
    const cond = input.conditions[i];
    if (cond.match_type === "match regex" && !validateRegexSafe(cond.condition_value)) {
      return { error: "RULESET_INVALID_REGEX", details: { index: i } };
    }
  }
  return null;
}

async function validateMoveToFolderActions(
  c: AppContext,
  mailboxId: string,
  input: RulesetInput
): Promise<RulesetError | null> {
  const refs: Array<{ index: number; folderId: string }> = [];
  for (let i = 0; i < input.actions.length; i++) {
    const action = input.actions[i];
    if (action.action_type === "move_to_folder") {
      if (!action.action_value) {
        return { error: "FOLDER_NOT_FOUND", details: { index: i } };
      }
      refs.push({ index: i, folderId: action.action_value });
    }
  }
  if (refs.length === 0) return null;

  const db = getDb(c);
  const rows = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.mailbox_id, mailboxId),
        inArray(
          folders.id,
          refs.map((r) => r.folderId)
        )
      )
    );
  const found = new Set(rows.map((r) => r.id));
  for (const ref of refs) {
    if (!found.has(ref.folderId)) {
      return { error: "FOLDER_NOT_FOUND", details: { index: ref.index } };
    }
  }
  return null;
}

async function validateInput(
  c: AppContext,
  mailboxId: string,
  input: RulesetInput
): Promise<RulesetError | null> {
  const regexErr = validateRegexConditions(input);
  if (regexErr) return regexErr;
  return validateMoveToFolderActions(c, mailboxId, input);
}

export async function listRulesets(
  c: AppContext,
  mailboxId: string,
  limit: number,
  cursorId: string | undefined
): Promise<{ rulesets: RulesetDetail[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db
    .select()
    .from(rulesets)
    .where(eq(rulesets.mailbox_id, mailboxId))
    .orderBy(asc(rulesets.priority), desc(rulesets.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row)
  }));
  const page = window.slice(0, limit);
  if (page.length === 0) return { rulesets: [], meta };

  const ids = page.map((r) => r.id);
  const [conditionRows, actionRows] = await Promise.all([
    db
      .select()
      .from(rulesetConditions)
      .where(inArray(rulesetConditions.ruleset_id, ids))
      .orderBy(asc(rulesetConditions.condition_order)),
    db
      .select()
      .from(rulesetActions)
      .where(inArray(rulesetActions.ruleset_id, ids))
      .orderBy(asc(rulesetActions.action_order))
  ]);

  const conditionsByRuleset = new Map<string, ConditionRow[]>();
  for (const cond of conditionRows) {
    const list = conditionsByRuleset.get(cond.ruleset_id) ?? [];
    list.push(cond);
    conditionsByRuleset.set(cond.ruleset_id, list);
  }
  const actionsByRuleset = new Map<string, ActionRow[]>();
  for (const action of actionRows) {
    const list = actionsByRuleset.get(action.ruleset_id) ?? [];
    list.push(action);
    actionsByRuleset.set(action.ruleset_id, list);
  }

  return {
    rulesets: page.map((row) =>
      toDetail(row, conditionsByRuleset.get(row.id) ?? [], actionsByRuleset.get(row.id) ?? [])
    ),
    meta
  };
}

export async function getRuleset(
  c: AppContext,
  mailboxId: string,
  rulesetId: string
): Promise<{ ruleset: RulesetDetail } | RulesetError> {
  const db = getDb(c);
  const [row] = await db
    .select()
    .from(rulesets)
    .where(and(eq(rulesets.id, rulesetId), eq(rulesets.mailbox_id, mailboxId)))
    .limit(1);
  if (!row) return { error: "NOT_FOUND" };

  const [conditionRows, actionRows] = await Promise.all([
    db
      .select()
      .from(rulesetConditions)
      .where(eq(rulesetConditions.ruleset_id, rulesetId))
      .orderBy(asc(rulesetConditions.condition_order)),
    db
      .select()
      .from(rulesetActions)
      .where(eq(rulesetActions.ruleset_id, rulesetId))
      .orderBy(asc(rulesetActions.action_order))
  ]);

  return { ruleset: toDetail(row, conditionRows, actionRows) };
}

export async function createRuleset(
  c: AppContext,
  mailboxId: string,
  input: RulesetInput
): Promise<{ ruleset: RulesetDetail } | RulesetError> {
  const invalid = await validateInput(c, mailboxId, input);
  if (invalid) return invalid;

  const db = getDb(c);
  const now = Date.now();
  const id = uuidv7();

  const conditionValues = input.conditions.map((cond, index) => ({
    id: uuidv7(),
    ruleset_id: id,
    field: cond.field,
    match_type: cond.match_type,
    condition_value: cond.condition_value,
    condition_order: index
  }));
  const actionValues = input.actions.map((action, index) => ({
    id: uuidv7(),
    ruleset_id: id,
    action_type: action.action_type,
    action_value: action.action_value,
    action_order: index
  }));

  await db.batch([
    db.insert(rulesets).values({
      id,
      mailbox_id: mailboxId,
      name: input.name,
      priority: input.priority,
      logic_operator: input.logic_operator,
      is_enabled: input.is_enabled,
      created_at: now,
      updated_at: now
    }),
    ...conditionValues.map((values) => db.insert(rulesetConditions).values(values)),
    ...actionValues.map((values) => db.insert(rulesetActions).values(values))
  ] as unknown as Parameters<typeof db.batch>[0]);

  return {
    ruleset: toDetail(
      {
        id,
        mailbox_id: mailboxId,
        name: input.name,
        priority: input.priority,
        logic_operator: input.logic_operator,
        is_enabled: input.is_enabled,
        created_at: now,
        updated_at: now
      },
      conditionValues.map((v) => ({ ...v }) as ConditionRow),
      actionValues.map((v) => ({ ...v }) as ActionRow)
    )
  };
}

export async function updateRuleset(
  c: AppContext,
  mailboxId: string,
  rulesetId: string,
  input: RulesetInput
): Promise<{ ruleset: RulesetDetail } | RulesetError> {
  const invalid = await validateInput(c, mailboxId, input);
  if (invalid) return invalid;

  const db = getDb(c);
  const [existing] = await db
    .select()
    .from(rulesets)
    .where(and(eq(rulesets.id, rulesetId), eq(rulesets.mailbox_id, mailboxId)))
    .limit(1);
  if (!existing) return { error: "NOT_FOUND" };

  const now = Date.now();
  const conditionValues = input.conditions.map((cond, index) => ({
    id: uuidv7(),
    ruleset_id: rulesetId,
    field: cond.field,
    match_type: cond.match_type,
    condition_value: cond.condition_value,
    condition_order: index
  }));
  const actionValues = input.actions.map((action, index) => ({
    id: uuidv7(),
    ruleset_id: rulesetId,
    action_type: action.action_type,
    action_value: action.action_value,
    action_order: index
  }));

  await db.batch([
    db
      .update(rulesets)
      .set({
        name: input.name,
        priority: input.priority,
        logic_operator: input.logic_operator,
        is_enabled: input.is_enabled,
        updated_at: now
      })
      .where(eq(rulesets.id, rulesetId)),
    db.delete(rulesetConditions).where(eq(rulesetConditions.ruleset_id, rulesetId)),
    db.delete(rulesetActions).where(eq(rulesetActions.ruleset_id, rulesetId)),
    ...conditionValues.map((values) => db.insert(rulesetConditions).values(values)),
    ...actionValues.map((values) => db.insert(rulesetActions).values(values))
  ] as unknown as Parameters<typeof db.batch>[0]);

  return {
    ruleset: toDetail(
      {
        ...existing,
        name: input.name,
        priority: input.priority,
        logic_operator: input.logic_operator,
        is_enabled: input.is_enabled,
        updated_at: now
      },
      conditionValues.map((v) => ({ ...v }) as ConditionRow),
      actionValues.map((v) => ({ ...v }) as ActionRow)
    )
  };
}

export async function deleteRuleset(
  c: AppContext,
  mailboxId: string,
  rulesetId: string
): Promise<{ ok: true } | RulesetError> {
  const db = getDb(c);
  const [existing] = await db
    .select({ id: rulesets.id })
    .from(rulesets)
    .where(and(eq(rulesets.id, rulesetId), eq(rulesets.mailbox_id, mailboxId)))
    .limit(1);
  if (!existing) return { error: "NOT_FOUND" };

  await db.batch([
    db.delete(rulesetConditions).where(eq(rulesetConditions.ruleset_id, rulesetId)),
    db.delete(rulesetActions).where(eq(rulesetActions.ruleset_id, rulesetId)),
    db.delete(rulesets).where(eq(rulesets.id, rulesetId))
  ]);

  return { ok: true };
}
