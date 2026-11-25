<script setup lang="ts">
import EmptyState from "@/components/forms/EmptyState.vue";
import Pagination from "@/components/forms/Pagination.vue";
import PasswordField from "@/components/forms/PasswordField.vue";
import AdminShell from "@/components/layouts/AdminShell.vue";
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
import { useCloudflareOAuth } from "@/composables/use-cloudflare-oauth";
import { useCursorPagination } from "@/composables/use-cursor-pagination";
import { useFormSubmit } from "@/composables/use-form-submit";
import { translateApiError } from "@/i18n/api-errors";
import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import { Icon } from "@/icons";
import { ApiError, createUser, deleteUser, listUsers, updateUser } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import type { Role, User } from "@runmail/shared";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const perPage = 10;

const { handleOperationError } = useCloudflareOAuth();

const {
  items: users,
  page,
  start,
  end,
  showPagination,
  paginationTotal,
  knownPages,
  hasMore,
  isLoading,
  error,
  load,
  goNext,
  goPrev,
  goTo,
  reload,
  reset,
} = useCursorPagination<User>(
  async (cursor, limit) => {
    const filters = {
      search: searchQuery.value.trim() || undefined,
      role: roleFilter.value !== "all" ? roleFilter.value : undefined,
      status: statusFilter.value !== "all" ? statusFilter.value : undefined,
    };
    const { data, meta } = await listUsers(cursor, limit, filters);
    return { items: data.users, meta: meta ?? null };
  },
  "admin.users.loadError",
  perPage,
  handleOperationError,
);

function retry() {
  reload();
}

onMounted(() => {
  void load();
});

// Filters (server-side; pagination resets to page 1 on change)
const searchQuery = ref("");
const roleFilter = ref<"all" | Role>("all");
const statusFilter = ref<"all" | "active" | "inactive">("all");

const hasActiveFilter = computed(
  () =>
    searchQuery.value.trim() !== "" || roleFilter.value !== "all" || statusFilter.value !== "all",
);

let searchTimer: ReturnType<typeof setTimeout> | undefined;
let suppressWatch = false;

watch(searchQuery, () => {
  if (suppressWatch) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    reset(undefined);
  }, 300);
});

watch([roleFilter, statusFilter], () => {
  if (suppressWatch) return;
  reset(undefined);
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

function resetFilters() {
  if (searchTimer) clearTimeout(searchTimer);
  suppressWatch = true;
  searchQuery.value = "";
  roleFilter.value = "all";
  statusFilter.value = "all";
  void nextTick(() => {
    suppressWatch = false;
    reset(undefined);
  });
}

// Create dialog
const createForm = useFormSubmit("admin.connectionError", handleOperationError);
const createInlineError = createForm.inlineError;
const createSubmitting = createForm.isSubmitting;
const createOpen = ref(false);
const createUsername = ref("");
const createPassword = ref("");
const createRole = ref<Role>("member");
const createUsernameError = ref("");
const createPasswordError = ref("");

const roleLabels = computed<Record<Role, string>>(() => ({
  admin: t("admin.role.admin"),
  member: t("admin.role.member"),
}));

const roleOptions = computed<{ value: Role; label: string }[]>(() => [
  { value: "member", label: roleLabels.value.member },
  { value: "admin", label: roleLabels.value.admin },
]);

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
  const closed = createForm.applyApiError(
    err,
    { username: ["username"], password: ["password"] },
    {
      username: {
        value: createUsernameError.value,
        set: (message) => (createUsernameError.value = message),
      },
      password: {
        value: createPasswordError.value,
        set: (message) => (createPasswordError.value = message),
      },
    },
    (fallbackErr) => {
      if (fallbackErr.code === "USERNAME_ALREADY_EXISTS") {
        createUsernameError.value = translateApiError(fallbackErr);
        return true;
      }
      return false;
    },
  );
  if (closed) {
    createOpen.value = false;
  }
}

async function submitCreate() {
  createForm.resetErrors([
    { value: createUsernameError.value, set: (message) => (createUsernameError.value = message) },
    { value: createPasswordError.value, set: (message) => (createPasswordError.value = message) },
  ]);

  let hasError = false;
  if (!createUsername.value.trim()) {
    createUsernameError.value = t("admin.users.validation.usernameRequired");
    hasError = true;
  }
  if (!createPassword.value) {
    createPasswordError.value = t("admin.users.validation.passwordRequired");
    hasError = true;
  }
  if (hasError) return;

  createSubmitting.value = true;
  try {
    await createUser({
      username: createUsername.value.trim(),
      password: createPassword.value,
      role: createRole.value,
    });
    createOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      applyCreateError(err);
    } else {
      createInlineError.value = t("admin.connectionError");
    }
  } finally {
    createSubmitting.value = false;
  }
}

