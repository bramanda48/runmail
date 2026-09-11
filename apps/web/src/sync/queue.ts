import type { SyncMutationItem } from "@runmail/shared";
import { getMailboxDb, type MailboxDb, type QueueMutationType } from "@/db/mailbox-db";
import { ApiError, getMessage, type MutationResult, postMutations } from "@/lib/api";
import { deleteCachedRaw } from "@/lib/raw-cache";
import { runDeltaSync } from "./engine";
import { toLocalMessage } from "./mapping";

/** Backend cap: at most 100 mutations per POST sync/mutations call. */
const FLUSH_CHUNK_SIZE = 100;

export interface PendingMutation {
  message_id: string;
  mutation_type: QueueMutationType;
  mutation_value: boolean | string;
}

function toSyncMutationItem(
  mutationType: QueueMutationType,
  messageId: string,
  mutationValue: boolean | string
): SyncMutationItem | null {
  if (mutationType === "move") {
    if (typeof mutationValue !== "string") return null;
    return { mutation_type: "move", message_id: messageId, mutation_value: mutationValue };
  }
  if (typeof mutationValue !== "boolean") return null;
  return { mutation_type: mutationType, message_id: messageId, mutation_value: mutationValue };
}

/**
 * Applies the optimistic local change FIRST, then appends the queue row.
 * Both happen inside one Dexie transaction so they cannot diverge
 * (a crash between the two would otherwise leave a phantom queue row or an
 * untracked optimistic write). The flush reconciles with the server
 * afterwards.
 */
export async function enqueueMutation(
  db: MailboxDb,
  mailboxId: string,
  mutation: PendingMutation
): Promise<void> {
  void mailboxId;
  const now = Date.now();
  // db.folders is in scope for the move branch's target-folder lookup.
  await db.transaction("rw", [db.messages, db.sync_queue, db.folders], async () => {
    if (mutation.mutation_type === "read" && typeof mutation.mutation_value === "boolean") {
      await db.messages.update(mutation.message_id, {
        is_read: mutation.mutation_value,
        updated_at: now
      });
    } else if (mutation.mutation_type === "star" && typeof mutation.mutation_value === "boolean") {
      await db.messages.update(mutation.message_id, {
        is_starred: mutation.mutation_value,
        updated_at: now
      });
    } else if (mutation.mutation_type === "move" && typeof mutation.mutation_value === "string") {
      // Mirror the server's moveMessage logic: folder_entered_at is stamped
      // only when landing in the Trash/Spam system folders; otherwise null.
      const target = await db.folders.get(mutation.mutation_value);
      const stamp =
        target !== undefined &&
        target.folder_type === "system" &&
        (target.name.toLowerCase() === "trash" || target.name.toLowerCase() === "spam");
      await db.messages.update(mutation.message_id, {
        folder_id: mutation.mutation_value,
        folder_entered_at: stamp ? now : null,
        updated_at: now
      });
    }
    await db.sync_queue.add({
      message_id: mutation.message_id,
      mutation_type: mutation.mutation_type,
      mutation_value: mutation.mutation_value,
      created_at: now,
      attempt_count: 0,
      last_attempt_at: null,
      status: "pending"
    });
  });
}

export async function countPendingMutations(mailboxId: string): Promise<number> {
  const db = getMailboxDb(mailboxId);
  // status is not an index (queue table is keyed by ++id only) — filter instead.
  return db.sync_queue.filter((row) => row.status === "pending").count();
}

/**
 * Reconciles one definitively-rejected mutation with the authoritative
 * server row: rejected mutations emit no sync event, so without this fetch
 * the wrong optimistic write would persist forever. Rejection is definitive
 * — the queue row is already deleted by the caller.
 */
async function reconcileRejectedMessage(
  db: MailboxDb,
  mailboxId: string,
  messageId: string
): Promise<void> {
  try {
    const { message } = await getMessage(mailboxId, messageId);
    await db.messages.put(toLocalMessage(message));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Deleted server-side: drop the local row + its cached raw.
      await db.messages.delete(messageId);
      try {
        await deleteCachedRaw(mailboxId, messageId);
      } catch {
        // Best-effort cleanup.
      }
    }
    // Network/auth failure during reconciliation: the wrong optimistic state
    // persists until the next successful sync; acceptable.
  }
}

export interface FlushResult {
  sent: number;
  rejected: number;
  authBlocked?: boolean;
}

/**
 * Flushes queued mutations FIFO in chunks of 100.
 *
 * Rollback strategy for definitive rejections: the rejected queue row is
 * dropped and the authoritative server row is fetched per rejected
 * message_id (overwriting the wrong optimistic local change); a final
 * runDeltaSync then picks up any other pending server state. A rejection
 * never blocks the rest of the batch. Transient failures keep the rows
 * queued (attempt_count bumped) for a later retry.
 */
export async function flushQueue(mailboxId: string): Promise<FlushResult> {
  const db = getMailboxDb(mailboxId);
  let sent = 0;
  let rejected = 0;
  let authBlocked = false;
  const rejectedIds = new Set<string>();

  for (;;) {
    // FIFO by auto-increment id; status is not an index, so filter in-memory.
    const pending = await db.sync_queue
      .orderBy("id")
      .filter((row) => row.status === "pending")
      .limit(FLUSH_CHUNK_SIZE)
      .toArray();
    if (pending.length === 0) break;

    const items: SyncMutationItem[] = [];
    const rows = [];
    for (const row of pending) {
      const item = toSyncMutationItem(row.mutation_type, row.message_id, row.mutation_value);
      if (item) {
        items.push(item);
        rows.push(row);
      } else {
        // Malformed row (cannot happen via enqueueMutation): drop it so the
        // flush can always make progress.
        if (row.id !== undefined) await db.sync_queue.delete(row.id);
      }
    }
    if (items.length === 0) continue;

    let results: MutationResult[];
    try {
      ({ results } = await postMutations(mailboxId, items));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Auth layer handles re-login; leave the queue untouched.
        authBlocked = true;
        break;
      }
      // Transient (network/5xx): bump attempt counters, keep queued, stop.
      const now = Date.now();
      for (const row of rows) {
        if (row.id === undefined) continue;
        await db.sync_queue.update(row.id, {
          attempt_count: row.attempt_count + 1,
          last_attempt_at: now
        });
      }
      break;
    }

    // Defensive: the server contract guarantees 1:1 positional results.
    // On mismatch we cannot safely map outcomes — treat as transient.
    if (results.length !== rows.length) {
      const now = Date.now();
      for (const row of rows) {
        if (row.id === undefined) continue;
        await db.sync_queue.update(row.id, {
          attempt_count: row.attempt_count + 1,
          last_attempt_at: now
        });
      }
      break;
    }

    // Backend results are positional: results[i] belongs to items[i].
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const result = results[i];
      if (row.id === undefined) continue;
      if (result && result.status === "rejected") {
        rejected += 1;
        rejectedIds.add(row.message_id);
      } else {
        sent += 1;
      }
      await db.sync_queue.delete(row.id);
    }

    if (pending.length < FLUSH_CHUNK_SIZE) break;
  }

  if (rejectedIds.size > 0) {
    for (const messageId of rejectedIds) {
      await reconcileRejectedMessage(db, mailboxId, messageId);
    }
    // Authoritative server state overwrites any remaining wrong optimistic
    // change and picks up other pending server state.
    await runDeltaSync(mailboxId);
  }

  return { sent, rejected, authBlocked };
}
