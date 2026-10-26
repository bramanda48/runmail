<script setup lang="ts">
import MailboxWorkspace from "@/components/app/MailboxWorkspace.vue";
import ComposeModal from "@/components/email/ComposeModal.vue";
import EmailListContainer from "@/components/email/EmailListContainer.vue";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { getMailboxDb, type LocalMessage } from "@/db/mailbox-db";
import { translateApiError } from "@/i18n/api-errors";
import { folderDisplayName } from "@/i18n/folders";
import { ApiError } from "@/lib/api";
import { parseSearchQuery } from "@/lib/search";
import { useMailboxFoldersStore } from "@/stores/mailbox-folders";
import Dexie from "dexie";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { route, router, mailboxStore, mailboxId, resolveMailbox } = useMailboxWorkspace({
  onResolveError: () => {
    listError.value = t("inbox.errors.loadMailbox");
  },
});

const folderIdParam = computed(() => route.params.folder_id as string | undefined);

const perPage = 10;

const foldersStore = useMailboxFoldersStore();
const { folders, unreadCounts } = storeToRefs(foldersStore);
const activeFolderId = ref<string | null>(null);

const messages = ref<LocalMessage[]>([]);
const totalMessages = ref(0);
const page = ref(1);
const isLoading = ref(false);
const listError = ref("");
const pendingIds = ref<Set<string>>(new Set());

const searchQuery = ref("");
const debouncedSearch = ref("");

const refreshTick = ref(0);

const composeOpen = shallowRef(false);

function queryParamValue() {
  const q = route.query.q;
  return typeof q === "string" ? q : "";
}

function applyQueryParam() {
  const value = queryParamValue();
  searchQuery.value = value;
  debouncedSearch.value = value;
}

const activeFolder = computed(() => folders.value.find((f) => f.id === activeFolderId.value));

const trashFolder = computed(() =>
  folders.value.find((f) => f.folder_type === "system" && f.name === "system.trash"),
);

const showPagination = computed(() => !debouncedSearch.value && totalMessages.value > perPage);

function onSearch(value: string) {
  debouncedSearch.value = value;
  const current = queryParamValue();
  if ((value || "") === current) return;
  router.replace({ query: value ? { q: value } : {} });
}

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

function matchesSearch(message: LocalMessage, filter: ReturnType<typeof parseSearchQuery>) {
  const haystack = (parts: string[], values: (string | null | undefined)[]) => {
    const text = values.filter(Boolean).join(" ").toLowerCase();
    return parts.every((token) => text.includes(token.toLowerCase()));
  };

  if (filter.general.length) {
    if (
      !haystack(filter.general, [
        message.from_name,
        message.from_address,
        ...message.to_addresses,
        message.subject,
      ])
    ) {
      return false;
    }
  }
  if (filter.from.length) {
    if (!haystack(filter.from, [message.from_name, message.from_address])) return false;
  }
  if (filter.to.length) {
    if (!haystack(filter.to, message.to_addresses)) return false;
  }
  if (filter.subject.length) {
    if (!haystack(filter.subject, [message.subject])) return false;
  }
  return true;
}

async function loadMessages() {
  if (!activeFolderId.value || mailboxStore.mailboxId !== mailboxId.value) return;

  isLoading.value = true;
  listError.value = "";
  const db = getMailboxDb(mailboxId.value);

  try {
    // Pending mutation indicator
    const queue = await db.sync_queue.filter((row) => row.status === "pending").toArray();
    pendingIds.value = new Set(queue.map((row) => row.message_id));

    if (debouncedSearch.value) {
      const filter = parseSearchQuery(debouncedSearch.value);
      const results = await db.messages
        .where("folder_id")
        .equals(activeFolderId.value)
        .filter((m) => matchesSearch(m, filter))
        .limit(50)
        .toArray();
      const sorted = results.sort(
        (a, b) => b.email_date - a.email_date || b.received_at - a.received_at,
      );
      messages.value = sorted;
      totalMessages.value = messages.value.length;
      return;
    }

    const folderId = activeFolderId.value;

    const offset = (page.value - 1) * perPage;
    const rows = await db.messages
      .where("[folder_id+email_date]")
      .between([folderId, Dexie.minKey], [folderId, Dexie.maxKey])
      .reverse()
      .offset(offset)
      .limit(perPage)
      .toArray();

    const sorted = rows.sort(
      (a, b) => b.email_date - a.email_date || b.received_at - a.received_at,
    );
    messages.value = sorted;
    totalMessages.value = await db.messages.where("folder_id").equals(folderId).count();
  } catch (err) {
    listError.value =
      err instanceof ApiError ? translateApiError(err) : t("inbox.errors.loadMessages");
  } finally {
    isLoading.value = false;
  }
}

function goNext() {
  if (page.value * perPage >= totalMessages.value) return;
  page.value += 1;
}

function goPrev() {
  if (page.value <= 1) return;
  page.value -= 1;
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

function refresh() {
  refreshTick.value += 1;
}

async function enqueueAndRefresh(mutation: {
  message_id: string;
  mutation_type: "read" | "star" | "move";
  mutation_value: boolean | string;
}) {
  await mailboxStore.enqueue(mutation);
  foldersStore.invalidate();
  refresh();
}

function openMessage(message: LocalMessage) {
  router.push(`/mailboxes/${mailboxId.value}/messages/${message.id}`);
}

function toggleStar(message: LocalMessage) {
  enqueueAndRefresh({
    message_id: message.id,
    mutation_type: "star",
    mutation_value: !message.is_starred,
  });
}

function toggleRead(message: LocalMessage) {
  enqueueAndRefresh({
    message_id: message.id,
    mutation_type: "read",
    mutation_value: !message.is_read,
  });
}

async function moveSingle(payload: { message: LocalMessage; folderId: string }) {
  await enqueueAndRefresh({
    message_id: payload.message.id,
    mutation_type: "move",
    mutation_value: payload.folderId,
  });
}

function moveToTrash(message: LocalMessage) {
  if (!trashFolder.value) return;
  enqueueAndRefresh({
    message_id: message.id,
    mutation_type: "move",
    mutation_value: trashFolder.value.id,
  });
}

async function bulkTrash(ids: string[]) {
  const trash = trashFolder.value;
  if (!trash) return;
  await Promise.all(
    ids.map((id) =>
      enqueueAndRefresh({
        message_id: id,
        mutation_type: "move",
        mutation_value: trash.id,
      }),
    ),
  );
}

async function bulkMarkRead(ids: string[]) {
  const unreadIds = ids.filter((id) => {
    const message = messages.value.find((m) => m.id === id);
    return message ? !message.is_read : false;
  });
  if (unreadIds.length === 0) return;
  await Promise.all(
    unreadIds.map((id) =>
      enqueueAndRefresh({ message_id: id, mutation_type: "read", mutation_value: true }),
    ),
  );
}

async function bulkMove(payload: { ids: string[]; folderId: string }) {
  await Promise.all(
    payload.ids.map((id) =>
      enqueueAndRefresh({
        message_id: id,
        mutation_type: "move",
        mutation_value: payload.folderId,
      }),
    ),
  );
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
  () => route.query.q,
  () => {
    if (queryParamValue() !== debouncedSearch.value) applyQueryParam();
  },
);

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
