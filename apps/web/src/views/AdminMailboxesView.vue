<script setup lang="ts">
import EmptyState from "@/components/forms/EmptyState.vue";
import Pagination from "@/components/forms/Pagination.vue";
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
import { Icon } from "@/icons";
import { translateApiError } from "@/i18n/api-errors";
import {
  ApiError,
  createMailbox,
  getMailboxTeams,
  getMailboxUsers,
  linkMailboxTeam,
  linkMailboxUser,
  listAllMailboxes,
  listDomains,
  listTeams,
  listUsers,
  unlinkMailboxTeam,
  unlinkMailboxUser,
  updateMailbox,
} from "@/lib/api";
import { paginateAll } from "@/lib/paginate-all";
import type {
  Domain,
  Mailbox,
  MailboxLinkedTeam,
  MailboxLinkedUser,
  Role,
  Team,
  User,
} from "@runmail/shared";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const { handleOperationError } = useCloudflareOAuth();

const perPage = 10;

const {
  items: mailboxes,
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
} = useCursorPagination<Mailbox>(
  async (cursor, limit) => {
    const { data, meta: responseMeta } = await listAllMailboxes(cursor, limit);
    return { items: data.mailboxes, meta: responseMeta ?? null };
  },
  "admin.mailboxes.loadError",
  perPage,
  handleOperationError,
);

function retry() {
  reload();
}

onMounted(() => load());

// Create mailbox dialog
const createForm = useFormSubmit("admin.connectionError", handleOperationError);
const createInlineError = createForm.inlineError;
const createSubmitting = createForm.isSubmitting;
const createOpen = ref(false);
const domains = ref<Domain[]>([]);
const selectedDomainId = ref("");
const localPart = ref("");
const localPartError = ref("");
const loadingDomains = ref(false);

const domainOptions = computed(() =>
  domains.value.map((d) => ({ value: d.id, label: d.domain_name })),
);
const selectedDomain = computed(() => domains.value.find((d) => d.id === selectedDomainId.value));

