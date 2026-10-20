<script setup lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { computed } from "vue";

const props = defineProps<{
  message: LocalMessage;
  /** Raw parsed headers (lowercase key + value), for mailed-by / signed-by. */
  headers: { key: string; value: string }[];
}>();

function headerValue(key: string): string | null {
  const found = props.headers.find((h) => h.key === key);
  return found ? found.value : null;
}

const mailedBy = computed(() => {
  const returnPath = headerValue("return-path");
  if (returnPath) {
    const match = returnPath.match(/<([^>]+)>/) ?? returnPath.match(/([^\s;]+@[^\s;]+)/);
    if (match) return match[1].trim();
    return returnPath.trim() || null;
  }
  const received = headerValue("received");
  if (received) {
    const match = received.match(/by\s+([^\s;]+)/i);
    if (match) return match[1].trim();
  }
  return null;
});

const signedBy = computed(() => {
  const dkim = headerValue("dkim-signature");
  if (!dkim) return null;
  const match = dkim.match(/\bd=([^;\s]+)/i);
  return match ? match[1].trim() : null;
});

function formatFullDate(ts: number) {
  return new Date(ts).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const rows = computed(() => {
  const fromName = props.message.from_name?.trim();
  const list: { label: string; bold?: string; rest?: string }[] = [
    {
      label: "from:",
      bold: fromName || undefined,
      rest: `<${props.message.from_address}>`,
    },
    { label: "to:", rest: props.message.to_addresses.join(", ") || "—" },
    { label: "date:", rest: formatFullDate(props.message.email_date) },
    { label: "subject:", rest: props.message.subject || "(Tanpa subjek)" },
  ];
  if (mailedBy.value) list.push({ label: "mailed-by:", rest: mailedBy.value });
  if (signedBy.value) list.push({ label: "signed-by:", rest: signedBy.value });
  return list;
});
</script>

<template>
  <Popover>
    <PopoverTrigger
      class="mt-0.5 inline-flex w-max cursor-pointer items-center gap-1 bg-transparent p-0 text-xs text-muted-foreground hover:text-foreground"
    >
      <span>kepada saya</span>
      <Icon icon="lucide:chevron-down" class="size-4" />
    </PopoverTrigger>
    <PopoverContent align="start" class="w-[min(28rem,calc(100vw-2rem))]">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <template v-for="row in rows" :key="row.label">
          <dt class="text-right text-muted-foreground">{{ row.label }}</dt>
          <dd class="min-w-0 break-words text-foreground">
            <span v-if="row.bold" class="font-bold">{{ row.bold }} </span>{{ row.rest }}
          </dd>
        </template>
      </dl>
    </PopoverContent>
  </Popover>
</template>
