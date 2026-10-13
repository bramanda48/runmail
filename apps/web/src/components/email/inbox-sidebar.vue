<script setup lang="ts">
import FolderNavigation from "@/components/app/folder-navigation.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";

defineProps<{
  mailboxId: string;
  folders: LocalFolder[];
  unreadCounts: Record<string, number>;
}>();

defineEmits<{
  compose: [];
}>();
</script>

<template>
  <div class="flex flex-col gap-4">
    <Button
      variant="secondary"
      class="h-auto w-max rounded-full border border-border px-6 py-4 font-semibold shadow-sm"
      @click="$emit('compose')"
    >
      <Icon icon="lucide:pencil" />
      <span>Tulis</span>
    </Button>
    <FolderNavigation :mailbox-id="mailboxId" :folders="folders" :unread-counts="unreadCounts" />
  </div>
</template>
