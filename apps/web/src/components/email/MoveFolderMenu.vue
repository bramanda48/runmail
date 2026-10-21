<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocalFolder } from "@/db/mailbox-db";
import { folderDisplayName } from "@/i18n/folders";
import { Icon } from "@/icons";
import { sortFolders } from "@/lib/folders";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = withDefaults(
  defineProps<{
    folders: LocalFolder[];
    currentFolderId?: string;
    label?: string;
    iconClass?: string;
    open?: boolean;
  }>(),
  {
    currentFolderId: undefined,
    label: undefined,
    iconClass: "size-4",
    open: undefined,
  },
);

const { t } = useI18n();

const emits = defineEmits<{
  "move-to-folder": [folderId: string];
  "update:open": [open: boolean];
}>();

const targets = computed(() =>
  sortFolders(props.folders).filter((f) => f.id !== props.currentFolderId),
);

const ariaLabel = computed(() => props.label ?? t("message.move.label"));
</script>

<template>
  <DropdownMenu :open="open" @update:open="emits('update:open', $event)">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" :aria-label="ariaLabel" @click.stop>
        <Icon icon="lucide:folder-input" :class="iconClass" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem v-for="f in targets" :key="f.id" @select="emits('move-to-folder', f.id)">
        {{ folderDisplayName(f) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