async function fetchAllDomains(): Promise<Domain[]> {
  return paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await listDomains(cursor, limit);
      return {
        items: data.domains,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function openCreateDialog() {
  createOpen.value = true;
  selectedDomainId.value = "";
  localPart.value = "";
  localPartError.value = "";
  createInlineError.value = "";
  loadingDomains.value = true;
  try {
    // Fetch all domains for the selector.
    domains.value = await fetchAllDomains();
  } catch (err) {
    if (err instanceof ApiError) {
      createInlineError.value = translateApiError(err);
    } else {
      createInlineError.value = t("admin.mailboxes.domainLoadError");
    }
  } finally {
    loadingDomains.value = false;
  }
}

function applyCreateError(err: ApiError) {
  const closed = createForm.applyApiError(
    err,
    { localPart: ["local_part"] },
    {
      localPart: { value: localPartError.value, set: (message) => (localPartError.value = message) },
    },
    (fallbackErr) => {
      if (fallbackErr.code === "MAILBOX_ADDRESS_ALREADY_EXISTS") {
        localPartError.value = translateApiError(fallbackErr);
        return true;
      }
      if (fallbackErr.code === "DOMAIN_NOT_ACTIVE") {
        createInlineError.value = translateApiError(fallbackErr);
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
    { value: localPartError.value, set: (message) => (localPartError.value = message) },
  ]);

  if (!selectedDomainId.value) {
    createInlineError.value = t("admin.mailboxes.validation.domainRequired");
    return;
  }
  if (!localPart.value.trim()) {
    localPartError.value = t("admin.mailboxes.validation.localPartRequired");
    return;
  }

  createSubmitting.value = true;
  try {
    await createMailbox({
      domain_id: selectedDomainId.value,
      local_part: localPart.value.trim(),
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

// Edit / activate-deactivate dialog
const editForm = useFormSubmit("admin.connectionError", handleOperationError);
const editInlineError = editForm.inlineError;
const editSubmitting = editForm.isSubmitting;
const editOpen = ref(false);
const deactivateOpen = ref(false);
const editingMailbox = ref<Mailbox | null>(null);
const editIsActive = ref(true);

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

function applyEditError(err: ApiError) {
  const shouldClose = editForm.applyApiError(err, {}, {});
  if (shouldClose) {
    editOpen.value = false;
  }
}

async function submitEdit() {
  if (!editingMailbox.value) return;
  editInlineError.value = "";
  editSubmitting.value = true;
  try {
    await updateMailbox(editingMailbox.value.id, { is_active: editIsActive.value });
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

// Manage users dialog
const manageOpen = ref(false);
const managingMailbox = ref<Mailbox | null>(null);
const allUsers = ref<User[]>([]);
const linkedUsers = ref<MailboxLinkedUser[]>([]);
const selectedUserId = ref("");
const manageLoading = ref(false);
const manageSubmitting = ref(false);
const manageInlineError = ref("");

const roleLabels = computed<Record<Role, string>>(() => ({
  admin: t("admin.role.admin"),
  member: t("admin.role.member"),
}));

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

async function loadLinkedUsers(mailboxId: string): Promise<void> {
  linkedUsers.value = await paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await getMailboxUsers(mailboxId, cursor, limit);
      return {
        items: data.users,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function openManageUsers(mailbox: Mailbox) {
  managingMailbox.value = mailbox;
  manageOpen.value = true;
  manageLoading.value = true;
  selectedUserId.value = "";
  selectedTeamId.value = "";
  linkedUsers.value = [];
  linkedTeams.value = [];
  const [usersResult, linkedResult, teamsResult, linkedTeamsResult] = await Promise.allSettled([
    fetchAllUsers(),
    loadLinkedUsers(mailbox.id),
    fetchAllTeams(),
    loadLinkedTeams(mailbox.id),
  ]);
  if (usersResult.status === "fulfilled") {
    allUsers.value = usersResult.value;
  } else if (usersResult.reason instanceof ApiError) {
    manageInlineError.value = usersResult.reason.message;
  } else {
    manageInlineError.value = t("admin.mailboxes.manageDialog.loadUsersError");
  }
  if (teamsResult.status === "fulfilled") {
    allTeams.value = teamsResult.value;
  } else if (teamsResult.reason instanceof ApiError) {
    manageInlineError.value = teamsResult.reason.message;
  } else {
    manageInlineError.value = t("admin.mailboxes.teamDialog.loadTeamsError");
  }
  if (linkedResult.status === "rejected") {
    const err = linkedResult.reason;
    manageInlineError.value =
      err instanceof ApiError
        ? err.message || t("admin.mailboxes.manageDialog.loadLinkedError")
        : t("admin.connectionError");
  }
  if (linkedTeamsResult.status === "rejected") {
    const err = linkedTeamsResult.reason;
    manageInlineError.value =
      err instanceof ApiError
        ? err.message || t("admin.mailboxes.teamDialog.loadLinkedError")
        : t("admin.connectionError");
  }
  manageLoading.value = false;
}

async function refreshLinkedUsers(): Promise<void> {
  if (!managingMailbox.value) return;
  try {
    await loadLinkedUsers(managingMailbox.value.id);
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.mailboxes.manageDialog.loadLinkedError");
    } else {
      manageInlineError.value = t("admin.connectionError");
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
      manageInlineError.value = err.message || t("admin.mailboxes.manageDialog.linkError");
    } else {
      manageInlineError.value = t("admin.connectionError");
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
      manageInlineError.value = err.message || t("admin.mailboxes.manageDialog.unlinkError");
    } else {
      manageInlineError.value = t("admin.connectionError");
    }
  } finally {
    manageSubmitting.value = false;
  }
}
// Manage teams section (same dialog, stacked below users)
const allTeams = ref<Team[]>([]);
const linkedTeams = ref<MailboxLinkedTeam[]>([]);
const selectedTeamId = ref("");

const teamOptions = computed(() =>
  allTeams.value
    .filter((team) => !linkedTeams.value.some((linked) => linked.team_id === team.id))
    .map((team) => ({ value: team.id, label: team.name })),
);

async function fetchAllTeams(): Promise<Team[]> {
  return paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await listTeams(cursor, limit);
      return {
        items: data.teams,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function loadLinkedTeams(mailboxId: string): Promise<void> {
  linkedTeams.value = await paginateAll(
    async (cursor, limit) => {
      const { data, meta } = await getMailboxTeams(mailboxId, cursor, limit);
      return {
        items: data.teams,
        hasMore: meta?.has_more ?? false,
        nextCursor: meta?.next_cursor,
      };
    },
    100,
  );
}

async function refreshLinkedTeams(): Promise<void> {
  if (!managingMailbox.value) return;
  try {
    await loadLinkedTeams(managingMailbox.value.id);
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.mailboxes.teamDialog.loadLinkedError");
    } else {
      manageInlineError.value = t("admin.connectionError");
    }
  }
}

async function linkTeam() {
  if (!managingMailbox.value || !selectedTeamId.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await linkMailboxTeam(managingMailbox.value.id, selectedTeamId.value);
    selectedTeamId.value = "";
    await refreshLinkedTeams();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.mailboxes.teamDialog.linkError");
    } else {
      manageInlineError.value = t("admin.connectionError");
    }
  } finally {
    manageSubmitting.value = false;
  }
}

async function unlinkTeam(team: MailboxLinkedTeam) {
  if (!managingMailbox.value) return;
  manageSubmitting.value = true;
  manageInlineError.value = "";
  try {
    await unlinkMailboxTeam(managingMailbox.value.id, team.team_id);
    await refreshLinkedTeams();
  } catch (err) {
    if (err instanceof ApiError) {
      manageInlineError.value = err.message || t("admin.mailboxes.teamDialog.unlinkError");
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
            {{ t("admin.mailboxes.title") }}
          </h1>
          <p class="text-sm text-muted-foreground">{{ t("admin.mailboxes.description") }}</p>
        </div>
        <Button @click="openCreateDialog">
          <Icon icon="lucide:plus" />
          <span>{{ t("admin.mailboxes.create") }}</span>
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
        v-else-if="mailboxes.length === 0"
        icon="lucide:mail"
        :heading="t('admin.mailboxes.empty.title')"
        :description="t('admin.mailboxes.empty.description')"
      >
        <template #action>
          <Button class="mt-4" @click="openCreateDialog">
            <Icon icon="lucide:plus" />
            <span>{{ t("admin.mailboxes.create") }}</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="flex flex-col gap-4">
        <div class="rounded-lg border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t("admin.mailboxes.table.address") }}</TableHead>
                <TableHead>{{ t("admin.mailboxes.table.status") }}</TableHead>
                <TableHead class="w-28">{{ t("admin.mailboxes.table.actions") }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="mailbox in mailboxes" :key="mailbox.id">
                <TableCell class="font-medium">{{ mailbox.address }}</TableCell>
                <TableCell>
                  <Badge :variant="mailbox.is_active ? 'secondary' : 'outline'">
                    {{ mailbox.is_active ? t("admin.status.active") : t("admin.status.inactive") }}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div class="flex items-center gap-1">
                    <Button
                      :aria-label="t('admin.mailboxes.editAria', { address: mailbox.address })"
                      variant="ghost"
                      size="icon"
                      @click="openEdit(mailbox)"
                    >
                      <Icon icon="lucide:pencil" />
                    </Button>
                    <Button
                      :aria-label="t('admin.mailboxes.manageAria', { address: mailbox.address })"
                      variant="ghost"
                      size="icon"
                      @click="openManageUsers(mailbox)"
                    >
                      <Icon icon="lucide:users" />
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

    <!-- Create mailbox dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.mailboxes.createDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.mailboxes.createDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="destructive">{{ createInlineError }}</Alert>
          <Alert v-if="!loadingDomains && domains.length === 0">
            {{ t("admin.mailboxes.createDialog.noActiveDomains") }}
          </Alert>

          <div class="flex flex-col gap-1.5">
            <label for="select-domain" class="text-sm font-medium text-foreground">{{
              t("admin.mailboxes.createDialog.domainLabel")
            }}</label>
            <Select v-model="selectedDomainId">
              <SelectTrigger
                id="select-domain"
                :disabled="loadingDomains || createSubmitting || domains.length === 0"
              >
                <SelectValue :placeholder="t('admin.mailboxes.createDialog.domainPlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in domainOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{
              t("admin.mailboxes.createDialog.addressLabel")
            }}</span>
            <div class="flex items-center gap-2">
              <Input
                v-model="localPart"
                :placeholder="t('admin.mailboxes.createDialog.localPartPlaceholder')"
                class="flex-1"
                :disabled="createSubmitting || domains.length === 0"
                :aria-invalid="Boolean(localPartError)"
              />
              <span class="whitespace-nowrap text-sm text-muted-foreground">
                @{{
                  selectedDomain?.domain_name || t("admin.mailboxes.createDialog.domainFallback")
                }}
              </span>
            </div>
            <p v-if="localPartError" class="text-sm text-destructive">{{ localPartError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="createSubmitting || domains.length === 0" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.mailboxes.createDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Edit / status dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.mailboxes.editDialog.title") }}</DialogTitle>
          <DialogDescription>{{ t("admin.mailboxes.editDialog.description") }}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="editInlineError" variant="destructive">{{ editInlineError }}</Alert>

          <div>
            <p class="text-sm text-muted-foreground">
              {{ t("admin.mailboxes.editDialog.addressLabel") }}
            </p>
            <p class="font-medium text-foreground">{{ editingMailbox?.address }}</p>
          </div>

          <div class="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p class="text-sm font-medium text-foreground">
                {{ t("admin.mailboxes.editDialog.activeLabel") }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t("admin.mailboxes.editDialog.activeHint") }}
              </p>
            </div>
            <Switch
              :model-value="editIsActive"
              :ariaLabel="t('admin.mailboxes.activeSwitchAria')"
              :disabled="editSubmitting"
              @update:model-value="onActiveToggle"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="editSubmitting" @click="editOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="editSubmitting" @click="submitEdit">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("common.actions.save") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Deactivate confirmation -->
    <DialogRoot v-model:open="deactivateOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.mailboxes.deactivateDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{ t("admin.mailboxes.deactivateDialog.description") }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="deactivateOpen = false">{{
            t("common.actions.cancel")
          }}</Button>
          <Button variant="destructive" :disabled="editSubmitting" @click="confirmDeactivate">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("admin.mailboxes.deactivateDialog.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Manage users dialog -->
    <DialogRoot v-model:open="manageOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("admin.mailboxes.manageDialog.title") }}</DialogTitle>
          <DialogDescription>
            {{
              t("admin.mailboxes.manageDialog.description", { address: managingMailbox?.address })
            }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="manageInlineError" variant="destructive">{{ manageInlineError }}</Alert>

          <div v-if="manageLoading" class="text-sm text-muted-foreground">
            {{ t("admin.mailboxes.manageDialog.loading") }}
          </div>

          <div v-else class="flex items-end gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <label for="select-user" class="text-sm font-medium text-foreground">{{
                t("admin.mailboxes.manageDialog.userLabel")
              }}</label>
              <Select v-model="selectedUserId">
                <SelectTrigger id="select-user" :disabled="manageSubmitting">
                  <SelectValue :placeholder="t('admin.mailboxes.manageDialog.userPlaceholder')" />
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
            <Button :disabled="!selectedUserId || manageSubmitting" @click="linkUser">
              <Icon v-if="manageSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("admin.mailboxes.manageDialog.add") }}</span>
            </Button>
          </div>
          <div v-if="linkedUsers.length > 0" class="flex flex-col gap-2">
            <p class="text-sm font-medium text-foreground">
              {{ t("admin.mailboxes.manageDialog.linkedUsers", { count: linkedUsers.length }) }}
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
                <Badge v-if="!user.is_active" variant="outline">{{
                  t("admin.status.inactive")
                }}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="manageSubmitting"
                  @click="unlinkUser(user)"
                >
                  {{ t("common.actions.delete") }}
                </Button>
              </div>
            </div>
          </div>
          <p v-else-if="!manageLoading" class="text-sm text-muted-foreground">
            {{ t("admin.mailboxes.manageDialog.empty") }}
          </p>
        </div>

        <div class="border-t pt-4">
          <p class="text-sm font-medium text-foreground">
            {{ t("admin.mailboxes.teamDialog.title") }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t("admin.mailboxes.teamDialog.description") }}
          </p>

          <div v-if="!manageLoading" class="mt-3 flex items-end gap-2">
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <label for="select-team" class="text-sm font-medium text-foreground">{{
                t("admin.mailboxes.teamDialog.teamLabel")
              }}</label>
              <Select v-model="selectedTeamId">
                <SelectTrigger id="select-team" :disabled="manageSubmitting">
                  <SelectValue :placeholder="t('admin.mailboxes.teamDialog.teamPlaceholder')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in teamOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button :disabled="!selectedTeamId || manageSubmitting" @click="linkTeam">
              <Icon v-if="manageSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>{{ t("admin.mailboxes.teamDialog.add") }}</span>
            </Button>
          </div>
          <div v-if="linkedTeams.length > 0" class="mt-3 flex flex-col gap-2">
            <p class="text-sm font-medium text-foreground">
              {{ t("admin.mailboxes.teamDialog.linkedTeams", { count: linkedTeams.length }) }}
            </p>
            <div
              v-for="team in linkedTeams"
              :key="team.team_id"
              class="flex items-center justify-between rounded-lg border p-3"
            >
              <p class="font-medium text-foreground">{{ team.name }}</p>
              <Button
                variant="ghost"
                size="sm"
                :disabled="manageSubmitting"
                @click="unlinkTeam(team)"
              >
                {{ t("common.actions.delete") }}
              </Button>
            </div>
          </div>
          <p v-else-if="!manageLoading" class="mt-3 text-sm text-muted-foreground">
            {{ t("admin.mailboxes.teamDialog.empty") }}
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
