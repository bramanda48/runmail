<script setup lang="ts">
import MailboxWorkspace from "@/components/layouts/MailboxWorkspace.vue";
import ComposeModal from "@/components/email/compose/ComposeModal.vue";
import EmailListContainer from "@/components/email/list/EmailListContainer.vue";
import {
  FOLDER_MESSAGES_PER_PAGE,
  useFolderMessages,
} from "@/composables/use-folder-messages";
import { useMessageMutations } from "@/composables/use-message-mutations";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { useSearchQuerySync } from "@/composables/use-search-query-sync";
import type { LocalMessage } from "@/db/mailbox-db";
import { folderDisplayName } from "@/i18n/folders";
import { useMailboxFoldersStore } from "@/stores/mailbox-folders";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { route, router, mailboxStore, mailboxId, resolveMailbox, unreadCounts } =
  useMailboxWorkspace({
    onResolveError: () => {
      listError.value = t("inbox.errors.loadMailbox");
    },
  });

const folderIdParam = computed(() => route.params.folder_id as string | undefined);

const perPage = FOLDER_MESSAGES_PER_PAGE;

const foldersStore = useMailboxFoldersStore();
const folders = computed(() => foldersStore.folders);
const activeFolderId = ref<string | null>(null);

const { searchQuery, debouncedSearch, applyQueryParam, onSearch } = useSearchQuerySync();

const {
  messages,
  totalMessages,
  page,
  isLoading,
  listError,
  pendingIds,
  showPagination,
  loadMessages,
  goNext,
  goPrev,
} = useFolderMessages(
  activeFolderId,
  debouncedSearch,
  mailboxId,
  () => mailboxStore.mailboxId === mailboxId.value,
  perPage,
);

const refreshTick = ref(0);

const composeOpen = shallowRef(false);

const activeFolder = computed(() => folders.value.find((f) => f.id === activeFolderId.value));

async function loadFolders(force = false) {
  await (force ? foldersStore.refresh(mailboxId.value) : foldersStore.load(mailboxId.value));
  const list = foldersStore.folders;

  if (!activeFolderId.value || !list.some((f) => f.id === activeFolderId.value)) {
    const fromUrl =
      folderIdParam.value && list.some((f) => f.id === folderIdParam.value)
        ? folderIdParam.value
        : null;
    const inbox = list.find((f) => f.folder_type === "system" && f.name === "system.inbox");
    activeFolderId.value = fromUrl ?? inbox?.id ?? list[0]?.id ?? null;
  }
}

function refresh() {
  refreshTick.value += 1;
}

const {
  toggleStar,
  toggleRead,
  moveSingle,
  moveToTrash,
  bulkTrash,
  bulkMarkRead,
  bulkMove,
} = useMessageMutations(messages, folders, refresh);

function openMessage(message: LocalMessage) {
  router.push(`/mailboxes/${mailboxId.value}/messages/${message.id}`);
}

async function initMailbox() {
  page.value = 1;
  applyQueryParam();
  await resolveMailbox();
  if (mailboxStore.mailboxId === mailboxId.value) {
    await loadFolders();
    await loadMessages();
  }
}

onMounted(() => initMailbox());

watch(mailboxId, () => {
  activeFolderId.value = null;
  initMailbox();
});

watch(folderIdParam, () => {
  const id = folderIdParam.value;
  if (id) {
    activeFolderId.value = id;
  } else {
    const inbox = folders.value.find(
      (f) => f.folder_type === "system" && f.name === "system.inbox",
    );
    activeFolderId.value = inbox?.id ?? folders.value[0]?.id ?? null;
  }
  page.value = 1;
});

watch(activeFolderId, () => {
  page.value = 1;
  loadMessages();
});

watch(page, () => loadMessages());
watch(refreshTick, () => loadMessages());
watch(debouncedSearch, () => {
  page.value = 1;
  loadMessages();
});

watch(
  () => mailboxStore.syncStatus,
  async (status) => {
    if (status === "synced") {
      await loadFolders(true);
      refresh();
    }
  },
);
</script>

<template>
  <MailboxWorkspace
    v-model:search-query="searchQuery"
    :mailbox-id="mailboxId"
    :folders="folders"
    :unread-counts="unreadCounts"
    @search="onSearch"
    @compose="composeOpen = true"
  >
    <h1 class="sr-only">
      {{ activeFolder ? folderDisplayName(activeFolder) : t("system.inbox") }}
    </h1>
    <EmailListContainer
      :messages="messages"
      :loading="isLoading"
      :error="listError"
      :has-more="showPagination"
      :total="totalMessages"
      :page="page"
      :per-page="perPage"
      :active-folder="activeFolder"
      :search-query="debouncedSearch"
      :pending-ids="pendingIds"
      :syncing="mailboxStore.syncStatus === 'syncing'"
      :folders="folders"
      @click-message="openMessage"
      @toggle-star="toggleStar"
      @toggle-read="toggleRead"
      @move-to-single="moveSingle"
      @trash="moveToTrash"
      @bulk-trash="bulkTrash"
      @bulk-mark-read="bulkMarkRead"
      @bulk-move="bulkMove"
      @load-more="loadMessages"
      @refresh="mailboxStore.runSync"
      @prev-page="goPrev"
      @next-page="goNext"
    />
    <template #overlays>
      <div class="absolute bottom-0 right-20 z-50">
        <ComposeModal v-model:open="composeOpen" />
      </div>
    </template>
  </MailboxWorkspace>
</template>
