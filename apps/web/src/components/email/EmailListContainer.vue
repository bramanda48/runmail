<script setup lang="ts">
import EmptyState from "@/components/app/empty-state.vue";
import EmailRow from "@/components/email/email-row.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { LocalFolder, LocalMessage } from "@/db/mailbox-db";
import { computed } from "vue";

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
}>();

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
  <Alert v-if="isTrashFolder" variant="warning" class="mb-4">
    Pesan di folder Trash akan dihapus otomatis dalam 30 hari.
  </Alert>

  <div v-if="loading" class="flex flex-col gap-2">
    <Skeleton shape="list" :rows="4" />
  </div>

  <div v-else-if="error" class="flex flex-col gap-4">
    <Alert variant="error">{{ error }}</Alert>
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

  <div v-else class="flex flex-col gap-2">
    <EmailRow
      v-for="message in messages"
      :key="message.id"
      :message="message"
      :pending="pendingIds.has(message.id)"
      @click="emits('click-message', message)"
      @toggle-star="emits('toggle-star', message)"
      @toggle-read="emits('toggle-read', message)"
      @move="emits('move', message)"
      @trash="emits('trash', message)"
    />

    <p v-if="searchQuery && messages.length >= 50" class="text-sm text-muted-foreground">
      Menampilkan 50 hasil pertama.
    </p>

    <Pagination
      v-if="hasMore"
      :page="page"
      :per-page="perPage"
      :total="paginationTotal"
      :disabled="loading"
      @prev="emits('prev-page')"
      @next="emits('next-page')"
    >
      <template #range>
        {{ (page - 1) * perPage + 1 }}– {{ Math.min(page * perPage, total) }} dari {{ total }}
      </template>
    </Pagination>
  </div>
</template>
