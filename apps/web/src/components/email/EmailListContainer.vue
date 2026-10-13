<script setup lang="ts">
import EmptyState from "@/components/app/empty-state.vue";
import Pagination from "@/components/app/pagination.vue";
import CategoryTabs from "@/components/email/category-tabs.vue";
import EmailRow from "@/components/email/email-row.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LocalFolder, LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { computed, ref, shallowRef, watch } from "vue";

const props = defineProps<{
  messages: LocalMessage[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  total: number;
  page: number;
  perPage: number;
  activeFolder?: LocalFolder;
  searchQuery: string;
  pendingIds: Set<string>;
}>();

const emits = defineEmits<{
  "click-message": [message: LocalMessage];
  "toggle-star": [message: LocalMessage];
  "toggle-read": [message: LocalMessage];
  move: [message: LocalMessage];
  trash: [message: LocalMessage];
  "load-more": [];
  "prev-page": [];
  "next-page": [];
  refresh: [];
}>();

const selectedIds = ref(new Set<string>());
const activeTab = shallowRef("utama");

watch(
  () => props.messages,
  () => {
    selectedIds.value = new Set<string>();
  },
);

const allSelected = computed(
  () => props.messages.length > 0 && props.messages.every((m) => selectedIds.value.has(m.id)),
);

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set<string>();
  } else {
    selectedIds.value = new Set(props.messages.map((m) => m.id));
  }
}

const isTrashFolder = computed(() => props.activeFolder?.name.toLowerCase() === "trash");

function emptyIcon() {
  const name = props.activeFolder?.name.toLowerCase() || "inbox";
  if (name === "trash") return "lucide:trash";
  if (name === "spam") return "lucide:shield-alert";
  return "lucide:inbox";
}

function emptyTitle() {
  const name = props.activeFolder?.name.toLowerCase() || "inbox";
  if (name === "trash") return "Trash kosong";
  if (name === "spam") return "Spam kosong";
  return "Belum ada email";
}

const paginationTotal = computed(() => Math.ceil(props.total / props.perPage) * props.perPage);
</script>

<template>
  <Alert v-if="isTrashFolder" class="mb-4">
    Pesan di folder Trash akan dihapus otomatis dalam 30 hari.
  </Alert>

  <div v-if="loading" class="flex flex-col gap-2">
    <Skeleton v-for="n in 4" :key="n" class="h-16 w-full" />
  </div>

  <div v-else-if="error" class="flex flex-col gap-4">
    <Alert variant="destructive">{{ error }}</Alert>
    <Button variant="ghost" @click="emits('load-more')">Coba Lagi</Button>
  </div>

  <EmptyState
    v-else-if="messages.length === 0 && searchQuery"
    icon="lucide:search"
    heading="Tidak ada hasil"
    :description="`Pencarian untuk '${searchQuery}' tidak menemukan email.`"
  />

  <EmptyState
    v-else-if="messages.length === 0"
    :icon="emptyIcon()"
    :heading="emptyTitle()"
    description="Email yang masuk akan tampil di sini."
  />

  <div v-else class="flex flex-col">
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <Button variant="ghost" size="icon" aria-label="Pilih semua" @click="toggleSelectAll">
        <Icon :icon="allSelected ? 'lucide:square-check-big' : 'lucide:square'" class="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Muat ulang" @click="emits('refresh')">
        <Icon icon="lucide:refresh-cw" class="size-4" />
      </Button>
      <Button variant="ghost" size="icon" disabled title="Segera hadir" aria-label="Opsi lainnya">
        <Icon icon="lucide:ellipsis-vertical" class="size-4" />
      </Button>
      <div class="flex-1" />
      <Pagination
        v-if="hasMore"
        :page="page"
        :per-page="perPage"
        :total="paginationTotal"
        :disabled="loading"
        @prev="emits('prev-page')"
        @next="emits('next-page')"
      />
    </div>

    <CategoryTabs v-model="activeTab" />

    <EmailRow
      v-for="message in messages"
      :key="message.id"
      :message="message"
      :pending="pendingIds.has(message.id)"
      :selected="selectedIds.has(message.id)"
      @click="emits('click-message', message)"
      @toggle-star="emits('toggle-star', message)"
      @toggle-read="emits('toggle-read', message)"
      @move="emits('move', message)"
      @trash="emits('trash', message)"
      @toggle-select="toggleSelect(message.id)"
    />

    <p v-if="searchQuery && messages.length >= 50" class="text-sm text-muted-foreground">
      Menampilkan 50 hasil pertama.
    </p>
  </div>
</template>
