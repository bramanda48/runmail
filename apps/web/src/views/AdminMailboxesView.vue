<script setup lang="ts">
import type { ApiMeta, Domain, Mailbox, MailboxLinkedUser, User } from "@runmail/shared";
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
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Icon } from "@/icons";
import {
  ApiError,
  createMailbox,
  getMailboxUsers,
  linkMailboxUser,
  listAllMailboxes,
  listDomains,
  listUsers,
  unlinkMailboxUser,
  updateMailbox
} from "@/lib/api";

const perPage = 10;

const mailboxes = ref<Mailbox[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + mailboxes.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage
);

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = await listAllMailboxes(cursor, perPage);
    mailboxes.value = data.mailboxes;
    meta.value = responseMeta ?? null;
    if (
      meta.value?.has_more &&
      meta.value.next_cursor &&
      cursors.value.length === pageIndex.value + 1
    ) {
      cursors.value.push(meta.value.next_cursor);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
    } else {
      error.value = "Tidak dapat memuat mailbox. Coba lagi.";
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

// Create mailbox dialog
const createOpen = ref(false);
const domains = ref<Domain[]>([]);
const selectedDomainId = ref("");
const localPart = ref("");
const localPartError = ref("");
const createInlineError = ref("");
const createSubmitting = ref(false);
const loadingDomains = ref(false);

const activeDomains = computed(() =>
  domains.value.filter((d) => d.verification_status === "active")
);
const domainOptions = computed(() =>
  activeDomains.value.map((d) => ({ value: d.id, label: d.domain_name }))
);
const selectedDomain = computed(() =>
  activeDomains.value.find((d) => d.id === selectedDomainId.value)
);

async function fetchAllDomains(): Promise<Domain[]> {
  const acc: Domain[] = [];
  let cursor: string | undefined;
  do {
    const { data, meta } = await listDomains(cursor, 100);
    acc.push(...data.domains);
    cursor = meta?.has_more && meta.next_cursor ? meta.next_cursor : undefined;
    if (!meta?.has_more) break;
  } while (cursor);
  return acc;
}

async function openCreateDialog() {
  createOpen.value = true;
  selectedDomainId.value = "";
  localPart.value = "";
  localPartError.value = "";
  createInlineError.value = "";
  loadingDomains.value = true;
  try {
    // Fetch all domains for the selector; active domains are required to create a mailbox.
    domains.value = await fetchAllDomains();
  } catch (err) {
    if (err instanceof ApiError) {
      createInlineError.value = err.message;
    } else {
      createInlineError.value = "Tidak dapat memuat domain.";
    }
  } finally {
    loadingDomains.value = false;
  }
}

function applyCreateError(err: ApiError) {
  if (err.code === "MAILBOX_ADDRESS_ALREADY_EXISTS") {
    localPartError.value = "Alamat email ini sudah digunakan.";
    return;
  }
  if (err.code === "DOMAIN_NOT_ACTIVE") {
    createInlineError.value = "Domain tidak aktif. Pilih domain aktif.";
    return;
  }
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.local_part?.length) {
      localPartError.value = details.local_part[0];
    }
    return;
  }
  createInlineError.value = err.message || "Gagal membuat mailbox. Coba lagi.";
}

async function submitCreate() {
  localPartError.value = "";
  createInlineError.value = "";

  if (!selectedDomainId.value) {
    createInlineError.value = "Pilih domain aktif terlebih dahulu";
    return;
  }
  if (!localPart.value.trim()) {
    localPartError.value = "Bagian lokal alamat wajib diisi";
    return;
  }

  createSubmitting.value = true;
  try {
    await createMailbox({
      domain_id: selectedDomainId.value,
      local_part: localPart.value.trim()
    });
    createOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      applyCreateError(err);
    } else {
      createInlineError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  } finally {
    createSubmitting.value = false;
  }
}

// Edit / activate-deactivate dialog
const editOpen = ref(false);
const deactivateOpen = ref(false);
const editingMailbox = ref<Mailbox | null>(null);
const editIsActive = ref(true);
const editSubmitting = ref(false);
const editInlineError = ref("");

function openEdit(mailbox: Mailbox) {
  editingMailbox.value = mailbox;
  editIsActive.value = mailbox.is_active;
  editInlineError.value = "";
  editOpen.value = true;
}

function onActiveToggle(value: boolean) {
  if (!value && editingMailbox.value?.is_active) {
    deactivateOpen.value = true;
  } else {
    editIsActive.value = value;
  }
}

async function confirmDeactivate() {
  editIsActive.value = false;
  deactivateOpen.value = false;
  await submitEdit();
}

async function submitEdit() {
  if (!editingMailbox.value) return;
  editInlineError.value = "";
  editSubmitting.value = true;
  try {
    await updateMailbox(editingMailbox.value.id, { is_active: editIsActive.value });
    editOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      editInlineError.value = err.message || "Gagal memperbarui mailbox.";
    } else {
      editInlineError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  } finally {
    editSubmitting.value = false;
  }
}

