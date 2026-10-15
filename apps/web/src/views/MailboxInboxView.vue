<script setup lang="ts">
import AccountMenu from "@/components/app/AccountMenu.vue";
import FolderNavigation from "@/components/app/FolderNavigation.vue";
import MailboxSearchBar from "@/components/app/MailboxSearchBar.vue";
import MailboxSidebar from "@/components/app/MailboxSidebar.vue";
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import Wordmark from "@/components/app/Wordmark.vue";
import AccessoryRail from "@/components/email/AccessoryRail.vue";
import ComposeModal from "@/components/email/ComposeModal.vue";
import EmailListContainer from "@/components/email/EmailListContainer.vue";
import { Button } from "@/components/ui/button";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { getMailboxDb, type LocalFolder, type LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { parseSearchQuery } from "@/lib/search";
import { computeUnreadCounts } from "@/lib/unread-counts";
import Dexie from "dexie";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";

const { route, router, mailboxStore, mailboxId, resolveMailbox } = useMailboxWorkspace({
  onResolveError: () => {
    listError.value = "Tidak dapat memuat mailbox. Coba lagi.";
  },
});

const folderIdParam = computed(() => route.params.folder_id as string | undefined);

const perPage = 10;

const folders = ref<LocalFolder[]>([]);
const unreadCounts = ref<Record<string, number>>({});
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
const drawerOpen = shallowRef(false);
const sidebarCollapsed = shallowRef(false);

function toggleSidebar() {
  if (window.matchMedia("(min-width: 1024px)").matches) {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  } else {
    drawerOpen.value = true;
  }
}

const activeFolder = computed(() => folders.value.find((f) => f.id === activeFolderId.value));

const trashFolder = computed(() => folders.value.find((f) => f.name.toLowerCase() === "trash"));

const showPagination = computed(() => !debouncedSearch.value && totalMessages.value > perPage);

function onSearch(value: string) {
  debouncedSearch.value = value;
}

async function loadFolders() {
  const db = getMailboxDb(mailboxId.value);
  const list = await db.folders.toArray();
  folders.value = list;

  unreadCounts.value = await computeUnreadCounts(db);

  if (!activeFolderId.value || !list.some((f) => f.id === activeFolderId.value)) {
    const fromUrl =
      folderIdParam.value && list.some((f) => f.id === folderIdParam.value)
        ? folderIdParam.value
        : null;
    const inbox = list.find((f) => f.name.toLowerCase() === "inbox");
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
    listError.value = "Gagal memuat daftar email.";
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
    const inbox = folders.value.find((f) => f.name.toLowerCase() === "inbox");
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
      await loadFolders();
      refresh();
    }
  },
);
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-background text-sm"
    style="
      background-image: url(&quot;https://ssl.gstatic.com/ui/v1/icons/mail/images/2/5/android/bg.png&quot;);
      background-repeat: repeat-x;
      background-position: left top;
    "
  >
    <header class="flex h-16 shrink-0 items-center justify-between gap-4 px-4">
      <div class="flex w-auto min-w-0 shrink-0 items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Buka atau tutup menu"
          @click="toggleSidebar"
        >
          <Icon icon="lucide:menu" />
        </Button>
        <Wordmark size="lg" />
      </div>

      <div class="max-w-2xl flex-1 px-4">
        <MailboxSearchBar v-model="searchQuery" placeholder="Cari di email" @search="onSearch" />
      </div>

      <div class="flex shrink-0 items-center gap-2 lg:w-64 lg:justify-end">
        <Button variant="ghost" size="icon" disabled title="Segera hadir" aria-label="Bantuan">
          <Icon icon="lucide:circle-help" />
        </Button>
        <Button :as="RouterLink" to="/account" variant="ghost" size="icon" aria-label="Pengaturan">
          <Icon icon="lucide:settings" />
        </Button>
        <Button :as="RouterLink" to="/mailboxes" variant="ghost" size="icon" aria-label="Aplikasi">
          <Icon icon="lucide:layout-grid" />
        </Button>
        <AccountMenu />
      </div>
    </header>

    <div class="relative flex min-w-0 flex-1 gap-0 overflow-hidden">
      <aside v-if="!sidebarCollapsed" class="hidden w-64 shrink-0 flex-col overflow-hidden lg:flex">
        <MailboxSidebar show-compose @compose="composeOpen = true">
          <FolderNavigation
            :mailbox-id="mailboxId"
            :folders="folders"
            :unread-counts="unreadCounts"
          />
        </MailboxSidebar>
      </aside>

      <MobileNavDrawer v-model:open="drawerOpen">
        <MailboxSidebar show-compose @compose="composeOpen = true">
          <FolderNavigation
            :mailbox-id="mailboxId"
            :folders="folders"
            :unread-counts="unreadCounts"
          />
        </MailboxSidebar>
      </MobileNavDrawer>

      <main
        class="z-10 mx-0 mt-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl shadow-xs border bg-background"
      >
        <h1 class="sr-only">{{ activeFolder?.name || "Inbox" }}</h1>
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
          @refresh="loadMessages"
          @prev-page="goPrev"
          @next-page="goNext"
        />
      </main>

      <div class="hidden shrink-0 md:flex">
        <AccessoryRail />
      </div>

      <div class="absolute bottom-0 right-20 z-50">
        <ComposeModal v-model:open="composeOpen" />
      </div>
    </div>
  </div>
</template>
