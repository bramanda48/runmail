import { folders, messageRecipients, messages, syncEvents } from "@runmail/db";
import type { Message, MessageCursorPayload, PageMeta, SyncMutationItem } from "@runmail/shared";
import { buildMessageCursor, buildPageMeta, isSystemFolder } from "@runmail/shared";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { bumpCounterStmt, emitEventStmt, nextVersionSql } from "../../lib/allocate";
import { type Db, getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import type {
  deleteRawEmail as deleteRawEmailFn,
  getRawEmail as getRawEmailFn
} from "../../lib/r2";
import { deleteRawEmail, getRawEmail as getRawEmailFromR2 } from "../../lib/r2";

export type MessageWithRecipients = Message & { to_addresses: string[] };

export type InboxErrorCode = "NOT_FOUND" | "INVALID_FOLDER" | "NOT_IN_TRASH";

export type InboxError = { error: InboxErrorCode };

type MessageRow = typeof messages.$inferSelect;

type R2Env = Parameters<typeof deleteRawEmailFn>[0];

const SYNC_DELTA_LIMIT = 200;

function toMessage(row: MessageRow, toAddresses: string[] = []): MessageWithRecipients {
  return {
    id: row.id,
    mailbox_id: row.mailbox_id,
    internet_message_id: row.internet_message_id,
    from_name: row.from_name,
    from_address: row.from_address,
    subject: row.subject,
    snippet: row.snippet,
    email_date: row.email_date,
    received_at: row.received_at,
    is_read: row.is_read,
    is_starred: row.is_starred,
    folder_id: row.folder_id,
    folder_entered_at: row.folder_entered_at,
    raw_object_key: row.raw_object_key,
    sync_version: row.sync_version,
    updated_at: row.updated_at,
    to_addresses: toAddresses
  };
}

async function loadToAddresses(db: Db, messageIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const id of messageIds) map.set(id, []);
  if (messageIds.length === 0) return map;
  const rows = await db
    .select({
      message_id: messageRecipients.message_id,
      email_address: messageRecipients.email_address
    })
    .from(messageRecipients)
    .where(
      and(
        inArray(messageRecipients.message_id, messageIds),
        eq(messageRecipients.recipient_type, "to")
      )
    );
  for (const row of rows) {
    const list = map.get(row.message_id);
    if (list) list.push(row.email_address);
    else map.set(row.message_id, [row.email_address]);
  }
  return map;
}

async function loadMessage(
  db: Db,
  mailboxId: string,
  messageId: string
): Promise<MessageRow | null> {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.mailbox_id, mailboxId)))
    .limit(1);
  return row ?? null;
}

async function withRecipients(db: Db, row: MessageRow): Promise<MessageWithRecipients> {
  const toMap = await loadToAddresses(db, [row.id]);
  return toMessage(row, toMap.get(row.id) ?? []);
}

export async function listMessages(
  c: AppContext,
  mailboxId: string,
  limit: number,
  cursor?: MessageCursorPayload
): Promise<{ messages: MessageWithRecipients[]; meta: PageMeta }> {
  const db = getDb(c);
  const keyset = cursor
    ? sql`(${messages.email_date} < ${cursor.email_date} OR (${messages.email_date} = ${cursor.email_date} AND ${messages.id} < ${cursor.message_id}))`
    : undefined;
  const rows = await db
    .select()
    .from(messages)
    .where(
      keyset ? and(eq(messages.mailbox_id, mailboxId), keyset) : eq(messages.mailbox_id, mailboxId)
    )
    .orderBy(desc(messages.email_date), desc(messages.id))
    .limit(limit + 1);

  const meta = buildPageMeta(rows, limit, (row) => ({
    ...buildMessageCursor({ email_date: row.email_date, message_id: row.id })
  }));
  const page = rows.slice(0, limit);
  const toMap = await loadToAddresses(
    db,
    page.map((row) => row.id)
  );
  return {
    messages: page.map((row) => toMessage(row, toMap.get(row.id) ?? [])),
    meta
  };
}

export async function getMessageDetail(
  c: AppContext,
  mailboxId: string,
  messageId: string
): Promise<{ message: MessageWithRecipients } | InboxError> {
  const db = getDb(c);
  const row = await loadMessage(db, mailboxId, messageId);
  if (!row) return { error: "NOT_FOUND" };
  return { message: await withRecipients(db, row) };
}

export async function getRawEmail(
  c: AppContext,
  mailboxId: string,
  messageId: string
): Promise<{ response: Response } | InboxError> {
  const db = getDb(c);
  const row = await loadMessage(db, mailboxId, messageId);
  if (!row) return { error: "NOT_FOUND" };
  const object: Awaited<ReturnType<typeof getRawEmailFn>> = await getRawEmailFromR2(
    c.env,
    row.raw_object_key
  );
  if (!object) return { error: "NOT_FOUND" };
  return {
    response: new Response(object.body, {
      headers: {
        "content-type": "message/rfc822",
        "content-length": String(object.size)
      }
    })
  };
}

