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
import { Input } from "@/components/ui/input";
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
import { useCursorPagination } from "@/composables/use-cursor-pagination";
import { useFormSubmit } from "@/composables/use-form-submit";
import { Icon } from "@/icons";
import { translateApiError } from "@/i18n/api-errors";
import {
  ApiError,
  addTeamUser,
  createTeam,
  deleteTeam,
  getTeamUsers,
  listTeams,
  listUsers,
  removeTeamUser,
  updateTeam,
} from "@/lib/api";
import { paginateAll } from "@/lib/paginate-all";
import type { Role, Team, TeamLinkedUser, User } from "@runmail/shared";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { handleOperationError } = useCloudflareOAuth();

const perPage = 10;

const {
  items: teams,
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
} = useCursorPagination<Team>(
  async (cursor, limit) => {
    const { data, meta: responseMeta } = await listTeams(cursor, limit);
    return { items: data.teams, meta: responseMeta ?? null };
  },
  "admin.teams.loadError",
  perPage,
  handleOperationError,
);

const memberCounts = ref<Record<string, number>>({});


const roleLabels = computed<Record<Role, string>>(() => ({
  admin: t("admin.role.admin"),
  member: t("admin.role.member"),
}));

async function countMembers(teamId: string): Promise<number> {
  const users = await paginateAll(
    async (cursor, limit) => {
      const { data, meta: responseMeta } = await getTeamUsers(teamId, cursor, limit);
      return {
        items: data.users,
        hasMore: responseMeta?.has_more ?? false,
        nextCursor: responseMeta?.next_cursor,
      };
    },
    100,
  );
  return users.length;
}

async function refreshCounts(list: Team[]) {
  const counts = await Promise.allSettled(list.map((team) => countMembers(team.id)));
  const next: Record<string, number> = {};
  list.forEach((team, i) => {
    const result = counts[i];
    next[team.id] = result.status === "fulfilled" ? result.value : 0;
  });
  memberCounts.value = next;
}

watch(teams, (list) => {
  void refreshCounts(list);
});

function retry() {
  reload();
}

onMounted(() => load());

// Create dialog
const createForm = useFormSubmit("admin.connectionError", handleOperationError);
const { inlineError: createInlineError, isSubmitting: createSubmitting } = createForm;
const createOpen = ref(false);
const createName = ref("");
const createNameError = ref("");

function validateName(raw: string, setError: (message: string) => void): boolean {
  if (!raw.trim()) {
    setError(t("admin.teams.validation.nameRequired"));
    return false;
  }
  return true;
}

function openCreate() {
  createName.value = "";
  createForm.resetErrors([{ value: createNameError.value, set: (m) => (createNameError.value = m) }]);
  createOpen.value = true;
}

async function submitCreate() {
  const nameField = {
    value: createNameError.value,
    set: (m: string) => (createNameError.value = m),
  };
  createForm.resetErrors([nameField]);

  if (!validateName(createName.value, (m) => (createNameError.value = m))) return;

  createSubmitting.value = true;
  try {
    await createTeam({ name: createName.value.trim() });
    createOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      const handled = createForm.applyApiError(
        err,
        { name: ["name"] },
        { name: nameField },
        (apiErr) => {
          if (apiErr.code === "VALIDATION_ERROR" && apiErr.status === 409) {
            createNameError.value = translateApiError(apiErr);
            return true;
          }
          return false;
        },
      );
      if (handled) createOpen.value = false;
    } else {
      createInlineError.value = t("admin.connectionError");
    }
  } finally {
    createSubmitting.value = false;
  }
}

// Rename dialog
const renameForm = useFormSubmit("admin.connectionError", handleOperationError);
const { inlineError: renameInlineError, isSubmitting: renameSubmitting } = renameForm;
const renameOpen = ref(false);
const renamingTeam = ref<Team | null>(null);
const renameName = ref("");
const renameNameError = ref("");

function openRename(team: Team) {
  renamingTeam.value = team;
  renameName.value = team.name;
  renameForm.resetErrors([{ value: renameNameError.value, set: (m) => (renameNameError.value = m) }]);
  renameOpen.value = true;
}

async function submitRename() {
  if (!renamingTeam.value) return;
  const nameField = {
    value: renameNameError.value,
    set: (m: string) => (renameNameError.value = m),
  };
  renameForm.resetErrors([nameField]);

  if (!validateName(renameName.value, (m) => (renameNameError.value = m))) return;

  renameSubmitting.value = true;
  try {
    await updateTeam(renamingTeam.value.id, { name: renameName.value.trim() });
    renameOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      const handled = renameForm.applyApiError(
        err,
        { name: ["name"] },
        { name: nameField },
        (apiErr) => {
          if (apiErr.code === "VALIDATION_ERROR" && apiErr.status === 409) {
            renameNameError.value = translateApiError(apiErr);
            return true;
          }
          return false;
        },
      );
      if (handled) renameOpen.value = false;
    } else {
      renameInlineError.value = t("admin.connectionError");
    }
  } finally {
    renameSubmitting.value = false;
  }
}

