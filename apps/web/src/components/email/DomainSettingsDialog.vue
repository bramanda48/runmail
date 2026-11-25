<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DomainSettingsState } from "@/composables/use-domain-settings";
import { Icon } from "@/icons";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  domainId: string;
  domainName: string;
  state: DomainSettingsState;
  onRetry: () => void;
  onSelectWorker: (workerName: string) => void;
  onToggleSubaddress: (enabled: boolean) => void;
  onAddSubdomain: (name: string) => void;
  onRemoveSubdomain: (name: string) => void;
}>();

const { t } = useI18n();

const newSubdomain = ref("");
const removingName = ref<string | null>(null);

watch(
  () => props.domainId,
  () => {
    newSubdomain.value = "";
    removingName.value = null;
  },
);

const ready = computed(() => props.state.status === "ready");
const updating = computed(
  () => props.state.catchAllBusy || props.state.subaddressBusy || props.state.subdomainsBusy,
);
const DNS_STATUS_KEYS = new Set(["ready", "unconfigured", "misconfigured", "unlocked"]);

function dnsStatusKey(status: string | null): string {
  return status && DNS_STATUS_KEYS.has(status) ? status : "unknown";
}

function handleSelectWorker(value: unknown): void {
  if (typeof value === "string" && value) props.onSelectWorker(value);
}

function handleAdd(): void {
  const label = newSubdomain.value.trim().replace(/\.+$/, "");
  if (!label) return;
  const suffix = `.${props.domainName}`;
  const name = label.endsWith(suffix) ? label : `${label}${suffix}`;
  props.onAddSubdomain(name);
  newSubdomain.value = "";
}

function handleRemove(name: string): void {
  removingName.value = name;
  props.onRemoveSubdomain(name);
}
</script>

<template>
  <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>{{ t("admin.domains.settings.title") }}</DialogTitle>
      <DialogDescription>{{
        t("admin.domains.settings.description", { domain: props.domainName })
      }}</DialogDescription>
    </DialogHeader>

    <div v-if="props.state.status === 'loading'" class="flex flex-col gap-4 py-2">
      <Skeleton v-for="n in 3" :key="n" class="h-24 w-full" />
      <p role="status" class="text-sm text-muted-foreground">
        {{ t("admin.domains.settings.loading") }}
      </p>
    </div>

    <Alert v-else-if="props.state.status === 'error'" variant="destructive">
      <span class="flex flex-wrap items-center gap-2">
        <span>{{ props.state.error || t("admin.domains.settings.loadError") }}</span>
        <Button variant="ghost" size="sm" @click="props.onRetry">
          {{ t("common.actions.retry") }}
        </Button>
      </span>
    </Alert>

    <div v-else class="flex flex-col gap-4 py-2">
      <Card aria-labelledby="settings-catchall">
        <CardHeader>
          <CardTitle>{{ t("admin.domains.settings.catchAll.title") }}</CardTitle>
          <CardDescription>{{ t("admin.domains.settings.catchAll.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <label class="text-sm font-medium text-foreground" for="settings-worker-select">
            {{ t("admin.domains.settings.catchAll.label") }}
          </label>
          <Select
            :model-value="props.state.catchAllWorker || undefined"
            :disabled="!ready || props.state.catchAllBusy"
            @update:model-value="handleSelectWorker"
          >
            <SelectTrigger id="settings-worker-select">
              <SelectValue :placeholder="t('admin.domains.settings.catchAll.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="worker in props.state.workers"
                :key="worker.id"
                :value="worker.name"
              >
                {{ worker.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="props.state.catchAllBusy" role="status" class="text-sm text-muted-foreground">
            {{ t("admin.domains.settings.catchAll.updating") }}
          </p>
          <p
            v-else-if="ready && props.state.workers.length === 0"
            class="text-sm text-muted-foreground"
          >
            {{ t("admin.domains.settings.catchAll.none") }}
          </p>
        </CardContent>
      </Card>

      <Card aria-labelledby="settings-subaddress">
        <CardHeader>
          <CardTitle>{{ t("admin.domains.settings.subaddress.title") }}</CardTitle>
          <CardDescription>{{
            t("admin.domains.settings.subaddress.description")
          }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm text-foreground">{{
              t("admin.domains.settings.subaddress.toggle")
            }}</span>
            <Switch
              :model-value="props.state.subaddressEnabled ?? false"
              :ariaLabel="t('admin.domains.settings.subaddress.toggle')"
              :disabled="!ready || props.state.subaddressBusy"
              @update:model-value="(v) => props.onToggleSubaddress(Boolean(v))"
            />
          </div>
          <p v-if="props.state.subaddressBusy" role="status" class="text-sm text-muted-foreground">
            {{ t("admin.domains.settings.subaddress.updating") }}
          </p>
        </CardContent>
      </Card>

      <Card aria-labelledby="settings-subdomains">
        <CardHeader>
          <CardTitle>{{ t("admin.domains.settings.subdomains.title") }}</CardTitle>
          <CardDescription>{{
            t("admin.domains.settings.subdomains.description")
          }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <div v-if="props.state.subdomainsBusy" class="flex flex-col gap-2">
            <Skeleton v-for="n in 2" :key="n" class="h-10 w-full" />
          </div>
          <Table v-else-if="props.state.subdomains.length > 0">
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.domains.settings.subdomains.name") }}</TableHead>
                <TableHead>{{ t("admin.domains.table.routingStatus") }}</TableHead>
                <TableHead>{{ t("admin.domains.table.dnsStatus") }}</TableHead>
                <TableHead class="w-16">
                  <span class="sr-only">{{ t("admin.domains.settings.subdomains.actions") }}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="sub in props.state.subdomains" :key="sub.id">
                <TableCell class="font-medium">{{ sub.name }}</TableCell>
                <TableCell>
                  <Badge :variant="sub.enabled ? 'secondary' : 'outline'">
                    {{
                      sub.enabled
                        ? t("admin.domains.routingStatus.enabled")
                        : t("admin.domains.routingStatus.disabled")
                    }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {{ t(`admin.domains.dnsStatus.${dnsStatusKey(sub.status)}`) }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="icon"
                    :aria-label="t('admin.domains.settings.subdomains.delete', { name: sub.name })"
                    :disabled="updating"
                    @click="handleRemove(sub.name)"
                  >
                    <Icon
                      v-if="removingName === sub.name && props.state.subdomainsBusy"
                      icon="lucide:loader-circle"
                      class="animate-spin"
                      aria-hidden="true"
                    />
                    <Icon v-else icon="lucide:trash-2" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p v-else class="text-sm text-muted-foreground">
            {{ t("admin.domains.settings.subdomains.empty") }}
          </p>
          <div class="flex items-center gap-2">
            <Input
              v-model="newSubdomain"
              :placeholder="t('admin.domains.settings.subdomains.inputPlaceholder')"
              class="flex-1"
              :disabled="!ready || updating"
              :aria-label="t('admin.domains.settings.subdomains.name')"
              @keyup.enter="handleAdd"
            />
            <span class="whitespace-nowrap text-sm text-muted-foreground">
              .{{ props.domainName }}
            </span>
            <Button :disabled="!ready || updating || !newSubdomain.trim()" @click="handleAdd">
              <Icon icon="lucide:plus" aria-hidden="true" />
              <span>{{ t("admin.domains.settings.subdomains.add") }}</span>
            </Button>
          </div>
          <p class="text-sm text-muted-foreground">
            {{ t("admin.domains.settings.subdomains.hint") }}
          </p>
        </CardContent>
      </Card>
    </div>
  </DialogContent>
</template>
