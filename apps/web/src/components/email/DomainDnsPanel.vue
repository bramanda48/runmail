<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DomainDnsState } from "@/composables/use-domain-dns-records";
import { Icon } from "@/icons";
import { useI18n } from "vue-i18n";

defineProps<{
  state: DomainDnsState;
  onRetryRecord: (index: number) => void;
}>();

const { t } = useI18n();

function shortenPart(kind: string, part: string): string {
  if (kind !== "dkim") return part;
  return part.replace(/(\bp=)(\S{8})\S+(\S{4})/, "$1$2...$3");
}

function splitLines(value: string): string[] {
  return value === "" ? [] : value.split("\n");
}
</script>

<template>
  <div v-if="state.status === 'idle'" />
  <div v-else-if="state.status === 'loading'" class="flex flex-col gap-2">
    <Skeleton v-for="n in 4" :key="n" class="h-12 w-full" />
    <p role="status" class="text-sm text-muted-foreground">
      {{ t("admin.domains.dnsRecords.loading") }}
    </p>
  </div>
  <Alert v-else-if="state.status === 'error'" variant="destructive">
    {{ state.error || t("admin.domains.dnsRecords.error") }}
  </Alert>
  <ul v-else class="flex w-full min-w-0 list-none flex-col gap-2 p-0">
    <li
      v-for="(group, index) in state.groups"
      :key="`${group.kind}-${index}`"
      class="flex min-w-0 items-center gap-3 rounded-md border bg-muted/50 p-3"
    >
      <Icon
        :icon="group.status === 'correct' ? 'lucide:circle-check' : 'lucide:circle-x'"
        class="size-5 shrink-0 text-primary"
        aria-hidden="true"
      />

      <div class="w-60 shrink-0">
        <p class="font-semibold text-foreground">
          {{ t(`admin.domains.dnsRecords.group.${group.kind}.label`) }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ t(`admin.domains.dnsRecords.group.${group.kind}.description`) }}
        </p>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-muted-foreground">
          {{ t("admin.domains.dnsRecords.required") }}
        </p>
        <p v-if="!group.expected" class="font-mono text-muted-foreground">—</p>
        <p class="flex gap-3 min-w-0 max-w-full font-mono text-muted-foreground">
          <span
            v-for="(part, partIndex) in splitLines(group.expected)"
            :key="partIndex"
            class="block truncate"
          >
            {{ shortenPart(group.kind, part) }}
            <br v-if="partIndex < splitLines(group.expected).length - 1" />
          </span>
        </p>

        <p class="mt-2 text-xs font-medium text-muted-foreground">
          {{ t("admin.domains.dnsRecords.detected") }}
        </p>
        <p v-if="!group.detected" class="font-mono text-muted-foreground">—</p>
        <p class="flex gap-3 min-w-0 max-w-full font-mono text-muted-foreground">
          <span
            v-for="(part, partIndex) in splitLines(group.detected)"
            :key="partIndex"
            class="block truncate"
          >
            {{ shortenPart(group.kind, part) }}
            <br v-if="partIndex < splitLines(group.detected).length - 1" />
          </span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Skeleton
          v-if="group.status === 'checking' || group.status === 'pending'"
          class="h-6 w-16"
        />
        <span
          v-else-if="group.status === 'correct'"
          class="flex items-center gap-1 text-sm font-medium text-primary"
        >
          {{ t("admin.domains.dnsRecords.status.correct") }}
        </span>
        <span
          v-else-if="group.status === 'incorrect'"
          class="flex items-center gap-1 text-sm font-medium text-destructive"
        >
          {{ t("admin.domains.dnsRecords.status.incorrect") }}
        </span>
        <span v-else class="flex items-center gap-2">
          <span class="flex items-center gap-1 text-sm font-medium text-destructive">
            {{ t("admin.domains.dnsRecords.status.error") }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            :aria-label="t('admin.domains.dnsRecords.retryAria')"
            @click="onRetryRecord(index)"
          >
            <Icon icon="lucide:refresh-cw" class="size-4" aria-hidden="true" />
          </Button>
        </span>
      </div>
    </li>
  </ul>
</template>