// Delete confirmation
const deleteForm = useFormSubmit("admin.connectionError", handleOperationError);
const { inlineError: deleteInlineError, isSubmitting: deleteSubmitting } = deleteForm;
const deleteOpen = ref(false);
const deletingTeam = ref<Team | null>(null);

function openDelete(team: Team) {
  deletingTeam.value = team;
  deleteInlineError.value = "";
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!deletingTeam.value) return;
  deleteSubmitting.value = true;
  deleteInlineError.value = "";
  try {
    await deleteTeam(deletingTeam.value.id);
    deleteOpen.value = false;
    reload();
  } catch (err) {
    if (err instanceof ApiError) {
      if (deleteForm.applyApiError(err, {}, {})) deleteOpen.value = false;
    } else {
      deleteInlineError.value = t("admin.connectionError");
    }
  } finally {
    deleteSubmitting.value = false;
  }
}

// Manage members dialog
const manageOpen = ref(false);
const managingTeam = ref<Team | null>(null);
const allUsers = ref<User[]>([]);
const linkedUsers = ref<TeamLinkedUser[]>([]);
const selectedUserId = ref("");
const manageLoading = ref(false);
const manageSubmitting = ref(false);
const manageInlineError = ref("");

const userOptions = computed(() =>
  allUsers.value
    .filter((u) => !linkedUsers.value.some((linked) => linked.user_id === u.id))
    .map((u) => ({ value: u.id, label: `${u.username} (${roleLabels.value[u.role]})` })),
);

