<script setup lang="ts">
import EmptyState from "@/components/forms/EmptyState.vue";
import Pagination from "@/components/forms/Pagination.vue";
import AdminShell from "@/components/layouts/AdminShell.vue";
import { Alert } from "@/components/ui/alert";
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
import { useAvailableZones } from "@/composables/use-available-zones";
import { useCloudflareOAuth } from "@/composables/use-cloudflare-oauth";
import { useDomainList } from "@/composables/use-domain-list";
import { Icon } from "@/icons";
import { computed, onMounted } from "vue";
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
  registeredNames,
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

const addDialog = useAvailableZones(() => registeredNames.value, handleOperationError);
const canAdd = computed(
  () => canUseCloudflare.value && !addDialog.isLoadingZones.value && addDialog.selected.value !== "",
);

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
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="domain in domains" :key="domain.id">
                <TableCell class="font-medium">{{ domain.domain_name }}</TableCell>
              </TableRow>
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

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="addDialog.error.value" variant="destructive">{{ addDialog.error.value }}</Alert>
          <div class="flex flex-col gap-1.5">
            <label for="select-domain" class="text-sm font-medium text-foreground">{{
              t("admin.domains.addDialog.domainLabel")
            }}</label>
            <p v-if="addDialog.isLoadingZones.value" role="status" class="text-sm text-muted-foreground">
              {{ t("admin.domains.addDialog.loading") }}
            </p>
            <p v-else-if="addDialog.options.value.length === 0" class="text-sm text-muted-foreground">
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
            variant="ghost"
            :disabled="addDialog.isSubmitting.value"
            @click="addDialog.isOpen.value = false"
          >
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="!canAdd" @click="addDialog.submit(reload)">
            <Icon
              v-if="addDialog.isSubmitting.value"
              icon="lucide:loader-circle"
              class="animate-spin"
            />
            <span>{{ t("admin.domains.addDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
