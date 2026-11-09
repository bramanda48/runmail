<script setup lang="ts">
import DomainDnsPanel from "@/components/email/DomainDnsPanel.vue";
import DomainSettingsDialog from "@/components/email/DomainSettingsDialog.vue";
import EmptyState from "@/components/forms/EmptyState.vue";
import Pagination from "@/components/forms/Pagination.vue";
import AdminShell from "@/components/layouts/AdminShell.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAvailableZones } from "@/composables/use-available-zones";
import { useCloudflareOAuth } from "@/composables/use-cloudflare-oauth";
import { useDomainDnsRecords } from "@/composables/use-domain-dns-records";
import { useDomainList } from "@/composables/use-domain-list";
import { useDomainRoutingStatus } from "@/composables/use-domain-routing-status";
import { useDomainSettings } from "@/composables/use-domain-settings";
import { Icon } from "@/icons";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const {
  configured,
  checking,
  statusError,
  reconnect,
  connecting,
  redirecting,
  notice,
  canUseCloudflare,
  checkStatus,
  connect,
  handleOperationError,
} = useCloudflareOAuth();

const {
  domains,
  registeredIds,
  page,
  start,
  end,
  showPagination,
  paginationTotal,
  isLoading,
  error,
  load,
  goNext,
  goPrev,
  reload,
} = useDomainList(handleOperationError);

const routing = useDomainRoutingStatus(canUseCloudflare, handleOperationError);
const settings = useDomainSettings(canUseCloudflare, handleOperationError);
const dns = useDomainDnsRecords(canUseCloudflare, handleOperationError);

watch([() => domains.value.map((d) => d.id), canUseCloudflare], ([ids, allowed]) => {
  if (allowed) void routing.refresh(ids);
});

const addDialog = useAvailableZones(() => registeredIds.value, handleOperationError);
const canAdd = computed(
  () =>
    canUseCloudflare.value && !addDialog.isLoadingZones.value && addDialog.selected.value !== "",
);

const enableTarget = ref<{ id: string; name: string } | null>(null);
const enableSubmitting = ref(false);
const enableError = ref("");

function openEnable(domain: { id: string; domain_name: string }): void {
  enableTarget.value = { id: domain.id, name: domain.domain_name };
  enableError.value = "";
}

async function confirmEnable(): Promise<void> {
  if (!enableTarget.value || enableSubmitting.value) return;
  enableSubmitting.value = true;
  enableError.value = "";
  const ok = await routing.enable(enableTarget.value.id);
  enableSubmitting.value = false;
  if (ok) {
    enableTarget.value = null;
  } else {
    enableError.value = routing.get(enableTarget.value.id).error;
  }
}

const enableConflict = computed(() => {
  if (!enableTarget.value) return false;
  const state = routing.get(enableTarget.value.id);
  return state.status === "error" && state.error_kind === "mx_conflict";
});

const disableTarget = ref<{ id: string; name: string } | null>(null);
const disableSubmitting = ref(false);
const disableError = ref("");

const settingsTarget = ref<{ id: string; name: string } | null>(null);

function openSettings(domain: { id: string; domain_name: string }): void {
  if (!canUseCloudflare.value) return;
  settingsTarget.value = { id: domain.id, name: domain.domain_name };
  void settings.loadSettings(domain.id);
}

function openDisable(domain: { id: string; domain_name: string }): void {
  disableTarget.value = { id: domain.id, name: domain.domain_name };
  disableError.value = "";
}

async function confirmDisable(): Promise<void> {
  if (!disableTarget.value || disableSubmitting.value) return;
  disableSubmitting.value = true;
  disableError.value = "";
  const ok = await routing.disable(disableTarget.value.id);
  disableSubmitting.value = false;
  if (ok) {
    disableTarget.value = null;
  } else {
    disableError.value = routing.get(disableTarget.value.id).error;
  }
}

onMounted(() => load());
</script>

