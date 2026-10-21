<script setup lang="ts">
import EmptyState from "@/components/app/EmptyState.vue";
import Pagination from "@/components/app/Pagination.vue";
import EmailRow from "@/components/email/EmailRow.vue";
import MoveFolderMenu from "@/components/email/MoveFolderMenu.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { LocalFolder, LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";

const { t } = useI18n();

const props = defineProps<{
  messages: LocalMessage[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  total: number;
  page: number;
  perPage: number;
  activeFolder?: LocalFolder;
  folders: LocalFolder[];
  searchQuery: string;
  pendingIds: Set<string>;
  syncing: boolean;
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
  "bulk-trash": [ids: string[]];
  "bulk-mark-read": [ids: string[]];
  "bulk-move": [payload: { ids: string[]; folderId: string }];
  "move-to-single": [payload: { message: LocalMessage; folderId: string }];
}>();

const selectedIds = ref(new Set<string>());

watch(
  () => props.messages,
  () => {
    selectedIds.value = new Set<string>();
  },
);

const allSelected = computed(
  () => props.messages.length > 0 && props.messages.every((m) => selectedIds.value.has(m.id)),
);
const someSelected = computed(() => selectedIds.value.size > 0 && !allSelected.value);
const hasSelection = computed(() => selectedIds.value.size > 0);

function emitBulkIds(which: "bulk-trash" | "bulk-mark-read") {
  const ids = [...selectedIds.value];
  if (which === "bulk-trash") emits("bulk-trash", ids);
  else emits("bulk-mark-read", ids);
  selectedIds.value = new Set<string>();
}

function emitBulkMove(folderId: string) {
  emits("bulk-move", { ids: [...selectedIds.value], folderId });
  selectedIds.value = new Set<string>();
}

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
function selectBy(kind: "all" | "none" | "read" | "unread") {
  if (kind === "none") {
    selectedIds.value = new Set<string>();
  } else if (kind === "all") {
    selectedIds.value = new Set(props.messages.map((m) => m.id));
  } else if (kind === "read") {
    selectedIds.value = new Set(props.messages.filter((m) => m.is_read).map((m) => m.id));
  } else {
    selectedIds.value = new Set(props.messages.filter((m) => !m.is_read).map((m) => m.id));
  }
}

const activeSystemKey = computed(() =>
  props.activeFolder?.folder_type === "system" ? props.activeFolder.name : "",
);

const isTrashFolder = computed(() => activeSystemKey.value === "system.trash");

function emptyIcon() {
  if (activeSystemKey.value === "system.trash") return "lucide:trash";
  if (activeSystemKey.value === "system.spam") return "lucide:shield-alert";
  return "lucide:inbox";
}

const emptyTitle = computed(() => {
  if (activeSystemKey.value === "system.trash") return t("inbox.empty.trashTitle");
  if (activeSystemKey.value === "system.spam") return t("inbox.empty.spamTitle");
  return t("inbox.empty.defaultTitle");
});

const paginationTotal = computed(() => Math.ceil(props.total / props.perPage) * props.perPage);
</script>

<template>
  <div class="flex flex-col">
    <div class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <div
        class="flex items-center divide-x divide-border rounded-md border border-input"
        role="group"
        :aria-label="t('inbox.list.selectGroupLabel')"
      >
        <Button
          variant="ghost"
          size="icon"
          class="rounded-r-none"
          :aria-label="t('inbox.list.selectAll')"
          :aria-checked="allSelected ? 'true' : someSelected ? 'mixed' : 'false'"
          @click="toggleSelectAll"
        >
          <Icon
            :icon="
              allSelected
                ? 'lucide:square-check'
                : someSelected
                  ? 'lucide:square-minus'
                  : 'lucide:square'
            "
            :class="
              cn('size-4', allSelected || someSelected ? 'text-primary' : 'text-muted-foreground')
            "
          />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="rounded-l-none"
              :aria-label="t('inbox.list.selectOptions')"
            >
              <Icon icon="lucide:chevron-down" class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem :disabled="props.messages.length === 0" @select="selectBy('all')">
              {{ t("inbox.list.selectAllItems") }}
            </DropdownMenuItem>
            <DropdownMenuItem @select="selectBy('none')">
              {{ t("inbox.list.selectNone") }}
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="props.messages.length === 0" @select="selectBy('read')">
              {{ t("inbox.list.selectRead") }}
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="props.messages.length === 0" @select="selectBy('unread')">
              {{ t("inbox.list.selectUnread") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <template v-if="!hasSelection">
        <Button
          variant="ghost"
          size="icon"
          :aria-label="t('inbox.list.sync')"
          :title="t('inbox.list.sync')"
          :disabled="syncing"
          @click="emits('refresh')"
        >
          <Icon icon="lucide:refresh-cw" :class="cn('size-4', syncing && 'animate-spin')" />
        </Button>
      </template>
      <template v-else>
        <Button
          variant="ghost"
          size="icon"
          :aria-label="t('inbox.list.markRead')"
          @click="emitBulkIds('bulk-mark-read')"
        >
          <Icon icon="lucide:mail-open" class="size-4" />
        </Button>
        <Button
          v-if="!isTrashFolder"
          variant="ghost"
          size="icon"
          :aria-label="t('inbox.list.deleteSelected')"
          @click="emitBulkIds('bulk-trash')"
        >
          <Icon icon="lucide:trash" class="size-4 text-destructive" />
        </Button>
        <MoveFolderMenu
          :folders="props.folders"
          :current-folder-id="props.activeFolder?.id"
          :label="t('inbox.list.moveSelected')"
          @click.stop
          @move-to-folder="emitBulkMove"
        />
      </template>
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

    <div v-if="loading" class="flex flex-col gap-2">
      <Skeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <div v-else-if="error" class="flex flex-col gap-4">
      <Alert variant="destructive">{{ error }}</Alert>
      <Button variant="ghost" @click="emits('load-more')">{{ t("common.actions.retry") }}</Button>
    </div>

    <EmptyState
      v-else-if="messages.length === 0 && searchQuery"
      icon="lucide:search"
      :heading="t('inbox.search.noResultsTitle')"
      :description="t('inbox.search.noResultsDescription', { query: searchQuery })"
    />

    <EmptyState
      v-else-if="messages.length === 0"
      :icon="emptyIcon()"
      :heading="emptyTitle"
      :description="t('inbox.empty.description')"
    />

    <template v-else>
      <Alert v-if="isTrashFolder" class="rounded-none">
        {{ t("inbox.list.trashNotice") }}
      </Alert>

      <EmailRow
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :pending="pendingIds.has(message.id)"
        :selected="selectedIds.has(message.id)"
        :folders="props.folders"
        :current-folder-id="props.activeFolder?.id"
        @click="emits('click-message', message)"
        @toggle-star="emits('toggle-star', message)"
        @toggle-read="emits('toggle-read', message)"
        @move-to-folder="(folderId: string) => emits('move-to-single', { message, folderId })"
        @trash="emits('trash', message)"
        @toggle-select="toggleSelect(message.id)"
      />

      <p v-if="searchQuery && messages.length >= 50" class="text-sm text-muted-foreground">
        {{ t("inbox.search.limitedResults", { count: 50 }) }}
      </p>
    </template>
  </div>
</template>
