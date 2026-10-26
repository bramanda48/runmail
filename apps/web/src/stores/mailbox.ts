import { getMailboxDb } from "@/db/mailbox-db";
import { ApiError, getMailbox } from "@/lib/api";
import { persistLastMailboxId } from "@/lib/last-mailbox";
import { runDeltaSync } from "@/sync/engine";
import type { PendingMutation } from "@/sync/queue";
import { countPendingMutations, enqueueMutation, flushQueue } from "@/sync/queue";
import type { Mailbox } from "@runmail/shared";
import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";

export type MailboxSyncStatus = "idle" | "syncing" | "synced" | "offline" | "error" | "full_resync";
export type MailboxAccessVerdict = "ok" | "inactive" | "forbidden" | "not_found";

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Active-mailbox store: the mailbox behind the current route (`current`), the
 * router guard's access verdicts, sync status, and the optimistic mutation
 * entry point. Local data lives in the per-mailbox Dexie DB; switching
 * mailboxes preserves every other mailbox's DB + queue (closeMailbox only
 * drops the in-memory selection).
 */
export const useMailboxStore = defineStore("mailbox", () => {
  const mailboxId = ref<string | null>(null);
  const syncStatus = ref<MailboxSyncStatus>("idle");
  const pendingCount = ref(0);

  const current = ref<Mailbox | null>(null);
  const accessible = reactive(new Map<string, Mailbox>());

  const isOpen = computed(() => mailboxId.value !== null);

  async function ensureAccessible(id: string): Promise<MailboxAccessVerdict> {
    const cached = accessible.get(id);
    if (cached) return cached.is_active ? "ok" : "inactive";
    try {
      const { mailbox } = await getMailbox(id);
      accessible.set(id, mailbox);
      return mailbox.is_active ? "ok" : "inactive";
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) return "not_found";
        if (err.status === 403) return "forbidden";
      }
      // Transient failure (network/5xx/401): allow navigation optimistically
      // and do NOT cache — the screen's own data loading surfaces the error.
      return "ok";
    }
  }

  async function refreshPendingCount(): Promise<void> {
    if (!mailboxId.value) {
      pendingCount.value = 0;
      return;
    }
    pendingCount.value = await countPendingMutations(mailboxId.value);
  }

  async function runSync(): Promise<void> {
    const id = mailboxId.value;
    if (!id || syncStatus.value === "syncing") return;
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
    current.value = mailbox;
    persistLastMailboxId(mailbox.id);
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
    current,
    syncStatus,
    pendingCount,
    accessible,
    isOpen,
    ensureAccessible,
    openMailbox,
    runSync,
    enqueue,
    closeMailbox,
    refreshPendingCount,
  };
});
