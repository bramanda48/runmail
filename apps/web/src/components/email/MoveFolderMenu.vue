<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { sortFolders } from "@/lib/folders";
import { computed } from "vue";

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
    label: "Pindahkan ke folder",
    iconClass: "size-4",
    open: undefined,
  },
);

const emits = defineEmits<{
  "move-to-folder": [folderId: string];
  "update:open": [open: boolean];
}>();

const targets = computed(() =>
  sortFolders(props.folders).filter((f) => f.id !== props.currentFolderId),
);
</script>

<template>
  <DropdownMenu :open="open" @update:open="emits('update:open', $event)">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon" :aria-label="label" @click.stop>
        <Icon icon="lucide:folder-input" :class="iconClass" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem v-for="f in targets" :key="f.id" @select="emits('move-to-folder', f.id)">
        {{ f.name }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
