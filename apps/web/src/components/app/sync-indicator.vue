<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { MailboxSyncStatus } from "@/stores/mailbox";

interface Props {
  status: MailboxSyncStatus;
  pendingCount?: number;
}

const props = defineProps<Props>();

const state = computed(() => {
  switch (props.status) {
    case "syncing":
      return { icon: "lucide:loader-circle", spin: true, text: "Sinkronisasi...", tone: "muted" };
    case "offline":
      return { icon: "lucide:cloud-off", spin: false, text: "Offline", tone: "warning" };
    case "error":
      return { icon: "lucide:circle-alert", spin: false, text: "Gagal sinkron", tone: "error" };
    case "full_resync":
      return { icon: "lucide:refresh-cw", spin: true, text: "Sinkronisasi ulang", tone: "warning" };
    case "synced":
      return { icon: "lucide:check-circle-2", spin: false, text: "Tersinkron", tone: "muted" };
    default:
      return { icon: "lucide:check-circle-2", spin: false, text: "Tersinkron", tone: "muted" };
  }
});

const textClass = computed(() => {
  if (state.value.tone === "error") return "text-destructive";
  if (state.value.tone === "warning") return "text-warning";
  return "text-muted-foreground";
});
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <Icon
      :icon="state.icon"
      :class="cn('size-4', textClass, state.spin && 'animate-spin')"
    />
    <span :class="cn('hidden sm:inline', textClass)">{{ state.text }}</span>
    <Badge v-if="pendingCount" variant="pending" class="text-xs">
      {{ pendingCount }} tertunda
    </Badge>
  </div>
</template>