// Edit dialog
const editForm = useFormSubmit("admin.connectionError", handleOperationError);
const editInlineError = editForm.inlineError;
const editSubmitting = editForm.isSubmitting;
const editOpen = ref(false);
const deactivateOpen = ref(false);
const editingUser = ref<User | null>(null);
const editRole = ref<Role>("member");
const editIsActive = ref(true);
const editNewPassword = ref("");
const editRoleError = ref("");
const editPasswordError = ref("");

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
  const shouldClose = editForm.applyApiError(
    err,
    { role: ["role"], password: ["password"] },
    {
      role: { value: editRoleError.value, set: (message) => (editRoleError.value = message) },
      password: {
        value: editPasswordError.value,
        set: (message) => (editPasswordError.value = message),
      },
    },
  );
  if (shouldClose) {
    editOpen.value = false;
  }
}

async function submitEdit() {
  if (!editingUser.value) return;
  editForm.resetErrors([
    { value: editRoleError.value, set: (message) => (editRoleError.value = message) },
    { value: editPasswordError.value, set: (message) => (editPasswordError.value = message) },
  ]);

  if (editNewPassword.value && editNewPassword.value.length < 8) {
    editPasswordError.value = t("validation.password.min");
    return;
  }

  editSubmitting.value = true;
  try {
    const body: { role?: Role; is_active?: boolean; password?: string } = {
      role: editRole.value,
      is_active: editIsActive.value,
    };
    if (editNewPassword.value) {
      body.password = editNewPassword.value;
    }
    await updateUser(editingUser.value.id, body);
    editOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      applyEditError(err);
    } else {
      editInlineError.value = t("admin.connectionError");
    }
  } finally {
    editSubmitting.value = false;
  }
}

// Delete dialog
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? "");
const deleteOpen = ref(false);
const deletingUser = ref<User | null>(null);
const deleteSubmitting = ref(false);
const deleteInlineError = ref("");

function isSelf(user: User) {
  return user.id === currentUserId.value;
}

function openDelete(user: User) {
  deletingUser.value = user;
  deleteInlineError.value = "";
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!deletingUser.value) return;
  deleteSubmitting.value = true;
  deleteInlineError.value = "";
  try {
    await deleteUser(deletingUser.value.id);
    deleteOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      deleteInlineError.value = translateApiError(err);
    } else {
      deleteInlineError.value = t("admin.connectionError");
    }
  } finally {
    deleteSubmitting.value = false;
  }
}
</script>

