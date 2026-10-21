<script setup lang="ts">
import AdminShell from "@/components/app/AdminShell.vue";
import EmptyState from "@/components/app/EmptyState.vue";
import Pagination from "@/components/app/Pagination.vue";
import PasswordField from "@/components/app/PasswordField.vue";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { translateApiError, translateFieldErrors } from "@/i18n/api-errors";
import { Icon } from "@/icons";
import { ApiError, createUser, listUsers, updateUser } from "@/lib/api";
import type { ApiMeta, Role, User } from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

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
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage,
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
      error.value = translateApiError(err);
    } else {
      error.value = t("admin.users.loadError");
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
  if (err.code === "USERNAME_ALREADY_EXISTS") {
    createUsernameError.value = translateApiError(err);
    return;
  }
  if (err.code === "VALIDATION_ERROR") {
    const details = translateFieldErrors(err.details);
    if (details.username?.length) {
      createUsernameError.value = details.username[0];
    }
    if (details.password?.length) {
      createPasswordError.value = details.password[0];
    }
    return;
  }
  createInlineError.value = translateApiError(err);
}

async function submitCreate() {
  createUsernameError.value = "";
  createPasswordError.value = "";
  createInlineError.value = "";

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
    await load(cursors.value[pageIndex.value]);
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
  if (err.code === "VALIDATION_ERROR") {
    const details = translateFieldErrors(err.details);
    if (details.role?.length) {
      editRoleError.value = details.role[0];
    }
    if (details.password?.length) {
      editPasswordError.value = details.password[0];
    }
    return;
  }
  editInlineError.value = translateApiError(err);
}

async function submitEdit() {
  if (!editingUser.value) return;
  editRoleError.value = "";
  editPasswordError.value = "";
  editInlineError.value = "";

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
    await load(cursors.value[pageIndex.value]);
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
</script>

<template>
  <AdminShell>
    <main class="p-4 lg:p-8">
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
        v-else-if="users.length === 0"
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
        <div class="rounded-lg border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.users.table.username") }}</TableHead>
                <TableHead>{{ t("admin.users.table.role") }}</TableHead>
                <TableHead>{{ t("admin.users.table.status") }}</TableHead>
                <TableHead class="w-16">{{ t("admin.users.table.actions") }}</TableHead>
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
                <TableCell>
                  <Button
                    :aria-label="t('admin.users.editAria', { username: user.username })"
                    variant="ghost"
                    size="icon"
                    @click="openEdit(user)"
                  >
                    <Icon icon="lucide:pencil" />
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

    <!-- Create user dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.createDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.users.createDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="destructive">{{ createInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.users.createDialog.usernameLabel")
            }}</span>
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

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.users.createDialog.passwordLabel")
            }}</span>
            <PasswordField
              v-model="createPassword"
              :placeholder="t('admin.users.createDialog.passwordPlaceholder')"
              :disabled="createSubmitting"
            />
            <p v-if="createPasswordError" class="text-sm text-destructive">
              {{ createPasswordError }}
            </p>
          </label>

          <div class="flex flex-col gap-1.5">
            <label for="select-create-role" class="text-sm font-medium text-foreground">{{
              t("admin.users.createDialog.roleLabel")
            }}</label>
            <Select v-model="createRole">
              <SelectTrigger id="select-create-role" :disabled="createSubmitting">
                <SelectValue :placeholder="t('admin.users.createDialog.rolePlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in roleOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="createSubmitting" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("common.actions.save") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Edit user dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.users.editDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.users.editDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="editInlineError" variant="destructive">{{ editInlineError }}</Alert>

          <div>
            <p class="text-sm text-muted-foreground">{{ t("admin.users.table.username") }}</p>
            <p class="font-medium text-foreground">{{ editingUser?.username }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="select-edit-role" class="text-sm font-medium text-foreground">{{
              t("admin.users.editDialog.roleLabel")
            }}</label>
            <Select v-model="editRole">
              <SelectTrigger
                id="select-edit-role"
                :disabled="editSubmitting"
                :aria-invalid="Boolean(editRoleError)"
              >
                <SelectValue :placeholder="t('admin.users.editDialog.rolePlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in roleOptions" :key="option.value" :value="option.value">
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

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.users.editDialog.passwordLabel")
            }}</span>
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
          <Button variant="ghost" :disabled="editSubmitting" @click="editOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="editSubmitting" @click="submitEdit">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.users.editDialog.submit") }}</span>
          </Button>
        </DialogFooter>
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
  </AdminShell>
</template>
