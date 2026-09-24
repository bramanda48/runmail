import { folders, messageRecipients, messages, syncEvents } from "@runmail/db";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { bumpCounterStmt, emitEventStmt, nextVersionSql } from "../../lib/allocate";
import type { Bindings } from "../../lib/db";
import { getDb } from "../../lib/db";
import { deleteRawEmail } from "../../lib/r2";

export function retentionDaysFromEnv(raw: string | undefined): number {
  const parsed = parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) return 30;
  return parsed;
}

export async function runRetentionCleanup(
  env: Bindings,
  opts?: { execution_id?: string }
): Promise<{ expired_messages: number; pruned_events: number }> {
  const days = retentionDaysFromEnv(env.TRASH_SPAM_RETENTION_DAYS);
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  const db = getDb({ env });

  const expired = await db
    .select({
      id: messages.id,
      mailbox_id: messages.mailbox_id,
      raw_object_key: messages.raw_object_key
    })
    .from(messages)
    .innerJoin(folders, eq(messages.folder_id, folders.id))
    .where(
      and(
        eq(folders.folder_type, "system"),
        sql`lower(${folders.name}) IN ('trash','spam')`,
        isNotNull(messages.folder_entered_at),
        lt(messages.folder_entered_at, cutoff)
      )
    );

  let totalMessagesDeleted = 0;
  for (let i = 0; i < expired.length; i += 20) {
    const chunk = expired.slice(i, i + 20);
    const stmts = chunk.flatMap((msg) => {
      const versionSql = nextVersionSql(msg.mailbox_id);
      return [
        bumpCounterStmt(db, msg.mailbox_id),
        emitEventStmt(db, {
          mailbox_id: msg.mailbox_id,
          event_type: "message_deleted",
          message_id: msg.id,
          payload: sql`json_object('message_id', ${msg.id}, 'sync_version', ${versionSql}, 'timestamp', ${now})`,
          sync_version_sql: versionSql,
          created_at: now
        }),
        db.delete(messageRecipients).where(eq(messageRecipients.message_id, msg.id)),
        db.delete(messages).where(eq(messages.id, msg.id))
      ];
    });
    try {
      await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
      totalMessagesDeleted += chunk.length;
      await Promise.all(chunk.map((m) => deleteRawEmail(env, m.raw_object_key)));
    } catch {
      console.error(
        JSON.stringify({
          execution_id: opts?.execution_id,
          event: "retention_chunk_failed",
          level: "error",
          count: chunk.length
        })
      );
    }
  }

  const syncDays = retentionDaysFromEnv(env.SYNC_RETENTION_DAYS);
  const syncCutoff = now - syncDays * 24 * 60 * 60 * 1000;
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(syncEvents)
    .where(lt(syncEvents.created_at, syncCutoff));
  const prunedEvents = Number(countRow?.n ?? 0);
  await db.delete(syncEvents).where(lt(syncEvents.created_at, syncCutoff));

  return {
    expired_messages: totalMessagesDeleted,
    pruned_events: prunedEvents
  };
}
