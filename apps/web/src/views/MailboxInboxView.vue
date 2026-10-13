<script setup lang="ts">
import MailboxSearchBar from "@/components/app/MailboxSearchBar.vue";
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import Wordmark from "@/components/app/wordmark.vue";
import AccessoryRail from "@/components/email/accessory-rail.vue";
import ComposeModal from "@/components/email/compose-modal.vue";
import EmailListContainer from "@/components/email/EmailListContainer.vue";
import EmailMoveDialog from "@/components/email/EmailMoveDialog.vue";
import InboxSidebar from "@/components/email/inbox-sidebar.vue";
import { Button } from "@/components/ui/button";
import { useMailboxWorkspace } from "@/composables/useMailboxWorkspace";
import { getMailboxDb, type LocalFolder, type LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { parseSearchQuery } from "@/lib/search";
import { computeUnreadCounts } from "@/lib/unread-counts";
import { useMailboxAccessStore } from "@/stores/mailboxAccess";
import Dexie from "dexie";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { RouterLink } from "vue-router";

const { route, router, mailboxStore, mailboxId, resolveMailbox } = useMailboxWorkspace({
  onResolveError: () => {
    listError.value = "Tidak dapat memuat mailbox. Coba lagi.";
  },
});

const mailboxAccess = useMailboxAccessStore();

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

const moveOpen = ref(false);
const movingMessage = ref<LocalMessage | null>(null);

const composeOpen = shallowRef(false);
const drawerOpen = shallowRef(false);
const starredOnly = shallowRef(false);

const activeFolder = computed(() => folders.value.find((f) => f.id === activeFolderId.value));

const trashFolder = computed(() => folders.value.find((f) => f.name.toLowerCase() === "trash"));

const showPagination = computed(() => !debouncedSearch.value && totalMessages.value > perPage);

const avatarInitials = computed(() => {
  const address = mailboxAccess.current?.address;
  if (!address) return "RM";
  return address.slice(0, 2).toUpperCase() || "RM";
});

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
      messages.value = starredOnly.value ? sorted.filter((m) => m.is_starred) : sorted;
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
    if (starredOnly.value) {
      messages.value = sorted.filter((m) => m.is_starred);
      totalMessages.value = messages.value.length;
    } else {
      messages.value = sorted;
      totalMessages.value = await db.messages.where("folder_id").equals(folderId).count();
    }
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

function openMove(message: LocalMessage) {
  movingMessage.value = message;
  moveOpen.value = true;
}

async function confirmMove(targetFolderId: string) {
  if (!movingMessage.value || !targetFolderId) return;
  await enqueueAndRefresh({
    message_id: movingMessage.value.id,
    mutation_type: "move",
    mutation_value: targetFolderId,
  });
  moveOpen.value = false;
}

function moveToTrash(message: LocalMessage) {
  if (!trashFolder.value) return;
  enqueueAndRefresh({
    message_id: message.id,
    mutation_type: "move",
    mutation_value: trashFolder.value.id,
  });
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

watch(starredOnly, () => {
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
  <div class="flex h-screen flex-col overflow-hidden bg-background text-sm">
    <header class="flex h-16 shrink-0 items-center justify-between gap-4 px-4">
      <div class="flex w-auto shrink-0 items-center gap-2 lg:w-64">
        <Button
          variant="ghost"
          size="icon"
          class="lg:hidden"
          aria-label="Buka menu"
          @click="drawerOpen = true"
        >
          <Icon icon="lucide:menu" />
        </Button>
        <RouterLink to="/mailboxes" aria-label="Runmail">
          <Wordmark size="lg" />
        </RouterLink>
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
        <RouterLink
          to="/account"
          class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
          aria-label="Akun"
        >
          {{ avatarInitials }}
        </RouterLink>
      </div>
    </header>

    <div class="relative flex min-w-0 flex-1 gap-0 overflow-hidden">
      <aside class="hidden w-64 shrink-0 flex-col overflow-y-auto px-3 py-3 lg:flex">
        <InboxSidebar
          v-model:starredOnly="starredOnly"
          :mailbox-id="mailboxId"
          :folders="folders"
          :unread-counts="unreadCounts"
          @compose="composeOpen = true"
        />
      </aside>

      <MobileNavDrawer v-model:open="drawerOpen">
        <InboxSidebar
          v-model:starredOnly="starredOnly"
          :mailbox-id="mailboxId"
          :folders="folders"
          :unread-counts="unreadCounts"
          @compose="composeOpen = true"
        />
      </MobileNavDrawer>

      <main
        class="z-10 mx-0 mt-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-x border-t bg-background"
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
          @click-message="openMessage"
          @toggle-star="toggleStar"
          @toggle-read="toggleRead"
          @move="openMove"
          @trash="moveToTrash"
          @load-more="loadMessages"
          @refresh="loadMessages"
          @prev-page="goPrev"
          @next-page="goNext"
        />
      </main>

      <div class="hidden shrink-0 md:flex">
        <AccessoryRail />
      </div>

      <div class="absolute bottom-0 right-[80px] z-50">
        <ComposeModal v-model:open="composeOpen" />
      </div>
    </div>

    <EmailMoveDialog
      v-model:open="moveOpen"
      :folders="folders"
      :current-folder-id="activeFolderId || undefined"
      @move-to-folder="confirmMove"
    />
  </div>
</template>