// Manage users dialog
const manageOpen = ref(false);
const managingMailbox = ref<Mailbox | null>(null);
const allUsers = ref<User[]>([]);
const linkedUsers = ref<MailboxLinkedUser[]>([]);
const selectedUserId = ref("");
const manageLoading = ref(false);
const manageSubmitting = ref(false);
const manageInlineError = ref("");

const userOptions = computed(() =>
  allUsers.value
    .filter((u) => !linkedUsers.value.some((linked) => linked.user_id === u.id))
    .map((u) => ({ value: u.id, label: `${u.username} (${u.role})` }))
);

async function fetchAllUsers(): Promise<User[]> {
  const acc: User[] = [];
  let cursor: string | undefined;
  do {
    const { data, meta } = await listUsers(cursor, 100);
    acc.push(...data.users);
    cursor = meta?.has_more && meta.next_cursor ? meta.next_cursor : undefined;
    if (!meta?.has_more) break;
  } while (cursor);
  return acc;
}

async function loadLinkedUsers(mailboxId: string): Promise<void> {
  const acc: MailboxLinkedUser[] = [];
  let cursor: string | undefined;
  do {
    const { data, meta } = await getMailboxUsers(mailboxId, cursor, 100);
    acc.push(...data.users);
    cursor = meta?.has_more && meta.next_cursor ? meta.next_cursor : undefined;
    if (!meta?.has_more) break;
  } while (cursor);
  linkedUsers.value = acc;
}

async function openManageUsers(mailbox: Mailbox) {
  managingMailbox.value = mailbox;
  manageOpen.value = true;
  manageLoading.value = true;
  manageInlineError.value = "";
  selectedUserId.value = "";
  linkedUsers.value = [];
  const [usersResult, linkedResult] = await Promise.allSettled([
    fetchAllUsers(),
    loadLinkedUsers(mailbox.id)
  ]);
  if (usersResult.status === "fulfilled") {
    allUsers.value = usersResult.value;
  } else if (usersResult.reason instanceof ApiError) {
    manageInlineError.value = usersResult.reason.message;
  } else {
    manageInlineError.value = "Tidak dapat memuat daftar user.";
  }
  if (linkedResult.status === "rejected") {
    const err = linkedResult.reason;
    manageInlineError.value =
      err instanceof ApiError
        ? err.message || "Gagal memuat user terhubung."
        : "Tidak dapat terhubung ke server.";
  }
  manageLoading.value = false;
}

async function refreshLinkedUsers(): Promise<void> {
  if (!managingMailbox.value) return;
  try {
    await loadLinkedUsers(managingMailbox.value.id);
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || "Gagal memuat user terhubung.";
    } else {
      manageInlineError.value = "Tidak dapat terhubung ke server.";
    }
  }
}

async function linkUser() {
  if (!managingMailbox.value || !selectedUserId.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await linkMailboxUser(managingMailbox.value.id, selectedUserId.value);
    selectedUserId.value = "";
    await refreshLinkedUsers();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || "Gagal menambahkan user.";
    } else {
      manageInlineError.value = "Tidak dapat terhubung ke server.";
    }
  } finally {
    manageSubmitting.value = false;
  }
}

async function unlinkUser(user: MailboxLinkedUser) {
  if (!managingMailbox.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await unlinkMailboxUser(managingMailbox.value.id, user.user_id);
    await refreshLinkedUsers();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || "Gagal menghapus kaitan user.";
    } else {
      manageInlineError.value = "Tidak dapat terhubung ke server.";
    }
  } finally {
    manageSubmitting.value = false;
  }
}
</script>

