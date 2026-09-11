<script setup lang="ts">
import type { ApiMeta, RulesetDetail } from "@runmail/shared";
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/app/app-shell.vue";
import EmptyState from "@/components/app/empty-state.vue";
import FolderNavigation from "@/components/app/folder-navigation.vue";
import MailboxSwitcher from "@/components/app/mailbox-switcher.vue";
import SyncIndicator from "@/components/app/sync-indicator.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Pagination } from "@/components/ui/pagination";
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
import { useMailboxWorkspace } from "@/composables/useMailboxWorkspace";
import { Icon } from "@/icons";
import { ApiError, deleteRuleset, getRuleset, listRulesets, updateRuleset } from "@/lib/api";

const {
  router,
  mailboxStore,
  mailboxId,
  localFolders,
  unreadCounts,
  resolveMailbox,
  loadLocalFolders,
  watchSyncStatus
} = useMailboxWorkspace({
  onResolveError: () => {
    error.value = "Tidak dapat memuat mailbox. Coba lagi.";
  }
});

const perPage = 10;

const rulesets = ref<RulesetDetail[]>([]);
const meta = ref<ApiMeta | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const isLoading = ref(false);
const error = ref("");

const toggleLoadingId = ref<string | null>(null);
const deleteOpen = ref(false);
const rulesetToDelete = ref<RulesetDetail | null>(null);
const deleteSubmitting = ref(false);

const page = computed(() => pageIndex.value + 1);
const start = computed(() => pageIndex.value * perPage + 1);
const end = computed(() => start.value + rulesets.value.length - 1);
const showPagination = computed(() => cursors.value.length > 1 || meta.value?.has_more);
const paginationTotal = computed(() =>
  meta.value?.has_more ? page.value * perPage + 1 : page.value * perPage
);

async function init() {
  error.value = "";
  await resolveMailbox();
  if (mailboxStore.mailboxId === mailboxId.value) {
    await loadLocalFolders();
    await load(undefined);
  }
}

async function load(cursor?: string) {
  isLoading.value = true;
  error.value = "";
  try {
    const { data, meta: responseMeta } = (await listRulesets(
      mailboxId.value,
      cursor,
      perPage
    )) as unknown as {
      data: { rulesets: RulesetDetail[] };
      meta?: ApiMeta;
    };
    rulesets.value = data.rulesets;
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
      error.value = err.message || "Gagal memuat ruleset. Coba lagi.";
    } else {
      error.value = "Gagal memuat ruleset. Coba lagi.";
    }
  } finally {
    isLoading.value = false;
  }
}

function goNext() {
  if (!meta.value?.has_more || cursors.value.length <= pageIndex.value + 1) return;
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

function createRuleset() {
  router.push(`/mailboxes/${mailboxId.value}/rulesets/new`);
}

function editRuleset(ruleset: RulesetDetail) {
  router.push(`/mailboxes/${mailboxId.value}/rulesets/${ruleset.id}`);
}

function openDelete(ruleset: RulesetDetail) {
  rulesetToDelete.value = ruleset;
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!rulesetToDelete.value) return;
  deleteSubmitting.value = true;
  try {
    await deleteRuleset(mailboxId.value, rulesetToDelete.value.id);
    deleteOpen.value = false;
    await load(cursors.value[pageIndex.value]);
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message || "Gagal menghapus ruleset. Coba lagi.";
    } else {
      error.value = "Gagal menghapus ruleset. Coba lagi.";
    }
  } finally {
    deleteSubmitting.value = false;
  }
}

async function toggleEnabled(ruleset: RulesetDetail, value: boolean) {
  if (toggleLoadingId.value) return;
  toggleLoadingId.value = ruleset.id;

  // Optimistic update
  const original = ruleset.is_enabled;
  ruleset.is_enabled = value;

  try {
    const { ruleset: detail } = await getRuleset(mailboxId.value, ruleset.id);
    await updateRuleset(mailboxId.value, ruleset.id, {
      name: detail.name,
      priority: detail.priority,
      logic_operator: detail.logic_operator,
      is_enabled: value,
      conditions: detail.conditions.map((c) => ({
        field: c.field,
        match_type: c.match_type,
        condition_value: c.condition_value
      })),
      actions: detail.actions.map((a) => ({
        action_type: a.action_type,
        action_value: a.action_value
      }))
    });
  } catch (err) {
    // Rollback
    ruleset.is_enabled = original;
    if (err instanceof ApiError) {
      error.value = err.message || "Gagal mengubah status ruleset. Coba lagi.";
    } else {
      error.value = "Gagal mengubah status ruleset. Coba lagi.";
    }
  } finally {
    toggleLoadingId.value = null;
  }
}

