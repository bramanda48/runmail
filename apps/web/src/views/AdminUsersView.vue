<script setup lang="ts">
import type { ApiMeta, Role, User } from "@runmail/shared";
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
import { PasswordInput } from "@/components/ui/password-input";
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
import { ApiError, createUser, listUsers, updateUser } from "@/lib/api";

const perPage = 10;

const users = ref<User[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + users.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage
);

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = await listUsers(cursor, perPage);
    users.value = data.users;
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
      error.value = "Tidak dapat memuat user. Coba lagi.";
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

// Create dialog
const createOpen = ref(false);
const createUsername = ref("");
const createPassword = ref("");
const createRole = ref<Role>("member");
const createUsernameError = ref("");
const createPasswordError = ref("");
const createInlineError = ref("");
const createSubmitting = ref(false);

const roleOptions = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" }
];

function resetCreate() {
  createUsername.value = "";
  createPassword.value = "";
  createRole.value = "member";
  createUsernameError.value = "";
  createPasswordError.value = "";
  createInlineError.value = "";
}

function openCreate() {
  resetCreate();
  createOpen.value = true;
}

function applyCreateError(err: ApiError) {
  if (err.code === "USERNAME_ALREADY_EXISTS") {
    createUsernameError.value = "Username sudah digunakan.";
    return;
  }
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.username?.length) {
      createUsernameError.value = details.username[0];
    }
    if (details.password?.length) {
      createPasswordError.value = details.password[0];
    }
    return;
  }
  createInlineError.value = err.message || "Gagal membuat user. Coba lagi.";
}