async function setFlag(
  c: AppContext,
  mailboxId: string,
  messageId: string,
  field: "is_read" | "is_starred",
  value: boolean
): Promise<{ message: MessageWithRecipients } | InboxError> {
  const db = getDb(c);
  const row = await loadMessage(db, mailboxId, messageId);
  if (!row) return { error: "NOT_FOUND" };
  // No-op optimization: unchanged state emits no event.
  if (row[field] === value) return { message: await withRecipients(db, row) };

  const now = Date.now();
  const versionSql = nextVersionSql(mailboxId);
  const changesJson = JSON.stringify(
    field === "is_read" ? { is_read: value } : { is_starred: value }
  );
  await db.batch([
    bumpCounterStmt(db, mailboxId),
    db
      .update(messages)
      .set({
        ...(field === "is_read" ? { is_read: value } : { is_starred: value }),
        sync_version: versionSql as unknown as number,
        updated_at: now
      })
      .where(eq(messages.id, messageId)),
    emitEventStmt(db, {
      mailbox_id: mailboxId,
      event_type: "message_updated",
      message_id: messageId,
      payload: sql`json_object('message_id', ${messageId}, 'sync_version', ${versionSql}, 'timestamp', ${now}, 'changes', json(${changesJson}))`,
      sync_version_sql: versionSql,
      created_at: now
    })
  ] as unknown as Parameters<typeof db.batch>[0]);

  const updated = await loadMessage(db, mailboxId, messageId);
  if (!updated) return { error: "NOT_FOUND" };
  return { message: await withRecipients(db, updated) };
}

export async function setMessageRead(
  c: AppContext,
  mailboxId: string,
  messageId: string,
  isRead: boolean
): Promise<{ message: MessageWithRecipients } | InboxError> {
  return setFlag(c, mailboxId, messageId, "is_read", isRead);
}

export async function setMessageStarred(
  c: AppContext,
  mailboxId: string,
  messageId: string,
  isStarred: boolean
): Promise<{ message: MessageWithRecipients } | InboxError> {
  return setFlag(c, mailboxId, messageId, "is_starred", isStarred);
}

export async function moveMessage(
  c: AppContext,
  mailboxId: string,
  messageId: string,
  targetFolderId: string
): Promise<{ message: MessageWithRecipients } | InboxError> {
  const db = getDb(c);
  const row = await loadMessage(db, mailboxId, messageId);
  if (!row) return { error: "NOT_FOUND" };

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, targetFolderId), eq(folders.mailbox_id, mailboxId)))
    .limit(1);
  if (!folder) return { error: "INVALID_FOLDER" };

  // No-op optimization: same-folder move emits no event and does not reset
  // the retention clock.
  if (row.folder_id === targetFolderId) {
    return { message: await withRecipients(db, row) };
  }

  const now = Date.now();
  // RETN-2/3: retention clock runs while in Trash/Spam, resets on re-entry.
  const folderName = folder.name.toLowerCase();
  const folderEnteredAt =
    folder.folder_type === "system" &&
    isSystemFolder(folder.name) &&
    (folderName === "trash" || folderName === "spam")
      ? now
      : null;
  const versionSql = nextVersionSql(mailboxId);
  await db.batch([
    bumpCounterStmt(db, mailboxId),
    db
      .update(messages)
      .set({
        folder_id: targetFolderId,
        folder_entered_at: folderEnteredAt,
        sync_version: versionSql as unknown as number,
        updated_at: now
      })
      .where(eq(messages.id, messageId)),
    emitEventStmt(db, {
      mailbox_id: mailboxId,
      event_type: "message_moved",
      message_id: messageId,
      payload: sql`json_object('message_id', ${messageId}, 'folder_id', ${targetFolderId}, 'sync_version', ${versionSql}, 'timestamp', ${now}, 'folder_entered_at', ${folderEnteredAt})`,
      sync_version_sql: versionSql,
      created_at: now
    })
  ] as unknown as Parameters<typeof db.batch>[0]);

  const updated = await loadMessage(db, mailboxId, messageId);
  if (!updated) return { error: "NOT_FOUND" };
  return { message: await withRecipients(db, updated) };
}

