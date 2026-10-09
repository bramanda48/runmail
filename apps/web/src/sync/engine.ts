import type { LocalMessage } from "@/db/mailbox-db";
import { getMailboxDb } from "@/db/mailbox-db";
import type { MessageList, RequestWithMeta, SyncDelta } from "@/lib/api";
import { ApiError, getSyncDelta, listFolders, listMessages } from "@/lib/api";
import { applySyncEvent, type EventTables } from "./events";
import { toLocalMessage } from "./mapping";

export type SyncRunResult =
  { ok: true; last_sync_version: number } | { ok: false; error: "network" | "auth" };

/** In-flight runs per mailbox — concurrent callers share one promise. */
const inflightRuns = new Map<string, Promise<SyncRunResult>>();

export async function runDeltaSync(mailboxId: string): Promise<SyncRunResult> {
  const existing = inflightRuns.get(mailboxId);
  if (existing) return existing;
  const run = doRunDeltaSync(mailboxId).finally(() => {
    inflightRuns.delete(mailboxId);
  });
  inflightRuns.set(mailboxId, run);
  return run;
}

type RebuildResult = { ok: true } | { ok: false; error: "network" | "auth" };

/**
 * Rebuilds the local message table from a full snapshot: pages the message
 * list (keyset cursor, 50 per page) until has_more is false. Used after a
 * full_resync_required, when the delta history below the min_version
 * watermark has been pruned server-side.
 */
async function rebuildMessagesFromSnapshot(mailboxId: string): Promise<RebuildResult> {
  const db = getMailboxDb(mailboxId);
  let cursor: string | undefined;
  for (;;) {
    let page: RequestWithMeta<MessageList>;
    try {
      page = await listMessages(mailboxId, cursor, 50);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        return { ok: false, error: "auth" };
      }
      return { ok: false, error: "network" };
    }
    await db.messages.bulkPut(page.data.messages.map(toLocalMessage));
    const meta = page.meta;
    if (!meta?.has_more || !meta.next_cursor) break;
    cursor = meta.next_cursor;
  }
  return { ok: true };
}

async function doRunDeltaSync(mailboxId: string): Promise<SyncRunResult> {
  const db = getMailboxDb(mailboxId);

  let state = await db.sync_state.get("state");
  if (!state) {
    const now = Date.now();
    state = {
      id: "state",
      last_sync_version: 0,
      last_sync_timestamp: 0,
      latest_message_id: null,
      last_full_sync_at: null,
      updated_at: now,
    };
    await db.sync_state.put(state);
  }
  let cursor = state.last_sync_version;

  const tables: EventTables = {
    getMessage: (id) => db.messages.get(id),
    putMessage: (msg: LocalMessage) => db.messages.put(msg).then(() => undefined),
    updateMessage: (id, changes) => db.messages.update(id, changes).then(() => undefined),
    deleteMessage: (id) => db.messages.delete(id),
  };

  // Event loop: follow has_more until the delta is fully consumed.
  // resyncHandled guards against a repeat full_resync_required within one
  // run (should not happen): without it a pruned server would re-signal
  // forever since cursor 0 stays below the min_version watermark.
  let resyncHandled = false;
  for (;;) {
    let delta: SyncDelta;
    try {
      delta = await getSyncDelta(mailboxId, { last_sync_version: cursor });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        return { ok: false, error: "auth" };
      }
      // Network failure or 5xx: state is NOT advanced; retry later.
      return { ok: false, error: "network" };
    }

    if (delta.full_resync_required) {
      if (resyncHandled) {
        return { ok: false, error: "network" };
      }
      resyncHandled = true;
      // Rebuild: clear messages, then re-fetch the full snapshot via the
      // message list (the delta history below min_version is pruned
      // server-side, so resetting the cursor to 0 would loop forever).
      // Events in this branch are below the watermark — ignore them.
      // The sync_queue is KEPT — queued mutations are replayed afterwards.
      // Folders are NOT cleared here: the unconditional replace-all folders
      // refresh after the loop already rebuilds that projection.
      await db.messages.clear();
      const rebuilt = await rebuildMessagesFromSnapshot(mailboxId);
      if (!rebuilt.ok) return rebuilt;
      // Resume the delta from the pruned watermark the server sent.
      const watermark = delta.min_version ?? 0;
      const now = Date.now();
      cursor = watermark;
      state = {
        ...state,
        last_sync_version: watermark,
        last_full_sync_at: now,
        updated_at: now,
      };
      await db.sync_state.put(state);
      continue;
    }

    for (const event of delta.events) {
      await applySyncEvent(tables, event);
    }
    cursor = delta.last_sync_version;
    if (!delta.has_more) break;
  }

  // Folders are NOT carried by sync events — refresh the local projection
  // from GET listFolders on every sync run (replace-all semantics).
  try {
    const { folders } = await listFolders(mailboxId);
    const now = Date.now();
    await db.folders.clear();
    await db.folders.bulkPut(
      folders.map((f) => ({
        id: f.id,
        name: f.name,
        folder_type: f.folder_type,
        updated_at: now,
      })),
    );
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return { ok: false, error: "auth" };
    }
    return { ok: false, error: "network" };
  }

  const now = Date.now();
  state = { ...state, last_sync_version: cursor, last_sync_timestamp: now, updated_at: now };
  await db.sync_state.put(state);

  // Raw .eml eviction for deleted messages is best-effort via
  // clearMailboxRawCache on logout; per-message eviction is skipped here to
  // keep the sync loop simple (tombstones arrive as message_deleted events
  // without mailbox context at this layer).
  return { ok: true, last_sync_version: cursor };
}