<template>
  <AdminShell>
    <main class="p-4 lg:p-8">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">Manajemen Mailbox</h1>
          <p class="text-sm text-muted-foreground">Buat dan kelola mailbox serta akses user.</p>
        </div>
        <Button @click="openCreateDialog">
          <Icon icon="lucide:plus" />
          <span>Buat Mailbox</span>
        </Button>
      </div>

      <div v-if="isLoading" class="flex flex-col gap-4">
        <Skeleton shape="list" :rows="4" />
      </div>

      <div v-else-if="error" class="flex flex-col gap-4">
        <Alert variant="error">{{ error }}</Alert>
        <Button variant="ghost" @click="retry">Coba Lagi</Button>
      </div>

      <EmptyState
        v-else-if="mailboxes.length === 0"
        icon="lucide:mail"
        heading="Belum ada mailbox"
        description="Belum ada mailbox yang dibuat."
      >
        <template #action>
          <Button class="mt-4" @click="openCreateDialog">
            <Icon icon="lucide:plus" />
            <span>Buat Mailbox</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-2xl border bg-surface p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alamat</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="w-28">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="mailbox in mailboxes" :key="mailbox.id">
                <TableCell class="font-medium">{{ mailbox.address }}</TableCell>
                <TableCell>
                  <Badge :variant="mailbox.is_active ? 'success' : 'inactive'">
                    {{ mailbox.is_active ? "Aktif" : "Nonaktif" }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <IconButton
                      :ariaLabel="`Edit ${mailbox.address}`"
                      variant="ghost"
                      size="sm"
                      @click="openEdit(mailbox)"
                    >
                      <Icon icon="lucide:pencil" />
                    </IconButton>
                    <IconButton
                      :ariaLabel="`Kelola user ${mailbox.address}`"
                      variant="ghost"
                      size="sm"
                      @click="openManageUsers(mailbox)"
                    >
                      <Icon icon="lucide:users" />
                    </IconButton>
                  </div>
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

    <!-- Create mailbox dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Mailbox</DialogTitle>
          <DialogDescription>Pilih domain aktif dan isi bagian lokal alamat.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="error">{{ createInlineError }}</Alert>
          <Alert v-if="!loadingDomains && activeDomains.length === 0" variant="warning">
            Aktifkan domain terlebih dahulu sebelum membuat mailbox.
          </Alert>

          <Select
            v-model="selectedDomainId"
            label="Domain"
            placeholder="Pilih domain"
            :options="domainOptions"
            :disabled="loadingDomains || createSubmitting || activeDomains.length === 0"
          />

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Alamat Email</span>
            <div class="flex items-center gap-2">
              <Input
                v-model="localPart"
                placeholder="nama"
                class="flex-1"
                :disabled="createSubmitting || activeDomains.length === 0"
                :variant="localPartError ? 'error' : 'default'"
              />
              <span class="whitespace-nowrap text-sm text-muted-foreground">
                @{{ selectedDomain?.domain_name || "domain" }}
              </span>
            </div>
            <p v-if="localPartError" class="text-sm text-destructive">{{ localPartError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            Batal
          </Button>
          <Button
            :disabled="createSubmitting || activeDomains.length === 0"
            @click="submitCreate"
          >
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Buat</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Edit / status dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Mailbox</DialogTitle>
          <DialogDescription>Ubah status aktif mailbox.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="editInlineError" variant="error">{{ editInlineError }}</Alert>

          <div>
            <p class="text-sm text-muted-foreground">Alamat</p>
            <p class="font-medium text-foreground">{{ editingMailbox?.address }}</p>
          </div>

          <div class="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p class="text-sm font-medium text-foreground">Status Aktif</p>
              <p class="text-xs text-muted-foreground">
                Mailbox nonaktif tidak menerima email.
              </p>
            </div>
            <Switch
              :model-value="editIsActive"
              :ariaLabel="'Status aktif mailbox'"
              :disabled="editSubmitting"
              @update:model-value="onActiveToggle"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="editSubmitting" @click="editOpen = false">
            Batal
          </Button>
          <Button :disabled="editSubmitting" @click="submitEdit">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Simpan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Deactivate confirmation -->
    <DialogRoot v-model:open="deactivateOpen">
      <DialogContent variant="destructive" size="sm">
        <DialogHeader>
          <DialogTitle>Nonaktifkan Mailbox</DialogTitle>
          <DialogDescription>
            Mailbox tidak menerima email saat nonaktif. Lanjutkan?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="deactivateOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="editSubmitting" @click="confirmDeactivate">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Nonaktifkan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Manage users dialog -->
    <DialogRoot v-model:open="manageOpen">
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Kelola User Mailbox</DialogTitle>
          <DialogDescription>
            Tambahkan atau hapus akses user ke {{ managingMailbox?.address }}.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="manageInlineError" variant="error">{{ manageInlineError }}</Alert>

          <div v-if="manageLoading" class="text-sm text-muted-foreground">
            Memuat daftar user...
          </div>

          <div v-else class="flex items-end gap-2">
            <Select
              v-model="selectedUserId"
              label="Pilih User"
              placeholder="Pilih user"
              :options="userOptions"
              class="flex-1"
              :disabled="manageSubmitting"
            />
            <Button :disabled="!selectedUserId || manageSubmitting" @click="linkUser">
              <Icon v-if="manageSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>Tambahkan</span>
            </Button>
          </div>

          <div v-if="linkedUsers.length > 0" class="flex flex-col gap-2">
            <p class="text-sm font-medium text-foreground">
              User terhubung ({{ linkedUsers.length }})
            </p>
            <div
              v-for="user in linkedUsers"
              :key="user.user_id"
              class="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p class="font-medium text-foreground">{{ user.username }}</p>
                <p class="text-xs text-muted-foreground capitalize">{{ user.role }}</p>
              </div>
              <div class="flex items-center gap-2">
                <Badge v-if="!user.is_active" variant="inactive">Nonaktif</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="manageSubmitting"
                  @click="unlinkUser(user)"
                >
                  Hapus
                </Button>
              </div>
            </div>
          </div>
          <p
            v-else-if="!manageLoading"
            class="text-sm text-muted-foreground"
          >
            Belum ada user yang terhubung ke mailbox ini.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="manageOpen = false">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
