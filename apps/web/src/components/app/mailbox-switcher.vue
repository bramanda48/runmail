<script setup lang="ts">
import { useRouter } from "vue-router";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { useMailboxStore } from "@/stores/mailbox";
import { useMailboxAccessStore } from "@/stores/mailboxAccess";

const router = useRouter();
const mailboxStore = useMailboxStore();
const access = useMailboxAccessStore();

function switchMailbox() {
  router.push("/mailboxes");
}

function sync() {
  void mailboxStore.runSync();
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="inline-flex max-w-48 items-center gap-2 rounded-full border border-input bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      @click="switchMailbox"
    >
      <span class="truncate">{{
        access.current?.address || "Pilih mailbox"
      }}</span>
      <Icon
        icon="lucide:chevrons-right"
        class="size-4 shrink-0 text-muted-foreground"
      />
    </button>
    <IconButton
      :ariaLabel="'Sinkronkan'"
      variant="ghost"
      size="sm"
      :disabled="mailboxStore.syncStatus === 'syncing'"
      @click="sync"
    >
      <Icon
        icon="lucide:refresh-cw"
        :class="mailboxStore.syncStatus === 'syncing' ? 'animate-spin' : ''"
      />
    </IconButton>
  </div>
</template>