export async function permanentDelete(
  c: AppContext,
  mailboxId: string,
  messageId: string,
  env: R2Env
): Promise<{ ok: true } | InboxError> {
  const db = getDb(c);
  const row = await loadMessage(db, mailboxId, messageId);
  if (!row) return { error: "NOT_FOUND" };

  // RETN-6: permanent delete is only allowed from Trash.
  const [folder] = await db.select().from(folders).where(eq(folders.id, row.folder_id)).limit(1);
  if (!folder) return { error: "NOT_IN_TRASH" };
  if (
    folder.folder_type !== "system" ||
    !isSystemFolder(folder.name) ||
    folder.name.toLowerCase() !== "trash"
  ) {
    return { error: "NOT_IN_TRASH" };
  }

  const now = Date.now();
  const versionSql = nextVersionSql(mailboxId);
  const rawKey = row.raw_object_key;
  await db.batch([
    bumpCounterStmt(db, mailboxId),
    emitEventStmt(db, {
      mailbox_id: mailboxId,
      event_type: "message_deleted",
      message_id: messageId,
      payload: sql`json_object('message_id', ${messageId}, 'sync_version', ${versionSql}, 'timestamp', ${now})`,
      sync_version_sql: versionSql,
      created_at: now
    }),
    db.delete(messageRecipients).where(eq(messageRecipients.message_id, messageId)),
    db.delete(messages).where(eq(messages.id, messageId))
  ] as unknown as Parameters<typeof db.batch>[0]);

  await deleteRawEmail(env, rawKey);
  return { ok: true };
}

export type SyncDeltaEvent = {
  sync_version: number;
  event_type: string;
  message_id: string;
  payload: unknown;
};

export type SyncDelta = {
  events: SyncDeltaEvent[];
  last_sync_version: number;
  has_more: boolean;
  full_resync_required?: boolean;
  min_version?: number;
};

export async function getSyncDelta(
  c: AppContext,
  mailboxId: string,
  opts: { last_sync_version?: number; last_sync_timestamp?: number }
): Promise<SyncDelta> {
  const db = getDb(c);
  let cursor = opts.last_sync_version ?? 0;
  // Fallback cursor: translate last_sync_timestamp into the newest version
  // at or before the timestamp; missing cursor means full first sync (0).
  if (opts.last_sync_version === undefined && opts.last_sync_timestamp !== undefined) {
    const [anchor] = await db
      .select({ v: sql<number | null>`max(${syncEvents.sync_version})` })
      .from(syncEvents)
      .where(
        and(
          eq(syncEvents.mailbox_id, mailboxId),
          sql`${syncEvents.created_at} <= ${opts.last_sync_timestamp}`
        )
      );
    cursor = anchor?.v ?? 0;
  }

  const [minRow] = await db
    .select({ v: sql<number | null>`min(${syncEvents.sync_version})` })
    .from(syncEvents)
    .where(eq(syncEvents.mailbox_id, mailboxId));
  const minVersion = minRow?.v ?? null;
  // Pruning gap: history below the client cursor was compacted.
  if (minVersion !== null && minVersion > 1 && cursor < minVersion - 1) {
    return {
      events: [],
      last_sync_version: cursor,
      has_more: false,
      full_resync_required: true,
      min_version: minVersion
    };
  }

  const rows = await db
    .select()
    .from(syncEvents)
    .where(and(eq(syncEvents.mailbox_id, mailboxId), sql`${syncEvents.sync_version} > ${cursor}`))
    .orderBy(asc(syncEvents.sync_version))
    .limit(SYNC_DELTA_LIMIT);

  return {
    events: rows.map((row) => ({
      sync_version: row.sync_version,
      event_type: row.event_type,
      message_id: row.message_id,
      payload: JSON.parse(row.payload) as unknown
    })),
    last_sync_version: rows.length > 0 ? rows[rows.length - 1].sync_version : cursor,
    has_more: rows.length === SYNC_DELTA_LIMIT
  };
}

export type MutationResult = {
  mutation_id: number;
  status: "ok" | "rejected";
  error?: string;
};

export async function processMutations(
  c: AppContext,
  mailboxId: string,
  mutations: SyncMutationItem[]
): Promise<{ results: MutationResult[] }> {
  const results: MutationResult[] = [];
  // FIFO: each mutation is independent; definitive rejections never abort
  // the rest of the batch.
  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];
    try {
      let outcome: { message: MessageWithRecipients } | InboxError;
      if (mutation.mutation_type === "read") {
        outcome = await setMessageRead(c, mailboxId, mutation.message_id, mutation.mutation_value);
      } else if (mutation.mutation_type === "star") {
        outcome = await setMessageStarred(
          c,
          mailboxId,
          mutation.message_id,
          mutation.mutation_value
        );
      } else {
        outcome = await moveMessage(c, mailboxId, mutation.message_id, mutation.mutation_value);
      }
      if ("error" in outcome) {
        results.push({
          mutation_id: i,
          status: "rejected",
          error: outcome.error
        });
      } else {
        results.push({ mutation_id: i, status: "ok" });
      }
    } catch {
      results.push({
        mutation_id: i,
        status: "rejected",
        error: "INTERNAL_ERROR"
      });
    }
  }
  return { results };
}
