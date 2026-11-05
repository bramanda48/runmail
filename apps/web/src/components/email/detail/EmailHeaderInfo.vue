<script setup lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LocalMessage } from "@/db/mailbox-db";
import { formatDateTime } from "@/i18n/format";
import { Icon } from "@/icons";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

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

const rows = computed(() => {
  const fromName = props.message.from_name?.trim();
  const list: { label: string; bold?: string; rest?: string }[] = [
    {
      label: t("message.headerInfo.from"),
      bold: fromName || undefined,
      rest: `<${props.message.from_address}>`,
    },
    {
      label: t("message.headerInfo.to"),
      rest: props.message.to_addresses.join(", ") || t("message.headerInfo.emptyValue"),
    },
    {
      label: t("message.headerInfo.date"),
      rest: formatDateTime(props.message.email_date),
    },
    {
      label: t("message.headerInfo.subject"),
      rest: props.message.subject || t("message.noSubject"),
    },
  ];
  if (mailedBy.value) list.push({ label: t("message.headerInfo.mailedBy"), rest: mailedBy.value });
  if (signedBy.value) list.push({ label: t("message.headerInfo.signedBy"), rest: signedBy.value });
  return list;
});
</script>

<template>
  <Popover>
    <PopoverTrigger
      class="mt-0.5 inline-flex w-max cursor-pointer items-center gap-1 bg-transparent p-0 text-xs text-muted-foreground hover:text-foreground"
    >
      <span>{{ t("message.headerInfo.toMe") }}</span>
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
