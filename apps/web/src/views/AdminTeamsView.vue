<script setup lang="ts">
import AdminShell from "@/components/app/AdminShell.vue";
import EmptyState from "@/components/app/EmptyState.vue";
import Pagination from "@/components/app/Pagination.vue";
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
import { translateApiError } from "@/i18n/api-errors";
import { Icon } from "@/icons";
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
import type { ApiMeta, Role, Team, TeamLinkedUser, User } from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const perPage = 10;

const teams = ref<Team[]>([]);
const memberCounts = ref<Record<string, number>>({});
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + teams.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage,
);

const roleLabels = computed<Record<Role, string>>(() => ({
  admin: t("admin.role.admin"),
  member: t("admin.role.member"),
}));

async function countMembers(teamId: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const { data, meta: responseMeta } = await getTeamUsers(teamId, cursor, 100);
    count += data.users.length;
    cursor =
      responseMeta?.has_more && responseMeta.next_cursor ? responseMeta.next_cursor : undefined;
    if (!responseMeta?.has_more) break;
  } while (cursor);
  return count;
}

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = await listTeams(cursor, perPage);
    teams.value = data.teams;
    meta.value = responseMeta ?? null;
    if (
      meta.value?.has_more &&
      meta.value.next_cursor &&
      cursors.value.length === pageIndex.value + 1
    ) {
      cursors.value.push(meta.value.next_cursor);
    }
    const counts = await Promise.allSettled(data.teams.map((team) => countMembers(team.id)));
    const next: Record<string, number> = {};
    data.teams.forEach((team, i) => {
      const result = counts[i];
      next[team.id] = result.status === "fulfilled" ? result.value : 0;
    });
    memberCounts.value = next;
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = translateApiError(err);
    } else {
      error.value = t("admin.teams.loadError");
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
const createName = ref("");
const createNameError = ref("");
const createInlineError = ref("");
const createSubmitting = ref(false);

function openCreate() {
  createName.value = "";
  createNameError.value = "";
  createInlineError.value = "";
  createOpen.value = true;
}

async function submitCreate() {
  createNameError.value = "";
  createInlineError.value = "";

  if (!createName.value.trim()) {
    createNameError.value = t("admin.teams.validation.nameRequired");
    return;
  }

  createSubmitting.value = true;
  try {
    await createTeam({ name: createName.value.trim() });
    createOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "VALIDATION_ERROR" && err.status === 409) {
        createNameError.value = translateApiError(err);
      } else {
        createInlineError.value = translateApiError(err);
      }
    } else {
      createInlineError.value = t("admin.connectionError");
    }
  } finally {
    createSubmitting.value = false;
  }
}

// Rename dialog
const renameOpen = ref(false);
const renamingTeam = ref<Team | null>(null);
const renameName = ref("");
const renameNameError = ref("");
const renameInlineError = ref("");
const renameSubmitting = ref(false);

function openRename(team: Team) {
  renamingTeam.value = team;
  renameName.value = team.name;
  renameNameError.value = "";
  renameInlineError.value = "";
  renameOpen.value = true;
}

async function submitRename() {
  if (!renamingTeam.value) return;
  renameNameError.value = "";
  renameInlineError.value = "";

  if (!renameName.value.trim()) {
    renameNameError.value = t("admin.teams.validation.nameRequired");
    return;
  }

  renameSubmitting.value = true;
  try {
    await updateTeam(renamingTeam.value.id, { name: renameName.value.trim() });
    renameOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "VALIDATION_ERROR" && err.status === 409) {
        renameNameError.value = translateApiError(err);
      } else {
        renameInlineError.value = translateApiError(err);
      }
    } else {
      renameInlineError.value = t("admin.connectionError");
    }
  } finally {
    renameSubmitting.value = false;
  }
}

// Delete confirmation
const deleteOpen = ref(false);
const deletingTeam = ref<Team | null>(null);
const deleteInlineError = ref("");
const deleteSubmitting = ref(false);

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
    await load(cursors.value[pageIndex.value]);
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

async function loadLinkedUsers(teamId: string): Promise<void> {
  const acc: TeamLinkedUser[] = [];
  let cursor: string | undefined;
  do {
    const { data, meta } = await getTeamUsers(teamId, cursor, 100);
    acc.push(...data.users);
    cursor = meta?.has_more && meta.next_cursor ? meta.next_cursor : undefined;
    if (!meta?.has_more) break;
  } while (cursor);
  linkedUsers.value = acc;
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