async function submitCreate() {
  createUsernameError.value = "";
  createPasswordError.value = "";
  createInlineError.value = "";

  let hasError = false;
  if (!createUsername.value.trim()) {
    createUsernameError.value = "Username wajib diisi";
    hasError = true;
  }
  if (!createPassword.value) {
    createPasswordError.value = "Kata sandi wajib diisi";
    hasError = true;
  }
  if (hasError) return;

  createSubmitting.value = true;
  try {
    await createUser({
      username: createUsername.value.trim(),
      password: createPassword.value,
      role: createRole.value
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

// Edit dialog
const editOpen = ref(false);
const deactivateOpen = ref(false);
const editingUser = ref<User | null>(null);
const editRole = ref<Role>("member");
const editIsActive = ref(true);
const editNewPassword = ref("");
const editRoleError = ref("");
const editPasswordError = ref("");
const editInlineError = ref("");
const editSubmitting = ref(false);

function openEdit(user: User) {
  editingUser.value = user;
  editRole.value = user.role;
  editIsActive.value = user.is_active;
  editNewPassword.value = "";
  editRoleError.value = "";
  editPasswordError.value = "";
  editInlineError.value = "";
  editOpen.value = true;
}

function onActiveToggle(value: boolean) {
  if (!value && editingUser.value?.is_active) {
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

function applyEditError(err: ApiError) {
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.role?.length) {
      editRoleError.value = details.role[0];
    }
    if (details.password?.length) {
      editPasswordError.value = details.password[0];
    }
    return;
  }
  editInlineError.value = err.message || "Gagal memperbarui user. Coba lagi.";
}

async function submitEdit() {
  if (!editingUser.value) return;
  editRoleError.value = "";
  editPasswordError.value = "";
  editInlineError.value = "";

  if (editNewPassword.value && editNewPassword.value.length < 8) {
    editPasswordError.value = "Kata sandi baru minimal 8 karakter";
    return;
  }

  editSubmitting.value = true;
  try {
    const body: { role?: Role; is_active?: boolean; password?: string } = {
      role: editRole.value,
      is_active: editIsActive.value
    };
    if (editNewPassword.value) {
      body.password = editNewPassword.value;
    }
    await updateUser(editingUser.value.id, body);
    editOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      applyEditError(err);
    } else {
      editInlineError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  } finally {
    editSubmitting.value = false;
  }
}
</script>

<template>
  <AdminShell>
    <main class="p-4 lg:p-8">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">Manajemen User</h1>
          <p class="text-sm text-muted-foreground">Buat dan kelola pengguna Runmail.</p>
        </div>
        <Button @click="openCreate">
          <Icon icon="lucide:plus" />
          <span>Buat User</span>
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
        v-else-if="users.length === 0"
        icon="lucide:users"
        heading="Belum ada user"
        description="Belum ada pengguna yang terdaftar."
      >
        <template #action>
          <Button class="mt-4" @click="openCreate">
            <Icon icon="lucide:plus" />
            <span>Buat User</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-2xl border bg-surface p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="w-16">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="user in users" :key="user.id">
                <TableCell class="font-medium">{{ user.username }}</TableCell>
                <TableCell class="capitalize">{{ user.role }}</TableCell>
                <TableCell>
                  <Badge :variant="user.is_active ? 'success' : 'inactive'">
                    {{ user.is_active ? "Aktif" : "Nonaktif" }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <IconButton
                    :ariaLabel="`Edit ${user.username}`"
                    variant="ghost"
                    size="sm"
                    @click="openEdit(user)"
                  >
                    <Icon icon="lucide:pencil" />
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

    <!-- Create user dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat User</DialogTitle>
          <DialogDescription>Isi detail pengguna baru.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="error">{{ createInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Username</span>
            <Input
              v-model="createUsername"
              placeholder="nama.pengguna"
              :disabled="createSubmitting"
              :variant="createUsernameError ? 'error' : 'default'"
            />
            <p v-if="createUsernameError" class="text-sm text-destructive">
              {{ createUsernameError }}
            </p>
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Kata Sandi Awal</span>
            <PasswordInput
              v-model="createPassword"
              placeholder="Masukkan kata sandi"
              :disabled="createSubmitting"
              :variant="createPasswordError ? 'error' : 'default'"
            />
            <p v-if="createPasswordError" class="text-sm text-destructive">
              {{ createPasswordError }}
            </p>
          </label>

          <Select
            id="select-create-role"
            v-model="createRole"
            label="Peran"
            :options="roleOptions"
            :disabled="createSubmitting"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            Batal
          </Button>
          <Button :disabled="createSubmitting" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Simpan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Edit user dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Ubah peran, status, atau kata sandi pengguna.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="editInlineError" variant="error">{{ editInlineError }}</Alert>

          <div>
            <p class="text-sm text-muted-foreground">Username</p>
            <p class="font-medium text-foreground">{{ editingUser?.username }}</p>
          </div>

          <Select
            id="select-edit-role"
            v-model="editRole"
            label="Peran"
            :options="roleOptions"
            :disabled="editSubmitting"
            :error="Boolean(editRoleError)"
          />
          <p v-if="editRoleError" class="text-sm text-destructive">{{ editRoleError }}</p>

          <div class="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p class="text-sm font-medium text-foreground">Status Aktif</p>
              <p class="text-xs text-muted-foreground">
                Nonaktifkan untuk mengakhiri sesi pengguna.
              </p>
            </div>
            <Switch
              :model-value="editIsActive"
              :ariaLabel="'Status aktif user'"
              :disabled="editSubmitting"
              @update:model-value="onActiveToggle"
            />
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">Kata Sandi Baru (opsional)</span>
            <PasswordInput
              v-model="editNewPassword"
              placeholder="Kosongkan jika tidak diubah"
              :disabled="editSubmitting"
              :variant="editPasswordError ? 'error' : 'default'"
            />
            <p v-if="editPasswordError" class="text-sm text-destructive">
              {{ editPasswordError }}
            </p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="editSubmitting" @click="editOpen = false">
            Batal
          </Button>
          <Button :disabled="editSubmitting" @click="submitEdit">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Simpan Perubahan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Deactivate confirmation -->
    <DialogRoot v-model:open="deactivateOpen">
      <DialogContent variant="destructive" size="sm">
        <DialogHeader>
          <DialogTitle>Nonaktifkan User</DialogTitle>
          <DialogDescription>Nonaktifkan user? Sesi user akan diakhiri.</DialogDescription>
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
  </AdminShell>
</template>
