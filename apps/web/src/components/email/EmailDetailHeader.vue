<script setup lang="ts">
import EmailHeaderInfo from "@/components/email/EmailHeaderInfo.vue";
import { Button } from "@/components/ui/button";
import type { LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { computed } from "vue";

const props = defineProps<{
  message: LocalMessage;
  headers: { key: string; value: string }[];
}>();

const emits = defineEmits<{
  reply: [];
}>();

const initials = computed(() => {
  const name = props.message.from_name?.trim() || props.message.from_address;
  return (name.charAt(0) || "?").toUpperCase();
});

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="px-4 pb-4 pt-8 sm:px-8">
    <h1 class="mb-8 text-2xl font-bold tracking-tight text-foreground">
      {{ message.subject || "(Tanpa subjek)" }}
    </h1>

    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground"
        >
          {{ initials }}
        </div>
        <div class="flex min-w-0 flex-col">
          <div class="flex flex-wrap items-baseline gap-x-1.5">
            <span class="truncate text-sm font-semibold text-foreground">
              {{ message.from_name || message.from_address }}
            </span>
            <span class="truncate text-xs text-muted-foreground">
              &lt;{{ message.from_address }}&gt;
            </span>
          </div>
          <EmailHeaderInfo :message="message" :headers="headers" />
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span class="mr-2 hidden text-sm text-muted-foreground sm:inline-block">
          {{ formatDate(message.email_date) }}
        </span>
        <Button variant="ghost" size="icon" aria-label="Balas" @click="emits('reply')">
          <Icon icon="lucide:reply" class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