async function fetchAllUsers(): Promise<User[]> {
  return paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await listUsers(cursor, limit);
      return {
        items: data.users,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function loadLinkedUsers(teamId: string): Promise<void> {
  linkedUsers.value = await paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await getTeamUsers(teamId, cursor, limit);
      return {
        items: data.users,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function openManageMembers(team: Team) {
  managingTeam.value = team;
  manageOpen.value = true;
  manageLoading.value = true;
  manageInlineError.value = "";
  selectedUserId.value = "";
  linkedUsers.value = [];
  const [usersResult, linkedResult] = await Promise.allSettled([
    fetchAllUsers(),
    loadLinkedUsers(team.id),
  ]);
  if (usersResult.status === "fulfilled") {
    allUsers.value = usersResult.value;
  } else if (usersResult.reason instanceof ApiError) {
    manageInlineError.value = usersResult.reason.message;
  } else {
    manageInlineError.value = t("admin.teams.manageDialog.loadUsersError");
  }
  if (linkedResult.status === "rejected") {
    const err = linkedResult.reason;
    manageInlineError.value =
      err instanceof ApiError
        ? err.message || t("admin.teams.manageDialog.loadLinkedError")
        : t("admin.connectionError");
  }
  manageLoading.value = false;
}

async function refreshLinkedUsers(): Promise<void> {
  if (!managingTeam.value) return;
  try {
    await loadLinkedUsers(managingTeam.value.id);
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.teams.manageDialog.loadLinkedError");
    } else {
      manageInlineError.value = t("admin.connectionError");
    }
  }
}

async function addMember() {
  if (!managingTeam.value || !selectedUserId.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await addTeamUser(managingTeam.value.id, selectedUserId.value);
    selectedUserId.value = "";
    await refreshLinkedUsers();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.teams.manageDialog.addError");
    } else {
      manageInlineError.value = t("admin.connectionError");
    }
  } finally {
    manageSubmitting.value = false;
  }
}

async function removeMember(user: TeamLinkedUser) {
  if (!managingTeam.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await removeTeamUser(managingTeam.value.id, user.user_id);
    await refreshLinkedUsers();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.teams.manageDialog.removeError");
    } else {
      manageInlineError.value = t("admin.connectionError");
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
        <div class="flex flex-col gap-1">
          <h1 class="scroll-m-20 text-2xl font-bold tracking-tight text-foreground">
            {{ t("admin.teams.title") }}
          </h1>
          <p class="text-sm text-muted-foreground">{{ t("admin.teams.description") }}</p>
        </div>
        <Button @click="openCreate">
          <Icon icon="lucide:plus" />
          <span>{{ t("admin.teams.create") }}</span>
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
        v-else-if="teams.length === 0"
        icon="lucide:users"
        :heading="t('admin.teams.empty.title')"
        :description="t('admin.teams.empty.description')"
      >
        <template #action>
          <Button class="mt-4" @click="openCreate">
            <Icon icon="lucide:plus" />
            <span>{{ t("admin.teams.create") }}</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-lg border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.teams.table.name") }}</TableHead>
                <TableHead>{{ t("admin.teams.table.users") }}</TableHead>
                <TableHead class="w-32">{{ t("admin.teams.table.actions") }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="team in teams" :key="team.id">
                <TableCell class="font-medium">{{ team.name }}</TableCell>
                <TableCell>{{ memberCounts[team.id] ?? 0 }}</TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <Button
                      :aria-label="t('admin.teams.renameAria', { name: team.name })"
                      variant="ghost"
                      size="icon"
                      @click="openRename(team)"
                    >
                      <Icon icon="lucide:pencil" />
                    </Button>
                    <Button
                      :aria-label="t('admin.teams.membersAria', { name: team.name })"
                      variant="ghost"
                      size="icon"
                      @click="openManageMembers(team)"
                    >
                      <Icon icon="lucide:users" />
                    </Button>
                    <Button
                      :aria-label="t('admin.teams.deleteAria', { name: team.name })"
                      variant="ghost"
                      size="icon"
                      @click="openDelete(team)"
                    >
                      <Icon icon="lucide:trash-2" />
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
          :disabled="isLoading"
          @prev="goPrev"
          @next="goNext"
        >
          <template #range> {{ start }}–{{ end }} </template>
        </Pagination>
      </div>
    </main>

    <!-- Create team dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.teams.createDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.teams.createDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="destructive">{{ createInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.teams.createDialog.nameLabel")
            }}</span>
            <Input
              v-model="createName"
              :placeholder="t('admin.teams.createDialog.namePlaceholder')"
              :disabled="createSubmitting"
              :aria-invalid="Boolean(createNameError)"
            />
            <p v-if="createNameError" class="text-sm text-destructive">{{ createNameError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="createSubmitting" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.teams.createDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Rename team dialog -->
    <DialogRoot v-model:open="renameOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.teams.renameDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.teams.renameDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="renameInlineError" variant="destructive">{{ renameInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.teams.renameDialog.nameLabel")
            }}</span>
            <Input
              v-model="renameName"
              :placeholder="t('admin.teams.renameDialog.namePlaceholder')"
              :disabled="renameSubmitting"
              :aria-invalid="Boolean(renameNameError)"
            />
            <p v-if="renameNameError" class="text-sm text-destructive">{{ renameNameError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="renameSubmitting" @click="renameOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="renameSubmitting" @click="submitRename">
            <Icon v-if="renameSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.teams.renameDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.teams.deleteDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{ t("admin.teams.deleteDialog.description", { name: deletingTeam?.name }) }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="deleteInlineError" class="py-2">
          <Alert variant="destructive">{{ deleteInlineError }}</Alert>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="deleteOpen = false">{{
            t("common.actions.cancel")
          }}</Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Icon v-if="deleteSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.teams.deleteDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Manage members dialog -->
    <DialogRoot v-model:open="manageOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.teams.manageDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{ t("admin.teams.manageDialog.description", { name: managingTeam?.name }) }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="manageInlineError" variant="destructive">{{ manageInlineError }}</Alert>

          <div v-if="manageLoading" class="text-sm text-muted-foreground">
            {{ t("admin.teams.manageDialog.loading") }}
          </div>

          <div v-else class="flex items-end gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <label for="select-member" class="text-sm font-medium text-foreground">{{
                t("admin.teams.manageDialog.userLabel")
              }}</label>
              <Select v-model="selectedUserId">
                <SelectTrigger id="select-member" :disabled="manageSubmitting">
                  <SelectValue :placeholder="t('admin.teams.manageDialog.userPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in userOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button :disabled="!selectedUserId || manageSubmitting" @click="addMember">
              <Icon v-if="manageSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("admin.teams.manageDialog.add") }}</span>
            </Button>
          </div>
          <div v-if="linkedUsers.length > 0" class="flex flex-col gap-2">
            <p class="text-sm font-medium text-foreground">
              {{ t("admin.teams.manageDialog.linkedUsers", { count: linkedUsers.length }) }}
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
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="manageSubmitting"
                  @click="removeMember(user)"
                >
                  {{ t("common.actions.delete") }}
                </Button>
              </div>
            </div>
          </div>
          <p v-else-if="!manageLoading" class="text-sm text-muted-foreground">
            {{ t("admin.teams.manageDialog.empty") }}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="manageOpen = false">{{
            t("common.actions.close")
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AdminShell>
</template>
