<script setup lang="ts">
import type { ApiMeta, Domain, DomainVerificationStatus } from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
import AdminShell from "@/components/app/admin-shell.vue";
import EmptyState from "@/components/app/empty-state.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Icon } from "@/icons";
import { useCloudflareOAuth } from "@/composables/useCloudflareOAuth";
import { ApiError, addDomain, listAvailableDomains, listDomains, verifyDomain } from "@/lib/api";

const {
  configured, checking, statusError, reconnect, connecting, redirecting, notice,
  canUseCloudflare, checkStatus, connect, handleOperationError
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
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage
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
      error.value = err.message;
    } else {
      error.value = "Tidak dapat memuat domain. Coba lagi.";
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
  return status === "active" ? "success" : "pending";
}

function statusLabel(status: DomainVerificationStatus) {
  return status === "active" ? "Aktif" : "Pending Verifikasi";
}

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
      verifyError.value = err.message;
    } else {
      verifyError.value = "Tidak dapat memverifikasi domain. Coba lagi.";
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
      addInlineError.value = err.message;
    } else {
      addInlineError.value = "Tidak dapat memuat domain yang tersedia.";
    }
  } finally {
    loadingAvailable.value = false;
  }
}

async function submitAdd() {
  if (!canUseCloudflare.value || addSubmitting.value) return;
  addInlineError.value = "";
  if (!selectedDomain.value) {
    addInlineError.value = "Pilih domain terlebih dahulu";
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
      addInlineError.value = err.message;
    } else {
      addInlineError.value = "Tidak dapat menambahkan domain. Coba lagi.";
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
        <div>
          <h1 class="text-2xl font-semibold text-foreground">Manajemen Domain</h1>
          <p class="text-sm text-muted-foreground">
            Tambahkan domain Cloudflare dan pantau status verifikasinya.
          </p>
        </div>
        <Button :disabled="!canUseCloudflare" @click="openAddDialog">
          <Icon icon="lucide:plus" />
          <span>Tambah Domain</span>
        </Button>
      </div>

      <p v-if="checking" role="status" class="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="lucide:loader-circle" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Memeriksa koneksi Cloudflare...
      </p>
      <Alert v-else-if="statusError" variant="warning" class="mb-6 [&>div]:min-w-0 [&>div]:flex-1">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>{{ statusError }}</p>
          <Button variant="outline" class="min-h-11 shrink-0 text-foreground" @click="checkStatus">Periksa lagi</Button>
        </div>
      </Alert>
      <Alert
        v-else-if="configured === false"
        :variant="reconnect ? 'warning' : 'info'"
        aria-live="polite"
        class="mb-6 [&>div]:min-w-0 [&>div]:flex-1"
        aria-labelledby="cloudflare-connection-title"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="cloudflare-connection-title" class="font-semibold">
              {{ reconnect ? 'Hubungkan ulang Cloudflare' : 'Hubungkan akun Cloudflare' }}
            </h2>
            <p class="mt-1">Hubungkan Cloudflare untuk menambahkan dan memverifikasi domain.</p>
            <p class="mt-1">Anda akan diarahkan ke Cloudflare untuk memberi izin akses.</p>
          </div>
          <Button
            class="min-h-11 w-full shrink-0 md:w-auto"
            :disabled="connecting || redirecting"
            :aria-busy="connecting || redirecting"
            @click="connect"
          >
            <Icon v-if="connecting || redirecting" icon="lucide:loader-circle" class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {{ redirecting ? 'Membuka Cloudflare...' : connecting ? 'Menghubungkan...' : 'Hubungkan Cloudflare' }}
          </Button>
        </div>
      </Alert>

      <div v-if="isLoading" class="flex flex-col gap-4">
        <Skeleton shape="list" :rows="4" />
      </div>

      <div v-else-if="error" class="flex flex-col gap-4">
        <Alert variant="error">{{ error }}</Alert>
        <Button variant="ghost" @click="retry">Coba Lagi</Button>
      </div>

      <EmptyState
        v-else-if="domains.length === 0"
        icon="lucide:globe"
        heading="Belum ada domain"
        description="Tambahkan domain Cloudflare yang tersedia."
      >
        <template #action>
          <Button class="mt-4" :disabled="!canUseCloudflare" @click="openAddDialog">
            <Icon icon="lucide:plus" />
            <span>Tambah Domain</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <Alert v-if="verifyError" variant="error">{{ verifyError }}</Alert>

        <div class="rounded-2xl border bg-surface p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="w-24">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="domain in domains" :key="domain.id">
                <TableCell class="font-medium">{{ domain.domain_name }}</TableCell>
                <TableCell>
                  <Badge :variant="statusBadge(domain.verification_status)">
                    {{ statusLabel(domain.verification_status) }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <IconButton
                    :ariaLabel="`Verifikasi ulang ${domain.domain_name}`"
                    variant="ghost"
                    size="sm"
                    :disabled="
                      !canUseCloudflare || domain.verification_status === 'active' || verifyingId !== null
                    "
                    @click="handleVerify(domain)"
                  >
                    <Icon
                      icon="lucide:refresh-cw"
                      :class="verifyingId === domain.id ? 'animate-spin' : ''"
                    />
                  </IconButton>
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

    <div class="fixed bottom-4 right-4 left-4 z-50 sm:left-auto sm:w-96" aria-live="polite" aria-atomic="true">
      <Alert v-if="notice" :variant="notice.variant" class="shadow-lg [&>div]:min-w-0 [&>div]:flex-1 bg-surface">
        <div class="flex items-start gap-2">
          <p class="flex-1">{{ notice.message }}</p>
          <Button variant="ghost" class="min-h-11 min-w-11 shrink-0 text-foreground" aria-label="Tutup notifikasi" @click="notice = null">
            <Icon icon="lucide:x" aria-hidden="true" />
          </Button>
        </div>
      </Alert>
    </div>

    <div v-if="redirecting" role="status" class="fixed inset-0 z-40 flex items-center justify-center bg-background/95 p-6">
      <div class="max-w-sm text-center">
        <Icon icon="lucide:loader-circle" class="mx-auto mb-4 size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <p class="font-semibold">Membuka Cloudflare...</p>
        <p class="mt-2 text-sm text-muted-foreground">Selesaikan pemberian izin di Cloudflare untuk kembali ke Manajemen Domain.</p>
      </div>
    </div>

    <!-- Add domain dialog -->
    <DialogRoot v-model:open="addOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Domain</DialogTitle>
          <DialogDescription>Pilih domain Cloudflare yang tersedia.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="addInlineError" variant="error">{{ addInlineError }}</Alert>

          <div v-if="loadingAvailable" class="text-sm text-muted-foreground">
            Memuat domain yang tersedia...
          </div>
          <Alert
            v-else-if="availableDomains.length === 0 && !addInlineError"
            variant="info"
          >
            Tidak ada domain Cloudflare yang tersedia.
          </Alert>
          <Select
            v-else
            v-model="selectedDomain"
            label="Domain"
            id="select-domain"
            placeholder="Pilih domain"
            :options="availableDomains"
            :disabled="loadingAvailable || addSubmitting"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="addSubmitting" @click="addOpen = false">
            Batal
          </Button>
          <Button
            :disabled="addSubmitting || !selectedDomain || availableDomains.length === 0"
            @click="submitAdd"
          >
            <Icon v-if="addSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Tambah</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
