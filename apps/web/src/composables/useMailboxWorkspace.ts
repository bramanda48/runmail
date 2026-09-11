import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getMailboxDb, type LocalFolder } from "@/db/mailbox-db";
import { ApiError, getMailbox } from "@/lib/api";
import { computeUnreadCounts } from "@/lib/unread-counts";
import { useMailboxStore } from "@/stores/mailbox";
import { useMailboxAccessStore } from "@/stores/mailboxAccess";

export interface MailboxWorkspaceOptions {
  /** Called when mailbox resolution fails for a reason other than 404/403. */
  onResolveError?: () => void;
}

/**
 * Shared mailbox-workspace chrome: route mailbox id, folder list + unread
 * counts, and mailbox resolution. MOVE-ONLY extraction of the identical
 * blocks previously duplicated across the mailbox-scoped views.
 */
export function useMailboxWorkspace(options: MailboxWorkspaceOptions = {}) {
  const route = useRoute();
  const router = useRouter();
  const mailboxStore = useMailboxStore();
  const mailboxAccess = useMailboxAccessStore();

  const mailboxId = computed(() => route.params.mailbox_id as string);

  const localFolders = ref<LocalFolder[]>([]);
  const unreadCounts = ref<Record<string, number>>({});

  async function resolveMailbox(): Promise<void> {
    if (mailboxStore.mailboxId === mailboxId.value) return;

    const current = mailboxAccess.current;
    if (current && current.id === mailboxId.value && current.is_active) {
      mailboxStore.openMailbox(current);
      return;
    }

    try {
      const { mailbox } = await getMailbox(mailboxId.value);
      if (!mailbox.is_active) {
        await router.replace("/mailboxes");
        return;
      }
      mailboxStore.openMailbox(mailbox);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        await router.replace("/mailboxes");
      } else {
        options.onResolveError?.();
      }
    }
  }

  async function loadLocalFolders(): Promise<void> {
    if (mailboxStore.mailboxId !== mailboxId.value) return;
    try {
      const db = getMailboxDb(mailboxId.value);
      localFolders.value = await db.folders.toArray();
      unreadCounts.value = await computeUnreadCounts(db);
    } catch {
      localFolders.value = [];
      unreadCounts.value = {};
    }
  }

  function watchSyncStatus(onSynced?: () => void | Promise<void>): void {
    watch(
      () => mailboxStore.syncStatus,
      async (status) => {
        if (status === "synced") {
          await loadLocalFolders();
          await onSynced?.();
        }
      }
    );
  }

  return {
    route,
    router,
    mailboxStore,
    mailboxId,
    localFolders,
    unreadCounts,
    resolveMailbox,
    loadLocalFolders,
    watchSyncStatus
  };
}
