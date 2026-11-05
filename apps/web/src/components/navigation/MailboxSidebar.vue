<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { useMailboxStore, type MailboxSyncStatus } from "@/stores/mailbox";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

defineProps<{
  showCompose?: boolean;
}>();

defineEmits<{
  compose: [];
}>();

const { t } = useI18n();
const mailboxStore = useMailboxStore();

const syncState = computed(() => {
  const status: MailboxSyncStatus = mailboxStore.syncStatus;
  switch (status) {
    case "syncing":
      return {
        icon: "lucide:loader-circle",
        spin: true,
        text: t("shell.mailboxSidebar.status.syncing"),
      };
    case "offline":
      return {
        icon: "lucide:cloud-off",
        spin: false,
        text: t("shell.mailboxSidebar.status.offline"),
      };
    case "error":
      return {
        icon: "lucide:circle-alert",
        spin: false,
        text: t("shell.mailboxSidebar.status.error"),
      };
    case "full_resync":
      return {
        icon: "lucide:refresh-cw",
        spin: true,
        text: t("shell.mailboxSidebar.status.fullResync"),
      };
    default:
      return {
        icon: "lucide:refresh-cw",
        spin: false,
        text: t("shell.mailboxSidebar.status.synced"),
      };
  }
});

const isSyncing = computed(() => mailboxStore.syncStatus === "syncing");
const pendingCount = computed(() => mailboxStore.pendingCount);

function sync() {
  void mailboxStore.runSync();
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 p-4">
    <div v-if="showCompose" class="shrink-0">
      <Button
        variant="secondary"
        class="h-auto w-max cursor-pointer rounded-full border px-6 py-4 font-semibold shadow-xs hover:shadow-sm"
        @click="$emit('compose')"
      >
        <Icon icon="lucide:pencil" />
        <span>{{ t("shell.mailboxSidebar.compose") }}</span>
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <slot />
    </div>

    <div class="shrink-0 border-t pt-3">
      <Button
        variant="ghost"
        class="h-auto w-full justify-start gap-2 px-3 py-2"
        :disabled="isSyncing"
        :title="t('shell.mailboxSidebar.syncNow')"
        @click="sync"
      >
        <Icon
          :icon="syncState.icon"
          :class="['size-4 shrink-0 text-muted-foreground', syncState.spin && 'animate-spin']"
        />
        <span class="flex-1 truncate text-left text-sm text-muted-foreground">{{
          syncState.text
        }}</span>
        <Badge v-if="pendingCount" variant="outline" class="text-xs">
          {{ t("shell.mailboxSidebar.pending", { count: pendingCount }) }}
        </Badge>
      </Button>
    </div>
  </div>
</template>
