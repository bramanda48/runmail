<script setup lang="ts">
import AdminShell from "@/components/app/AdminShell.vue";
import EmptyState from "@/components/app/EmptyState.vue";
import Pagination from "@/components/app/Pagination.vue";
import { Alert } from "@/components/ui/alert";
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
import { useCloudflareOAuth } from "@/composables/use-cloudflare-oauth";
import { translateApiError } from "@/i18n/api-errors";
import { Icon } from "@/icons";
import { ApiError, addDomain, listAvailableDomains, listDomains, verifyDomain } from "@/lib/api";
import type { ApiMeta, Domain, DomainVerificationStatus } from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
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

const perPage = 10;

const domains = ref<Domain[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");
const verifyError = ref("");
const verifyingId = ref<string | null>(null);

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + domains.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage,
);

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = await listDomains(cursor, perPage);
    domains.value = data.domains;
    meta.value = responseMeta ?? null;
    if (
      meta.value?.has_more &&
      meta.value.next_cursor &&
      cursors.value.length === pageIndex.value + 1
    ) {
      cursors.value.push(meta.value.next_cursor);
    }
  } catch (err) {
    handleOperationError(err);
    if (err instanceof ApiError) {
      error.value = translateApiError(err);
    } else {
      error.value = t("admin.domains.loadError");
    }
  } finally {
    isLoading.value = false;
  }
}

function goNext() {
  if (!meta.value?.has_more || cursors.value.length <= pageIndex.value + 1) {
    return;
  }
  pageIndex.value += 1;
  load(cursors.value[pageIndex.value]);
}

function goPrev() {
  if (pageIndex.value <= 0) return;
  pageIndex.value -= 1;
  load(cursors.value[pageIndex.value]);
}

function retry() {
  load(cursors.value[pageIndex.value]);
}

onMounted(() => load(undefined));

function statusBadge(status: DomainVerificationStatus) {
  return status === "active" ? "secondary" : "outline";
}

const statusLabels = computed<Record<DomainVerificationStatus, string>>(() => ({
  active: t("admin.domainStatus.active"),
  pending_verification: t("admin.domainStatus.pendingVerification"),
}));

async function handleVerify(domain: Domain) {
  if (!canUseCloudflare.value || verifyingId.value) return;
  verifyingId.value = domain.id;
  verifyError.value = "";
  try {
    const result = await verifyDomain(domain.id);
    const index = domains.value.findIndex((d) => d.id === domain.id);
    if (index !== -1 && result.domain) {
      domains.value[index] = result.domain;
    }
  } catch (err) {
    if (handleOperationError(err)) return;
    if (err instanceof ApiError) {
      verifyError.value = translateApiError(err);
    } else {
      verifyError.value = t("admin.domains.verifyError");
    }
  } finally {
    verifyingId.value = null;
  }
}

// Add domain dialog
const addOpen = ref(false);
const availableDomains = ref<{ value: string; label: string }[]>([]);
const selectedDomain = ref("");
const loadingAvailable = ref(false);
const addInlineError = ref("");
const addSubmitting = ref(false);

async function openAddDialog() {
  if (!canUseCloudflare.value) return;
  addOpen.value = true;
  availableDomains.value = [];
  selectedDomain.value = "";
  addInlineError.value = "";
  loadingAvailable.value = true;
  try {
    const { zones } = await listAvailableDomains();
    availableDomains.value = zones.map((z) => ({ value: z.name, label: z.name }));
  } catch (err) {
    if (handleOperationError(err)) {
      addOpen.value = false;
      return;
    }
    if (err instanceof ApiError) {
      addInlineError.value = translateApiError(err);
    } else {
      addInlineError.value = t("admin.domains.availableError");
    }
  } finally {
    loadingAvailable.value = false;
  }
}

async function submitAdd() {
  if (!canUseCloudflare.value || addSubmitting.value) return;
  addInlineError.value = "";
  if (!selectedDomain.value) {
    addInlineError.value = t("admin.domains.validation.domainRequired");
    return;
  }
  addSubmitting.value = true;
  try {
    await addDomain(selectedDomain.value);
    addOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (handleOperationError(err)) {
      addOpen.value = false;
      return;
    }
    if (err instanceof ApiError) {
      addInlineError.value = translateApiError(err);
    } else {
      addInlineError.value = t("admin.domains.addError");
    }
  } finally {
    addSubmitting.value = false;
  }
}
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
        <Button :disabled="!canUseCloudflare" @click="openAddDialog">
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
          <Button variant="outline" class="min-h-11 shrink-0 text-foreground" @click="checkStatus"
            >{{ t("admin.domains.cloudflare.checkAgain") }}</Button
          >
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
        <Button variant="ghost" @click="retry">{{ t("common.actions.retry") }}</Button>
      </div>

      <EmptyState
        v-else-if="domains.length === 0"
        icon="lucide:globe"
        :heading="t('admin.domains.empty.title')"
        :description="t('admin.domains.empty.description')"
      >
        <template #action>
          <Button class="mt-4" :disabled="!canUseCloudflare" @click="openAddDialog">
            <Icon icon="lucide:plus" />
            <span>{{ t("admin.domains.add") }}</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <Alert v-if="verifyError" variant="destructive">{{ verifyError }}</Alert>

        <div class="rounded-lg border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.domains.table.domain") }}</TableHead>
                <TableHead>{{ t("admin.domains.table.status") }}</TableHead>
                <TableHead class="w-24">{{ t("admin.domains.table.actions") }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="domain in domains" :key="domain.id">
                <TableCell class="font-medium">{{ domain.domain_name }}</TableCell>
                <TableCell>
                  <Badge :variant="statusBadge(domain.verification_status)">
                    {{ statusLabels[domain.verification_status] }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    :aria-label="t('admin.domains.verifyAria', { domain: domain.domain_name })"
                    variant="ghost"
                    size="icon"
                    :disabled="
                      !canUseCloudflare ||
                      domain.verification_status === 'active' ||
                      verifyingId !== null
                    "
                    @click="handleVerify(domain)"
                  >
                    <Icon
                      icon="lucide:refresh-cw"
                      :class="verifyingId === domain.id ? 'animate-spin' : ''"
                    />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <Pagination
          v-if="showPagination"
          :page="page"
          :per-page="perPage"
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
    <DialogRoot v-model:open="addOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.domains.addDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.domains.addDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="addInlineError" variant="destructive">{{ addInlineError }}</Alert>

          <div v-if="loadingAvailable" class="text-sm text-muted-foreground">
            {{ t("admin.domains.addDialog.loading") }}
          </div>
          <Alert v-else-if="availableDomains.length === 0 && !addInlineError">
            {{ t("admin.domains.addDialog.none") }}
          </Alert>
          <div v-else class="flex flex-col gap-1.5">
            <label for="select-domain" class="text-sm font-medium text-foreground">{{
              t("admin.domains.addDialog.domainLabel")
            }}</label>
            <Select v-model="selectedDomain">
              <SelectTrigger id="select-domain" :disabled="loadingAvailable || addSubmitting">
                <SelectValue :placeholder="t('admin.domains.addDialog.domainPlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in availableDomains"
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
          <Button variant="ghost" :disabled="addSubmitting" @click="addOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button
            :disabled="addSubmitting || !selectedDomain || availableDomains.length === 0"
            @click="submitAdd"
          >
            <Icon v-if="addSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.domains.addDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
