<script setup lang="ts">
import FolderNavigation from "@/components/app/folder-navigation.vue";
import MailboxSwitcher from "@/components/app/mailbox-switcher.vue";
import NavItem from "@/components/app/nav-item.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";

const props = defineProps<{
  mailboxId: string;
  folders: LocalFolder[];
  unreadCounts: Record<string, number>;
  starredOnly: boolean;
}>();

const emits = defineEmits<{
  compose: [];
  "update:starredOnly": [value: boolean];
}>();

function toggleStarred() {
  emits("update:starredOnly", !props.starredOnly);
}
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <MailboxSwitcher />
    <Button
      variant="secondary"
      class="w-max rounded-full px-6 py-4 font-semibold"
      @click="emits('compose')"
    >
      <Icon icon="lucide:pencil" />
      <span>Tulis</span>
    </Button>
    <NavItem
      label="Berbintang"
      icon="lucide:star"
      :active="props.starredOnly"
      @click="toggleStarred"
    />
    <FolderNavigation
      :mailbox-id="props.mailboxId"
      :folders="props.folders"
      :unread-counts="props.unreadCounts"
    />
  </div>
</template>