onMounted(() => init());
watch(mailboxId, () => {
  pageIndex.value = 0;
  cursors.value = [undefined];
  init();
});
watchSyncStatus();
</script>

<template>
  <AppShell>
    <template #navigation>
      <div class="flex h-full flex-col">
        <FolderNavigation
          :mailbox-id="mailboxId"
          :folders="localFolders"
          :unread-counts="unreadCounts"
        />
      </div>
    </template>

    <template #topbar>
      <div class="flex items-center gap-3">
        <MailboxSwitcher />
        <SyncIndicator
          :status="mailboxStore.syncStatus"
          :pending-count="mailboxStore.pendingCount"
        />
      </div>
    </template>

    <main class="flex flex-1 flex-col p-4 lg:p-8">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">Ruleset</h1>
          <p class="text-sm text-muted-foreground">
            Aturan pemrosesan email. Prioritas lebih kecil dieksekusi lebih dulu.
          </p>
        </div>
        <Button @click="createRuleset">
          <Icon icon="lucide:plus" />
          <span>Buat Ruleset</span>
        </Button>
      </div>

      <div v-if="isLoading" class="space-y-4">
        <Skeleton shape="list" :rows="4" />
      </div>

      <div v-else-if="error" class="space-y-4">
        <Alert variant="error">{{ error }}</Alert>
        <Button variant="ghost" @click="retry">Coba Lagi</Button>
      </div>

      <EmptyState
        v-else-if="rulesets.length === 0"
        icon="lucide:filter"
        heading="Belum ada ruleset"
        description="Buat ruleset pertama untuk mengatur pemrosesan email."
      >
        <template #action>
          <Button class="mt-4" @click="createRuleset">
            <Icon icon="lucide:plus" />
            <span>Buat Ruleset</span>
          </Button>
        </template>
      </EmptyState>

      <div v-else class="space-y-4">
        <div class="rounded-2xl border bg-surface p-4">
          <div class="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead class="w-24">Prioritas</TableHead>
                  <TableHead class="w-24">Logika</TableHead>
                  <TableHead class="w-24">Aktif</TableHead>
                  <TableHead class="w-24">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="ruleset in rulesets" :key="ruleset.id">
                  <TableCell class="font-medium">
                    <div class="flex flex-col">
                      <span class="truncate">{{ ruleset.name }}</span>
                      <span class="text-xs text-muted-foreground">
                        {{ ruleset.conditions.length }} kondisi, {{ ruleset.actions.length }} aksi
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="inactive">{{ ruleset.priority }}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="inactive">{{ ruleset.logic_operator }}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      :model-value="ruleset.is_enabled"
                      :ariaLabel="`Status aktif ruleset ${ruleset.name}`"
                      :disabled="toggleLoadingId === ruleset.id"
                      @update:model-value="toggleEnabled(ruleset, $event)"
                    />
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-1">
                      <IconButton
                        :ariaLabel="`Edit ruleset ${ruleset.name}`"
variant="ghost"
                    size="md"
                        @click="editRuleset(ruleset)"
                      >
                        <Icon icon="lucide:pencil" />
                      </IconButton>
                      <IconButton
                        :ariaLabel="`Hapus ruleset ${ruleset.name}`"
variant="ghost"
                    size="md"
                        @click="openDelete(ruleset)"
                      >
                        <Icon icon="lucide:trash" class="text-destructive" />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
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

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent variant="destructive" size="sm">
        <DialogHeader>
          <DialogTitle>Hapus Ruleset</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-foreground">
          Hapus ruleset <strong>{{ rulesetToDelete?.name }}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
        <DialogFooter>
          <Button variant="ghost" :disabled="deleteSubmitting" @click="deleteOpen = false">
            Batal
          </Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Icon v-if="deleteSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Hapus</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </AppShell>
</template>
