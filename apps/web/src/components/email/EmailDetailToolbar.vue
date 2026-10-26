<script setup lang="ts">
import MoveFolderMenu from "@/components/email/MoveFolderMenu.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  folders: LocalFolder[];
  currentFolderId?: string;
  isRead: boolean;
  /** 1-based position inside the current folder, null when unknown. */
  position: number | null;
  total: number;
  hasOlder: boolean;
  hasNewer: boolean;
}>();
const emits = defineEmits<{
  back: [];
  "toggle-read": [];
  "move-to": [folderId: string];
  older: [];
  newer: [];
}>();

const { t } = useI18n();

const positionLabel = computed(() =>
  props.position !== null && props.total > 0
    ? t("message.position", { position: props.position, total: props.total })
    : "",
);
</script>

<template>
  <div class="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
    <Button
      variant="ghost"
      size="icon"
      :aria-label="t('common.actions.back')"
      class="shadow-none"
      @click="emits('back')"
    >
      <Icon icon="lucide:arrow-left" class="size-4" />
    </Button>

    <div aria-hidden="true" class="mx-1 hidden h-6 w-px bg-border sm:block" />

    <div class="hidden items-center gap-2 sm:flex">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="isRead ? t('message.actions.markUnread') : t('message.actions.markRead')"
        @click="emits('toggle-read')"
      >
        <Icon :icon="isRead ? 'lucide:mail-open' : 'lucide:mail'" class="size-4" />
      </Button>
      <MoveFolderMenu
        :folders="folders"
        :current-folder-id="currentFolderId"
        @move-to-folder="(folderId: string) => emits('move-to', folderId)"
      />
    </div>

    <div class="flex-1" />

    <span
      v-if="positionLabel"
      class="hidden text-xs font-medium text-muted-foreground sm:inline-block"
    >
      {{ positionLabel }}
    </span>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('message.actions.older')"
        :disabled="!hasOlder"
        @click="emits('older')"
      >
        <Icon icon="lucide:chevron-left" class="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        :aria-label="t('message.actions.newer')"
        :disabled="!hasNewer"
        @click="emits('newer')"
      >
        <Icon icon="lucide:chevron-right" class="size-4" />
      </Button>
    </div>
  </div>
</template>
