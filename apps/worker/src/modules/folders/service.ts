import { folders, messages, rulesetActions, rulesets } from "@runmail/db";
import type { Folder } from "@runmail/shared";
import { isReservedFolderName, isSystemFolder } from "@runmail/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { bumpCounterStmt, emitEventStmt, nextVersionSql } from "../../lib/allocate";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import { isUniqueViolation } from "../../lib/sqlite";

export type FolderErrorCode = "FOLDER_NAME_CONFLICT" | "FOLDER_IS_SYSTEM" | "NOT_FOUND";

export type FolderError = { error: FolderErrorCode };

function toFolder(row: typeof folders.$inferSelect): Folder {
  return {
    id: row.id,
    mailbox_id: row.mailbox_id,
    name: row.name,
    folder_type: row.folder_type,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listFolders(
  c: AppContext,
  mailboxId: string
): Promise<{ folders: Folder[] }> {
  const db = getDb(c);
  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.mailbox_id, mailboxId))
    .orderBy(desc(folders.folder_type), asc(folders.name));
  return { folders: rows.map(toFolder) };
}

export async function createFolder(
  c: AppContext,
  mailboxId: string,
  name: string
): Promise<{ folder: Folder } | FolderError> {
  if (isReservedFolderName(name)) {
    return { error: "FOLDER_IS_SYSTEM" };
  }

  const db = getDb(c);
  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.mailbox_id, mailboxId), sql`lower(${folders.name}) = lower(${name})`))
    .limit(1);
  if (existing.length > 0) {
    return { error: "FOLDER_NAME_CONFLICT" };
  }

  const now = Date.now();
  const id = uuidv7();
  try {
    await db.insert(folders).values({
      id,
      mailbox_id: mailboxId,
      name,
      folder_type: "custom",
      created_at: now,
      updated_at: now
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "FOLDER_NAME_CONFLICT" };
    }
    throw err;
  }

  const [row] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
  if (!row) return { error: "NOT_FOUND" };
  return { folder: toFolder(row) };
}

export async function deleteFolder(
  c: AppContext,
  mailboxId: string,
  folderId: string
): Promise<{ ok: true } | FolderError> {
  const db = getDb(c);

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.mailbox_id, mailboxId)))
    .limit(1);
  if (!folder) return { error: "NOT_FOUND" };
  if (folder.folder_type === "system") return { error: "FOLDER_IS_SYSTEM" };

  const systemFolders = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(and(eq(folders.mailbox_id, mailboxId), eq(folders.folder_type, "system")));
  const inbox = systemFolders.find(
    (f) => f.name.toLowerCase() === "inbox" && isSystemFolder(f.name)
  );
  if (!inbox) return { error: "NOT_FOUND" };

  const moved = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.mailbox_id, mailboxId), eq(messages.folder_id, folderId)));

  const now = Date.now();
  const folderEnteredAt: number | null = null;
  // D1 caps a batch at ~100 statements, so the per-message (bump + update +
  // emit) triples are chunked to <=25 messages per batch, run sequentially.
  // Partial-move semantics are accepted: the FINAL batch carries the
  // ruleset-disable + folder DELETE statements LAST, so the FK 'ON DELETE no
  // action' on messages.folder_id acts as the completeness guard — if a
  // message was concurrently moved INTO the folder between SELECT and batch,
  // the folder DELETE fails loudly (500, retryable; an idempotent re-run
  // re-homes leftovers).
  const CHUNK_SIZE = 25;
  let offset = 0;
  do {
    const chunk = moved.slice(offset, offset + CHUNK_SIZE);
    const isLast = offset + CHUNK_SIZE >= moved.length;
    const stmts = [];
    for (const msg of chunk) {
      const versionSql = nextVersionSql(mailboxId);
      stmts.push(bumpCounterStmt(db, mailboxId));
      stmts.push(
        db
          .update(messages)
          .set({
            folder_id: inbox.id,
            folder_entered_at: null,
            sync_version: versionSql as unknown as number,
            updated_at: now
          })
          .where(eq(messages.id, msg.id))
      );
      stmts.push(
        emitEventStmt(db, {
          mailbox_id: mailboxId,
          event_type: "message_moved",
          message_id: msg.id,
          payload: sql`json_object('message_id', ${msg.id}, 'folder_id', ${inbox.id}, 'sync_version', ${versionSql}, 'timestamp', ${now}, 'folder_entered_at', ${folderEnteredAt})`,
          sync_version_sql: versionSql,
          created_at: now
        })
      );
    }

    if (isLast) {
      stmts.push(
        db
          .update(rulesets)
          .set({ is_enabled: false, updated_at: now })
          .where(
            sql`${rulesets.id} IN (SELECT ${rulesetActions.ruleset_id} FROM ${rulesetActions} WHERE ${rulesetActions.action_type} = 'move_to_folder' AND ${rulesetActions.action_value} = ${folderId})`
          )
      );
      stmts.push(db.delete(folders).where(eq(folders.id, folderId)));
    }

    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);
    offset += CHUNK_SIZE;
  } while (offset < moved.length);

  return { ok: true };
}

export async function renameFolder(
  c: AppContext,
  mailboxId: string,
  folderId: string,
  name: string
): Promise<{ folder: Folder } | FolderError> {
  if (isReservedFolderName(name)) {
    return { error: "FOLDER_IS_SYSTEM" };
  }

  const db = getDb(c);

  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.mailbox_id, mailboxId)))
    .limit(1);
  if (!folder) return { error: "NOT_FOUND" };
  if (folder.folder_type === "system") return { error: "FOLDER_IS_SYSTEM" };

  const existing = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.mailbox_id, mailboxId),
        sql`lower(${folders.name}) = lower(${name})`,
        sql`${folders.id} != ${folderId}`
      )
    )
    .limit(1);
  if (existing.length > 0) {
    return { error: "FOLDER_NAME_CONFLICT" };
  }

  const now = Date.now();
  try {
    await db.update(folders).set({ name, updated_at: now }).where(eq(folders.id, folderId));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "FOLDER_NAME_CONFLICT" };
    }
    throw err;
  }

  const [row] = await db.select().from(folders).where(eq(folders.id, folderId)).limit(1);
  if (!row) return { error: "NOT_FOUND" };
  return { folder: toFolder(row) };
}
