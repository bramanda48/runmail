<script setup lang="ts">
import NavItem from "@/components/app/NavItem.vue";
import type { LocalFolder } from "@/db/mailbox-db";
import { folderIcon, sortFolders } from "@/lib/folders";
import { computed } from "vue";
import { useRoute } from "vue-router";

interface Props {
  mailboxId: string;
  folders: LocalFolder[];
  unreadCounts: Record<string, number>;
}

const props = defineProps<Props>();
const route = useRoute();

// sortFolders already yields system-then-custom order; filtering preserves it.
const sortedFolders = computed(() => sortFolders(props.folders));
const systemFolders = computed(() => sortedFolders.value.filter((f) => f.folder_type === "system"));
const customFolders = computed(() => sortedFolders.value.filter((f) => f.folder_type === "custom"));

function folderRoute(folder: LocalFolder) {
  if (folder.folder_type === "system" && folder.name.toLowerCase() === "inbox") {
    return `/mailboxes/${props.mailboxId}/inbox`;
  }
  return `/mailboxes/${props.mailboxId}/folders/${folder.id}`;
}

function isFolderActive(folder: LocalFolder) {
  const path = route.path.toLowerCase();
  const target = folderRoute(folder).toLowerCase();
  return path === target;
}
</script>

<template>
  <nav class="flex flex-col gap-1" aria-label="Folder">
    <NavItem
      v-for="folder in systemFolders"
      :key="folder.id"
      :label="folder.name"
      :icon="folderIcon(folder)"
      :to="folderRoute(folder)"
      :active="isFolderActive(folder)"
      :count="unreadCounts[folder.id] || undefined"
      active-class="bg-accent text-accent-foreground font-semibold"
    />

    <div class="my-3 border-t" />

    <h2 class="mb-3 px-4 text-sm font-semibold text-muted-foreground">Folders</h2>

    <NavItem
      v-for="folder in customFolders"
      :key="folder.id"
      :label="folder.name"
      :icon="folderIcon(folder)"
      :to="folderRoute(folder)"
      :active="isFolderActive(folder)"
      :count="unreadCounts[folder.id] || undefined"
      active-class="bg-accent text-accent-foreground font-semibold"
    />
    <p v-if="customFolders.length === 0" class="px-4 text-xs text-muted-foreground">
      Belum ada folder
    </p>

  </nav>
</template>