<template>
  <AdminShell>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-col gap-1">
        <h1 class="scroll-m-20 text-2xl font-bold tracking-tight text-foreground">
          {{ t("admin.users.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">{{ t("admin.users.description") }}</p>
      </div>
      <Button @click="openCreate">
        <Icon icon="lucide:plus" />
        <span>{{ t("admin.users.create") }}</span>
      </Button>
    </div>

    <div v-if="isLoading" class="flex flex-col gap-4">
      <Skeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>

    <div v-else-if="error" class="flex flex-col gap-4">
      <Alert variant="destructive">{{ error }}</Alert>
      <Button variant="ghost" @click="retry">{{ t("common.actions.retry") }}</Button>
    </div>

    <EmptyState
      v-else-if="users.length === 0 && !hasActiveFilter"
      icon="lucide:users"
      :heading="t('admin.users.empty.title')"
      :description="t('admin.users.empty.description')"
    >
      <template #action>
        <Button class="mt-4" @click="openCreate">
          <Icon icon="lucide:plus" />
          <span>{{ t("admin.users.create") }}</span>
        </Button>
      </template>
    </EmptyState>

    <div v-else class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          v-model="searchQuery"
          :placeholder="t('admin.users.searchPlaceholder')"
          :aria-label="t('admin.users.searchPlaceholder')"
          class="sm:max-w-xs"
        />
        <Select v-model="roleFilter">
          <SelectTrigger class="sm:w-44" :aria-label="t('admin.users.table.role')">
            <SelectValue :placeholder="t('admin.users.roleFilterAll')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t("admin.users.roleFilterAll") }}</SelectItem>
            <SelectItem value="admin">{{ t("admin.users.roleFilterAdmin") }}</SelectItem>
            <SelectItem value="member">{{ t("admin.users.roleFilterMember") }}</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="statusFilter">
          <SelectTrigger class="sm:w-44" :aria-label="t('admin.users.table.status')">
            <SelectValue :placeholder="t('admin.users.statusFilterAll')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t("admin.users.statusFilterAll") }}</SelectItem>
            <SelectItem value="active">{{ t("admin.users.statusFilterActive") }}</SelectItem>
            <SelectItem value="inactive">{{ t("admin.users.statusFilterInactive") }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <EmptyState
        v-if="users.length === 0 && hasActiveFilter"
        icon="lucide:search-x"
        :heading="t('admin.users.emptySearch.title')"
        :description="t('admin.users.emptySearch.description')"
      >
        <template #action>
          <Button class="mt-4" variant="outline" @click="resetFilters">
            <span>{{ t("admin.users.emptySearch.reset") }}</span>
          </Button>
        </template>
      </EmptyState>
      <div v-else class="rounded-lg border bg-card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t("admin.users.table.username") }}</TableHead>
              <TableHead>{{ t("admin.users.table.role") }}</TableHead>
              <TableHead>{{ t("admin.users.table.status") }}</TableHead>
              <TableHead>{{ t("admin.users.table.lastActive") }}</TableHead>
              <TableHead class="w-32">{{ t("admin.users.table.actions") }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="user in users" :key="user.id">
              <TableCell class="font-medium">{{ user.username }}</TableCell>
              <TableCell class="capitalize">{{ roleLabels[user.role] }}</TableCell>
              <TableCell>
                <Badge :variant="user.is_active ? 'secondary' : 'outline'">
                  {{ user.is_active ? t("admin.status.active") : t("admin.status.inactive") }}
                </Badge>
              </TableCell>
              <TableCell
                :title="user.last_login_at ? formatDateTime(user.last_login_at) : undefined"
              >
                {{
                  user.last_login_at
                    ? formatRelativeTime(user.last_login_at)
                    : t("admin.users.table.neverActive")
                }}
              </TableCell>
              <TableCell>
                <div class="flex gap-2">
                  <Button
                    :aria-label="t('admin.users.editAria', { username: user.username })"
                    variant="outline"
                    size="icon"
                    @click="openEdit(user)"
                  >
                    <Icon icon="lucide:pencil" />
                  </Button>
                  <Button
                    :aria-label="t('admin.users.deleteAria', { username: user.username })"
                    :title="isSelf(user) ? t('admin.users.deleteSelfTooltip') : undefined"
                    variant="outline"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    :disabled="isSelf(user)"
                    @click="openDelete(user)"
                  >
                    <Icon icon="lucide:trash" />
                  </Button>
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
        :known-pages="knownPages"
        :has-more="hasMore"
        :disabled="isLoading"
        @prev="goPrev"
        @next="goNext"
        @goto="goTo"
      />
    </div>

    <!-- Create user dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.createDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.users.createDialog.description") }}</DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-4 py-2">
            <Alert v-if="createInlineError" variant="destructive">{{ createInlineError }}</Alert>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("admin.users.createDialog.usernameLabel") }}
              </span>
              <Input
                v-model="createUsername"
                :placeholder="t('admin.users.createDialog.usernamePlaceholder')"
                :disabled="createSubmitting"
                :aria-invalid="Boolean(createUsernameError)"
              />
              <p v-if="createUsernameError" class="text-sm text-destructive">
                {{ createUsernameError }}
              </p>
            </label>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("admin.users.createDialog.passwordLabel") }}
              </span>
              <PasswordField
                v-model="createPassword"
                :placeholder="t('admin.users.createDialog.passwordPlaceholder')"
                :disabled="createSubmitting"
              />
              <p v-if="createPasswordError" class="text-sm text-destructive">
                {{ createPasswordError }}
              </p>
            </label>

            <div class="flex flex-col gap-2">
              <label for="select-create-role" class="text-sm font-medium text-foreground">
                {{ t("admin.users.createDialog.roleLabel") }}
              </label>
              <Select v-model="createRole">
                <SelectTrigger id="select-create-role" :disabled="createSubmitting">
                  <SelectValue :placeholder="t('admin.users.createDialog.rolePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in roleOptions"
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
              :disabled="createSubmitting"
              @click="createOpen = false"
            >
              {{ t("common.actions.cancel") }}
            </Button>
            <Button type="submit" :disabled="createSubmitting">
              <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("common.actions.save") }}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>

    <!-- Edit user dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.editDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.users.editDialog.description") }}</DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="submitEdit">
          <div class="flex flex-col gap-4 py-2">
            <Alert v-if="editInlineError" variant="destructive">{{ editInlineError }}</Alert>

            <div>
              <p class="text-sm text-muted-foreground">{{ t("admin.users.table.username") }}</p>
              <p class="font-medium text-foreground">{{ editingUser?.username }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label for="select-edit-role" class="text-sm font-medium text-foreground">
                {{ t("admin.users.editDialog.roleLabel") }}
              </label>
              <Select v-model="editRole">
                <SelectTrigger
                  id="select-edit-role"
                  :disabled="editSubmitting"
                  :aria-invalid="Boolean(editRoleError)"
                >
                  <SelectValue :placeholder="t('admin.users.editDialog.rolePlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in roleOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p v-if="editRoleError" class="text-sm text-destructive">{{ editRoleError }}</p>

            <div class="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium text-foreground">
                  {{ t("admin.users.editDialog.activeLabel") }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t("admin.users.editDialog.activeHint") }}
                </p>
              </div>
              <Switch
                :model-value="editIsActive"
                :ariaLabel="t('admin.users.activeSwitchAria')"
                :disabled="editSubmitting"
                @update:model-value="onActiveToggle"
              />
            </div>

            <label class="flex flex-col gap-2">
              <span class="text-sm font-medium text-foreground">
                {{ t("admin.users.editDialog.passwordLabel") }}
              </span>
              <PasswordField
                v-model="editNewPassword"
                :placeholder="t('admin.users.editDialog.passwordPlaceholder')"
                :disabled="editSubmitting"
              />
              <p v-if="editPasswordError" class="text-sm text-destructive">
                {{ editPasswordError }}
              </p>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              :disabled="editSubmitting"
              @click="editOpen = false"
            >
              {{ t("common.actions.cancel") }}
            </Button>
            <Button type="submit" :disabled="editSubmitting">
              <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("admin.users.editDialog.submit") }}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>

    <!-- Deactivate confirmation -->
    <DialogRoot v-model:open="deactivateOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.deactivateDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.users.deactivateDialog.description") }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="deactivateOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button variant="destructive" :disabled="editSubmitting" @click="confirmDeactivate">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.users.deactivateDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.deleteDialog.title") }}</DialogTitle>
          <DialogDescription>{{
            t("admin.users.deleteDialog.description", { username: deletingUser?.username ?? "" })
          }}</DialogDescription>
        </DialogHeader>
        <Alert v-if="deleteInlineError" variant="destructive">{{ deleteInlineError }}</Alert>
        <DialogFooter>
          <Button variant="ghost" :disabled="deleteSubmitting" @click="deleteOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Icon v-if="deleteSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.users.deleteDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
