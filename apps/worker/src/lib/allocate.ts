import { mailboxSyncCounters, syncEvents, type SyncEventType } from "@runmail/db";
import { type SQL, sql } from "drizzle-orm";
import type { Db } from "./db";

/**
 * Single allocation path for per-mailbox sync_version.
 *
 * ALWAYS call inside db.batch() together with the event insert; NEVER
 * standalone. D1 batch runs as an implicit transaction (drizzle
 * db.transaction() is NOT safe on D1), and sibling statements in the SAME
 * batch consume the just-incremented value via the nextVersionSql subquery.
 */
export function bumpCounterStmt(db: Db, mailboxId: string) {
  return db
    .insert(mailboxSyncCounters)
    .values({ mailbox_id: mailboxId, last_version: 1 })
    .onConflictDoUpdate({
      target: mailboxSyncCounters.mailbox_id,
      set: { last_version: sql`last_version + 1` },
    });
}

/** Scalar subquery embedding the bumped counter value for use as a column value in sibling statements of the SAME batch. */
export function nextVersionSql(mailboxId: string): SQL {
  return sql`(SELECT last_version FROM mailbox_sync_counters WHERE mailbox_id = ${mailboxId})`;
}

export type EmitEventParams = {
  mailbox_id: string;
  event_type: SyncEventType;
  message_id: string;
  payload: string | SQL;
  sync_version_sql: SQL;
  created_at: number;
};

/** Build the sync_events insert using the batch-local bumped version subquery. */
export function emitEventStmt(db: Db, params: EmitEventParams) {
  return db.insert(syncEvents).values({
    sync_version: params.sync_version_sql as unknown as number,
    mailbox_id: params.mailbox_id,
    event_type: params.event_type,
    message_id: params.message_id,
    payload: params.payload,
    created_at: params.created_at,
  });
}
