import { getMailboxDb, type LocalFolder } from "@/db/mailbox-db";
import { computeUnreadCounts } from "@/lib/unread-counts";
import { useMailboxStore } from "@/stores/mailbox";
import { defineStore } from "pinia";
import { ref, watch } from "vue";

export type FolderCacheStatus = "idle" | "loading" | "ready" | "stale" | "error";

/**
 * Local projection of the active mailbox's folders and unread counts. Every
 * mailbox-scoped view reads this cache instead of re-scanning the Dexie tables,
 * and the entry goes stale as soon as the local message table can have changed
 * (optimistic mutation) so the next view mount re-reads it.
 */
export const useMailboxFoldersStore = defineStore("mailboxFolders", () => {
  const mailboxId = ref<string | null>(null);
  const folders = ref<LocalFolder[]>([]);
  const unreadCounts = ref<Record<string, number>>({});
  const status = ref<FolderCacheStatus>("idle");

  let inflight: Promise<void> | null = null;
  let inflightId: string | null = null;

  async function read(id: string): Promise<void> {
    const run = (async () => {
      try {
        const db = getMailboxDb(id);
        const list = await db.folders.toArray();
        const counts = await computeUnreadCounts(db, list);
        // The user may switch mailboxes mid-read; never publish a stale
        // mailbox's projection into the active cache.
        if (mailboxId.value !== id) return;
        folders.value = list;
        unreadCounts.value = counts;
        status.value = "ready";
      } catch {
        if (mailboxId.value !== id) return;
        folders.value = [];
        unreadCounts.value = {};
        status.value = "error";
      }
    })();

    inflight = run;
    inflightId = id;
    try {
      await run;
    } finally {
      if (inflight === run) {
        inflight = null;
        inflightId = null;
      }
    }
  }

  async function load(id: string, options: { force?: boolean } = {}): Promise<void> {
    if (!id) return;
    if (!options.force && mailboxId.value === id && status.value === "ready") return;

    if (inflight && inflightId === id) {
      await inflight;
      if (!options.force) return;
    }

    if (mailboxId.value !== id) {
      mailboxId.value = id;
      folders.value = [];
      unreadCounts.value = {};
    }
    status.value = "loading";
    await read(id);
  }

  /** Force a re-read, e.g. after a sync finished. */
  function refresh(id: string): Promise<void> {
    return load(id, { force: true });
  }

  /** Local messages changed: re-read on the next load instead of now. */
  function invalidate(): void {
    if (status.value === "ready") status.value = "stale";
  }

  function clear(): void {
    mailboxId.value = null;
    folders.value = [];
    unreadCounts.value = {};
    status.value = "idle";
  }

  // Closing a mailbox (logout, switch back to the picker) drops the projection;
  // reopening it must not reuse the previous visit's counts.
  const mailboxStore = useMailboxStore();
  watch(
    () => mailboxStore.mailboxId,
    (id) => {
      if (id === null) clear();
    },
  );

  return {
    mailboxId,
    folders,
    unreadCounts,
    status,
    load,
    refresh,
    invalidate,
    clear,
  };
});
