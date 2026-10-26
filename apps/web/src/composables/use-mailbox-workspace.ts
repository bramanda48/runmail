import { useMailboxStore } from "@/stores/mailbox";
import { useMailboxFoldersStore } from "@/stores/mailbox-folders";
import { storeToRefs } from "pinia";
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

export interface MailboxWorkspaceOptions {
  onResolveError?: () => void;
}

/**
 * Shared mailbox-workspace chrome: route mailbox id, mailbox resolution, and
 * the folder projection owned by `useMailboxFoldersStore`. Route reading and
 * navigation stay here: a store must not depend on the router.
 */
export function useMailboxWorkspace(options: MailboxWorkspaceOptions = {}) {
  const route = useRoute();
  const router = useRouter();
  const mailboxStore = useMailboxStore();
  const foldersStore = useMailboxFoldersStore();

  const mailboxId = computed(() => route.params.mailbox_id as string);

  const { folders: localFolders, unreadCounts } = storeToRefs(foldersStore);

  async function resolveMailbox(): Promise<void> {
    if (mailboxStore.mailboxId === mailboxId.value) return;

    console.log(mailboxId.value);
    const mailbox = mailboxStore.accessible.get(mailboxId.value);
    if (mailbox) {
      mailboxStore.openMailbox(mailbox);
      return;
    }

    // Transient failure: keep the route, let the screen report its own error.
    options.onResolveError?.();
  }

  async function loadLocalFolders(): Promise<void> {
    if (mailboxStore.mailboxId !== mailboxId.value) return;
    await foldersStore.refresh(mailboxId.value);
  }

  function watchSyncStatus(onSynced?: () => void | Promise<void>): void {
    watch(
      () => mailboxStore.syncStatus,
      async (status) => {
        if (status === "synced") {
          await loadLocalFolders();
          await onSynced?.();
        }
      },
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
    watchSyncStatus,
  };
}
