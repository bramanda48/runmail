import type { Mailbox } from "@runmail/shared";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { getMailboxDb } from "@/db/mailbox-db";
import { useMailboxAccessStore } from "@/stores/mailboxAccess";
import { runDeltaSync } from "@/sync/engine";
import type { PendingMutation } from "@/sync/queue";
import { countPendingMutations, enqueueMutation, flushQueue } from "@/sync/queue";

export type MailboxSyncStatus = "idle" | "syncing" | "synced" | "offline" | "error" | "full_resync";

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Active-mailbox runtime store: which mailbox is open, sync status, and the
 * optimistic mutation entry point. Local data lives in the per-mailbox Dexie
 * DB; switching mailboxes preserves every other mailbox's DB + queue
 * (closeMailbox only drops the in-memory selection).
 */
export const useMailboxStore = defineStore("mailbox", () => {
  const mailboxId = ref<string | null>(null);
  const syncStatus = ref<MailboxSyncStatus>("idle");
  const pendingCount = ref(0);

  const isOpen = computed(() => mailboxId.value !== null);

  async function refreshPendingCount(): Promise<void> {
    if (!mailboxId.value) {
      pendingCount.value = 0;
      return;
    }
    pendingCount.value = await countPendingMutations(mailboxId.value);
  }

  async function runSync(): Promise<void> {
    const id = mailboxId.value;
    if (!id) return;
    syncStatus.value = "syncing";
    const result = await runDeltaSync(id);
    // The user may have switched mailboxes mid-sync; never write status for
    // a stale run.
    if (mailboxId.value !== id) return;
    if (!result.ok) {
      syncStatus.value = result.error === "auth" ? "error" : "offline";
      return;
    }
    try {
      const flush = await flushQueue(id);
      if (mailboxId.value !== id) return;
      await refreshPendingCount();
      if (mailboxId.value !== id) return;
      // Session expired mid-flush: the queue is preserved for the next login,
      // so report error instead of synced even though the delta succeeded.
      syncStatus.value = flush.authBlocked ? "error" : "synced";
    } catch {
      // flushQueue handles its own errors; a throw here is unexpected.
      if (mailboxId.value !== id) return;
      await refreshPendingCount();
      if (mailboxId.value !== id) return;
      syncStatus.value = "synced";
    }
  }

  function clearAutoSync() {
    if (autoSyncTimer !== null) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }
  }

  function startAutoSync() {
    clearAutoSync();
    autoSyncTimer = setInterval(() => {
      void runSync();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  function openMailbox(mailbox: Mailbox): void {
    const access = useMailboxAccessStore();
    access.setCurrent(mailbox);
    mailboxId.value = mailbox.id;
    syncStatus.value = "idle";
    pendingCount.value = 0;
    void runSync();
    startAutoSync();
  }

  async function enqueue(mutation: PendingMutation): Promise<void> {
    const id = mailboxId.value;
    if (!id) return;
    const db = getMailboxDb(id);
    await enqueueMutation(db, id, mutation);
    if (mailboxId.value === id) {
      await refreshPendingCount();
    }
  }

  function closeMailbox(): void {
    clearAutoSync();
    // Lifecycle: keep all Dexie data + queues; only drop the selection.
    mailboxId.value = null;
    syncStatus.value = "idle";
    pendingCount.value = 0;
  }

  return {
    mailboxId,
    syncStatus,
    pendingCount,
    isOpen,
    openMailbox,
    runSync,
    enqueue,
    closeMailbox,
    refreshPendingCount
  };
});