<template>
  <AdminShell>
    <main class="p-4 lg:p-8" :inert="redirecting">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-col gap-1">
          <h1 class="scroll-m-20 text-2xl font-bold tracking-tight text-foreground">
            {{ t("admin.domains.title") }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ t("admin.domains.description") }}
          </p>
        </div>
        <Button :disabled="!canUseCloudflare" @click="addDialog.open">
          <Icon icon="lucide:plus" />
          <span>{{ t("admin.domains.add") }}</span>
        </Button>
      </div>

      <p
        v-if="checking"
        role="status"
        class="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Icon
          icon="lucide:loader-circle"
          class="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {{ t("admin.domains.cloudflare.checking") }}
      </p>
      <Alert v-else-if="statusError" class="mb-6 [&>div]:min-w-0 [&>div]:flex-1">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{{ statusError }}</p>
          <Button class="min-h-11 shrink-0 text-foreground" @click="checkStatus">
            {{ t("admin.domains.cloudflare.checkAgain") }}
          </Button>
        </div>
      </Alert>
      <Alert
        v-else-if="configured === false"
        aria-live="polite"
        class="mb-6 [&>div]:min-w-0 [&>div]:flex-1"
        aria-labelledby="cloudflare-connection-title"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="cloudflare-connection-title" class="font-semibold">
              {{
                reconnect
                  ? t("admin.domains.cloudflare.reconnectTitle")
                  : t("admin.domains.cloudflare.connectTitle")
              }}
            </h2>
            <p class="mt-1">{{ t("admin.domains.cloudflare.connectDescription") }}</p>
            <p class="mt-1">{{ t("admin.domains.cloudflare.redirectNotice") }}</p>
          </div>
          <Button
            class="min-h-11 w-full shrink-0 md:w-auto"
            :disabled="connecting || redirecting"
            :aria-busy="connecting || redirecting"
            @click="connect"
          >
            <Icon
              v-if="connecting || redirecting"
              icon="lucide:loader-circle"
              class="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            {{
              redirecting
                ? t("admin.domains.cloudflare.redirecting")
                : connecting
                  ? t("admin.domains.cloudflare.connecting")
                  : t("admin.domains.cloudflare.connect")
            }}
          </Button>
        </div>
      </Alert>

      <div v-if="isLoading" class="flex flex-col gap-4">
        <Skeleton v-for="n in 4" :key="n" class="h-16 w-full" />
      </div>

      <div v-else-if="error" class="flex flex-col gap-4">
        <Alert variant="destructive">{{ error }}</Alert>
        <Button variant="ghost" @click="reload">{{ t("common.actions.retry") }}</Button>
      </div>

      <EmptyState
        v-else-if="domains.length === 0"
        icon="lucide:globe"
        :heading="t('admin.domains.empty.title')"
        :description="t('admin.domains.empty.description')"
      >
        <template #action>
          <Button class="mt-4" :disabled="!canUseCloudflare" @click="addDialog.open">
            <Icon icon="lucide:plus" />
            <span>{{ t("admin.domains.add") }}</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-lg border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.domains.table.domain") }}</TableHead>
                <TableHead>{{ t("admin.domains.table.routingStatus") }}</TableHead>
                <TableHead>{{ t("admin.domains.table.dnsStatus") }}</TableHead>
                <TableHead colspan="2">
                  {{ t("admin.domains.table.actions") }}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-for="domain in domains" :key="domain.id">
                <TableRow>
                  <TableCell class="font-medium">{{ domain.domain_name }}</TableCell>
                  <TableCell>
                    <Skeleton
                      v-if="['loading', 'idle'].includes(routing.get(domain.id).status)"
                      class="h-6 w-24"
                    />
                    <span v-else-if="!canUseCloudflare" class="text-muted-foreground">-</span>
                    <Badge
                      v-else-if="routing.get(domain.id).status === 'ready'"
                      :variant="routing.get(domain.id).enabled ? 'secondary' : 'outline'"
                    >
                      {{
                        routing.get(domain.id).enabled
                          ? t("admin.domains.routingStatus.enabled")
                          : t("admin.domains.routingStatus.disabled")
                      }}
                    </Badge>
                    <span v-else class="flex items-center gap-2">
                      <span class="text-sm text-destructive">
                        {{ t("admin.domains.routingStatus.loadError") }}
                      </span>
                      <Button variant="ghost" size="sm" @click="routing.retry(domain.id)">
                        {{ t("common.actions.retry") }}
                      </Button>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Skeleton
                      v-if="['loading', 'idle'].includes(routing.get(domain.id).status)"
                      class="h-6 w-24"
                    />
                    <span v-else-if="!canUseCloudflare" class="text-muted-foreground">-</span>
                    <TooltipProvider v-else-if="routing.get(domain.id).status === 'ready'">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Badge variant="secondary" class="cursor-help">
                            {{
                              routing.get(domain.id).dns
                                ? t(`admin.domains.dnsStatus.${routing.get(domain.id).dns}`)
                                : t("admin.domains.dnsStatus.unknown")
                            }}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {{
                              routing.get(domain.id).dns
                                ? t(`admin.domains.dnsStatusHint.${routing.get(domain.id).dns}`)
                                : t("admin.domains.dnsStatusHint.unknown")
                            }}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span v-else class="flex items-center gap-2">
                      <span class="text-sm text-destructive">
                        {{ t("admin.domains.routingStatus.loadError") }}
                      </span>
                      <Button variant="ghost" size="sm" @click="routing.retry(domain.id)">
                        {{ t("common.actions.retry") }}
                      </Button>
                    </span>
                  </TableCell>
                  <TableCell class="w-px">
                    <div class="flex items-center gap-2">
                      <Button
                        v-if="routing.get(domain.id).enabled === false"
                        variant="outline"
                        size="icon"
                        :aria-label="t('admin.domains.routingStatus.enable')"
                        :title="t('admin.domains.routingStatus.enable')"
                        :disabled="!canUseCloudflare || routing.get(domain.id).status === 'loading'"
                        @click="openEnable(domain)"
                      >
                        <Icon icon="lucide:route" aria-hidden="true" />
                      </Button>
                      <Button
                        v-if="routing.get(domain.id).enabled === true"
                        variant="outline"
                        size="icon"
                        :aria-label="t('admin.domains.routingStatus.disable')"
                        :title="t('admin.domains.routingStatus.disable')"
                        :disabled="!canUseCloudflare || routing.get(domain.id).status === 'loading'"
                        @click="openDisable(domain)"
                      >
                        <Icon icon="lucide:route-off" aria-hidden="true" />
                      </Button>
                      <Button
                        v-if="routing.get(domain.id).enabled === true"
                        variant="outline"
                        size="icon"
                        :aria-label="t('admin.domains.settings.open')"
                        :title="t('admin.domains.settings.open')"
                        :disabled="!canUseCloudflare || settingsTarget?.id === domain.id"
                        @click="openSettings(domain)"
                      >
                        <Icon icon="lucide:settings" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell class="w-px">
                    <div class="flex items-center gap-2">
                      <Button
                        :aria-expanded="dns.isExpanded(domain.id)"
                        :disabled="!canUseCloudflare"
                        @click="() => dns.toggle(domain, domain.domain_name)"
                      >
                        <span>{{
                          dns.isExpanded(domain.id)
                            ? t("admin.domains.dnsRecords.hide")
                            : t("admin.domains.dnsRecords.expand")
                        }}</span>
                        <Icon
                          icon="lucide:chevron-down"
                          aria-hidden="true"
                          class="transition-transform"
                          :class="dns.isExpanded(domain.id) ? 'rotate-180' : ''"
                        />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow v-if="dns.isExpanded(domain.id)" :key="`${domain.id}-dns`">
                  <TableCell colspan="5" class="bg-muted/30 p-4">
                    <DomainDnsPanel
                      :state="dns.get(domain.id)"
                      :on-retry-record="(i) => dns.retryRecord(domain.id, i)"
                    />
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>

        <Pagination
          v-if="showPagination"
          :page="page"
          :per-page="10"
          :total="paginationTotal"
          :disabled="isLoading"
          @prev="goPrev"
          @next="goNext"
        >
          <template #range> {{ start }}–{{ end }} </template>
        </Pagination>
      </div>
    </main>

    <div
      class="fixed bottom-4 right-4 left-4 z-50 sm:left-auto sm:w-96"
      aria-live="polite"
      aria-atomic="true"
    >
      <Alert
        v-if="notice"
        :variant="notice.variant === 'error' ? 'destructive' : undefined"
        class="mb-6 [&>div]:min-w-0 [&>div]:flex-1"
      >
        <div class="flex items-start gap-2">
          <p class="flex-1">{{ notice.message }}</p>
          <Button
            variant="ghost"
            class="min-h-11 min-w-11 shrink-0 text-foreground"
            :aria-label="t('admin.domains.closeNoticeAria')"
            @click="notice = null"
          >
            <Icon icon="lucide:x" aria-hidden="true" />
          </Button>
        </div>
      </Alert>
    </div>

    <div
      v-if="redirecting"
      role="status"
      class="fixed inset-0 z-40 flex items-center justify-center bg-background/95 p-6"
    >
      <div class="max-w-sm text-center">
        <Icon
          icon="lucide:loader-circle"
          class="mx-auto mb-4 size-6 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p class="font-semibold">{{ t("admin.domains.cloudflare.redirecting") }}</p>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ t("admin.domains.cloudflare.redirectHint") }}
        </p>
      </div>
    </div>

    <!-- Add domain dialog -->
    <DialogRoot v-model:open="addDialog.isOpen.value">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.domains.addDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.domains.addDialog.description") }}</DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="addDialog.submit(reload)">
          <div class="flex flex-col gap-4 py-2">
            <Alert v-if="addDialog.error.value" variant="destructive">{{
              addDialog.error.value
            }}</Alert>
            <div class="flex flex-col gap-1.5">
              <label for="select-domain" class="text-sm font-medium text-foreground">{{
                t("admin.domains.addDialog.domainLabel")
              }}</label>
              <p
                v-if="addDialog.isLoadingZones.value"
                role="status"
                class="text-sm text-muted-foreground"
              >
                {{ t("admin.domains.addDialog.loading") }}
              </p>
              <p
                v-else-if="addDialog.options.value.length === 0"
                class="text-sm text-muted-foreground"
              >
                {{ t("admin.domains.addDialog.none") }}
              </p>
              <Select v-else v-model="addDialog.selected.value">
                <SelectTrigger id="select-domain" :disabled="addDialog.isSubmitting.value">
                  <SelectValue :placeholder="t('admin.domains.addDialog.domainPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in addDialog.options.value"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              :disabled="addDialog.isSubmitting.value"
              @click="addDialog.isOpen.value = false"
            >
              {{ t("common.actions.cancel") }}
            </Button>
            <Button type="submit" :disabled="!canAdd">
              <Icon
                v-if="addDialog.isSubmitting.value"
                icon="lucide:loader-circle"
                class="animate-spin"
              />
              <span>{{ t("admin.domains.addDialog.submit") }}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>

    <DialogRoot
      :open="enableTarget !== null"
      @update:open="
        (v) => {
          if (!v) enableTarget = null;
        }
      "
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.domains.enableDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{
              enableTarget
                ? t("admin.domains.enableDialog.description", { domain: enableTarget.name })
                : ""
            }}
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="enableConflict && enableTarget" variant="destructive">
          <AlertDescription class="flex flex-col gap-2">
            <p class="font-medium">{{ t("admin.domains.enableDialog.mxConflictTitle") }}</p>
            <p>
              {{ t("admin.domains.enableDialog.mxConflictMessage", { domain: enableTarget.name }) }}
            </p>
          </AlertDescription>
        </Alert>
        <Alert v-else-if="enableError" variant="destructive">{{ enableError }}</Alert>

        <DialogFooter>
          <Button variant="ghost" :disabled="enableSubmitting" @click="enableTarget = null">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="enableSubmitting" @click="confirmEnable">
            <Icon v-if="enableSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.domains.enableDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <DialogRoot
      :open="disableTarget !== null"
      @update:open="
        (v) => {
          if (!v) disableTarget = null;
        }
      "
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.domains.disableDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{
              disableTarget
                ? t("admin.domains.disableDialog.description", { domain: disableTarget.name })
                : ""
            }}
          </DialogDescription>
        </DialogHeader>

        <Alert v-if="disableError" variant="destructive">{{ disableError }}</Alert>

        <DialogFooter>
          <Button variant="ghost" :disabled="disableSubmitting" @click="disableTarget = null">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button variant="destructive" :disabled="disableSubmitting" @click="confirmDisable">
            <Icon v-if="disableSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.domains.disableDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <DialogRoot
      :open="settingsTarget !== null"
      @update:open="
        (v) => {
          if (!v) settingsTarget = null;
        }
      "
    >
      <DomainSettingsDialog
        v-if="settingsTarget"
        :domain-id="settingsTarget.id"
        :domain-name="settingsTarget.name"
        :state="settings.get(settingsTarget.id)"
        :on-retry="() => settingsTarget && settings.retry(settingsTarget.id)"
        :on-select-worker="
          (name) => settingsTarget && settings.updateCatchAll(settingsTarget.id, name)
        "
        :on-toggle-subaddress="
          (v) => settingsTarget && settings.updateSubaddress(settingsTarget.id, v)
        "
        :on-add-subdomain="
          (name) => settingsTarget && settings.addSubdomain(settingsTarget.id, name)
        "
        :on-remove-subdomain="
          (name) => settingsTarget && settings.removeSubdomain(settingsTarget.id, name)
        "
      />
    </DialogRoot>
  </AdminShell>
</template>
