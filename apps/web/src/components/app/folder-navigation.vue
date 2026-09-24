<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import NavItem from "@/components/app/nav-item.vue";
import type { LocalFolder } from "@/db/mailbox-db";

interface Props {
  mailboxId: string;
  folders: LocalFolder[];
  unreadCounts: Record<string, number>;
}

const props = defineProps<Props>();
const route = useRoute();

const systemOrder = ["inbox", "archive", "spam", "trash"];

const sortedFolders = computed(() => {
  const system = props.folders
    .filter((f) => f.folder_type === "system")
    .sort((a, b) => {
      const ai = systemOrder.indexOf(a.name.toLowerCase());
      const bi = systemOrder.indexOf(b.name.toLowerCase());
      if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  const custom = props.folders
    .filter((f) => f.folder_type === "custom")
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...system, ...custom];
});

function folderIcon(folder: LocalFolder) {
  if (folder.folder_type !== "system") return "lucide:folder";
  const name = folder.name.toLowerCase();
  if (name === "inbox") return "lucide:inbox";
  if (name === "archive") return "lucide:archive";
  if (name === "spam") return "lucide:shield-alert";
  if (name === "trash") return "lucide:trash";
  return "lucide:folder";
}

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
  <nav class="flex flex-col gap-1 p-4" aria-label="Folder">
    <NavItem
      v-for="folder in sortedFolders"
      :key="folder.id"
      :label="folder.name"
      :icon="folderIcon(folder)"
      :to="folderRoute(folder)"
      :active="isFolderActive(folder)"
      :count="unreadCounts[folder.id] || undefined"
    />

    <div class="my-3 border-t" />

    <NavItem
      label="Kelola Folder"
      icon="lucide:folder-plus"
      :to="`/mailboxes/${mailboxId}/folders`"
      :active="route.path === `/mailboxes/${mailboxId}/folders`"
    />
    <NavItem
      label="Ruleset"
      icon="lucide:filter"
      :to="`/mailboxes/${mailboxId}/rulesets`"
      :active="route.path === `/mailboxes/${mailboxId}/rulesets`"
    />
  </nav>
</template>
