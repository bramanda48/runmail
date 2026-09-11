<script setup lang="ts">
import type { Folder } from "@runmail/shared";
import { folderNameSchema, isReservedFolderName } from "@runmail/shared";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxWorkspace } from "@/composables/useMailboxWorkspace";
import { Icon } from "@/icons";
import { ApiError, createFolder, deleteFolder, listFolders } from "@/lib/api";

const {
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

const folders = ref<Folder[]>([]);
const isLoading = ref(false);
const error = ref("");

const createOpen = ref(false);
const newFolderName = ref("");
const nameError = ref("");
const createInlineError = ref("");
const createSubmitting = ref(false);

const deleteOpen = ref(false);
const folderToDelete = ref<Folder | null>(null);
const deleteSubmitting = ref(false);

const systemFolders = computed(() =>
  folders.value
    .filter((f) => f.folder_type === "system")
    .sort((a, b) => a.name.localeCompare(b.name))
);
const customFolders = computed(() =>
  folders.value
    .filter((f) => f.folder_type === "custom")
    .sort((a, b) => a.name.localeCompare(b.name))
);
const hasCustomFolders = computed(() => customFolders.value.length > 0);

async function init() {
  error.value = "";
  await resolveMailbox();
  if (mailboxStore.mailboxId === mailboxId.value) {
    await loadLocalFolders();
    await load();
  }
}

async function load() {
  isLoading.value = true;
  error.value = "";
  try {
    const { folders: list } = await listFolders(mailboxId.value);
    folders.value = list;
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message || "Gagal memuat folder. Coba lagi.";
    } else {
      error.value = "Gagal memuat folder. Coba lagi.";
    }
  } finally {
    isLoading.value = false;
  }
}

function resetCreate() {
  newFolderName.value = "";
  nameError.value = "";
  createInlineError.value = "";
}

function openCreate() {
  resetCreate();
  createOpen.value = true;
}

function validateName(): boolean {
  nameError.value = "";
  const trimmed = newFolderName.value.trim();
  if (!trimmed) {
    nameError.value = "Nama folder wajib diisi";
    return false;
  }
  const parsed = folderNameSchema.safeParse(trimmed);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    nameError.value =
      issue?.message === "Folder name is required"
        ? "Nama folder wajib diisi"
        : (issue?.message ?? "Nama folder tidak valid");
    return false;
  }
  if (isReservedFolderName(trimmed)) {
    nameError.value = "Nama ini sudah digunakan untuk folder sistem";
    return false;
  }
  return true;
}

function mapCreateError(err: ApiError) {
  if (err.code === "FOLDER_NAME_CONFLICT") {
    nameError.value = "Nama folder sudah digunakan.";
    return;
  }
  if (err.code === "FOLDER_IS_SYSTEM") {
    nameError.value = "Nama ini sudah digunakan untuk folder sistem";
    return;
  }
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.name?.length) {
      nameError.value = details.name[0];
      return;
    }
  }
  createInlineError.value = err.message || "Gagal membuat folder. Coba lagi.";
}

async function submitCreate() {
  createInlineError.value = "";
  if (!validateName()) return;

  createSubmitting.value = true;
  try {
    await createFolder(mailboxId.value, newFolderName.value.trim());
    createOpen.value = false;
    await load();
    void mailboxStore.runSync();
  } catch (err) {
    if (err instanceof ApiError) {
      mapCreateError(err);
    } else {
      createInlineError.value = "Tidak dapat terhubung ke server. Coba lagi.";
    }
  } finally {
    createSubmitting.value = false;
  }
}

function openDelete(folder: Folder) {
  folderToDelete.value = folder;
  deleteOpen.value = true;
}

async function confirmDelete() {
  if (!folderToDelete.value) return;
  deleteSubmitting.value = true;
  try {
    await deleteFolder(mailboxId.value, folderToDelete.value.id);
    deleteOpen.value = false;
    await load();
    void mailboxStore.runSync();
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message || "Gagal menghapus folder. Coba lagi.";
    } else {
      error.value = "Gagal menghapus folder. Coba lagi.";
    }
  } finally {
    deleteSubmitting.value = false;
  }
}

onMounted(() => init());
watch(mailboxId, () => init());
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
          <h1 class="text-2xl font-semibold text-foreground">Kelola Folder</h1>
          <p class="text-sm text-muted-foreground">Buat dan hapus folder kustom pada mailbox ini.</p>
        </div>
        <Button @click="openCreate">
          <Icon icon="lucide:folder-plus" />
          <span>Buat Folder</span>
        </Button>
      </div>

      <div v-if="isLoading" class="space-y-4">
        <Skeleton shape="list" :rows="4" />
      </div>

      <div v-else-if="error" class="space-y-4">
        <Alert variant="error">{{ error }}</Alert>
        <Button variant="ghost" @click="load">Coba Lagi</Button>
      </div>

      <div v-else class="space-y-4">
        <!-- System folders -->
        <div class="rounded-2xl border bg-surface p-4">
          <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Folder Sistem</h2>
          <ul class="divide-y">
            <li
              v-for="folder in systemFolders"
              :key="folder.id"
              class="flex items-center justify-between py-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <Icon icon="lucide:folder" class="size-5 shrink-0 text-muted-foreground" />
                <span class="truncate text-foreground">{{ folder.name }}</span>
                <Badge variant="inactive">Sistem</Badge>
              </div>
              <Icon icon="lucide:lock" class="size-4 shrink-0 text-muted-foreground" />
            </li>
          </ul>
        </div>

        <!-- Custom folders -->
        <div class="rounded-2xl border bg-surface p-4">
          <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Folder Kustom</h2>

          <EmptyState
            v-if="!hasCustomFolders"
            icon="lucide:folder-open"
            heading="Belum ada folder kustom"
            description="Folder kustom yang Anda buat akan tampil di sini."
            class="bg-transparent"
          />

          <ul v-else class="divide-y">
            <li
              v-for="folder in customFolders"
              :key="folder.id"
              class="flex items-center justify-between py-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <Icon icon="lucide:folder" class="size-5 shrink-0 text-muted-foreground" />
                <span class="truncate text-foreground">{{ folder.name }}</span>
              </div>
              <IconButton
                :ariaLabel="`Hapus folder ${folder.name}`"
                variant="ghost"
                size="md"
                @click="openDelete(folder)"
              >
                <Icon icon="lucide:trash" class="text-destructive" />
              </IconButton>
            </li>
          </ul>
        </div>
      </div>
    </main>

    <!-- Create folder dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buat Folder</DialogTitle>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <Alert v-if="createInlineError" variant="error">{{ createInlineError }}</Alert>

          <label class="block space-y-1.5">
            <span class="text-sm font-medium text-foreground">Nama Folder</span>
            <Input
              v-model="newFolderName"
              placeholder="Contoh: Proyek A"
              :disabled="createSubmitting"
              :variant="nameError ? 'error' : 'default'"
              maxlength="64"
            />
            <p v-if="nameError" class="text-sm text-destructive">{{ nameError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            Batal
          </Button>
          <Button :disabled="createSubmitting" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>Buat</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent variant="destructive" size="sm">
        <DialogHeader>
          <DialogTitle>Hapus Folder</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-foreground">
          Hapus folder <strong>{{ folderToDelete?.name }}</strong>? Seluruh email di dalamnya akan dipindahkan ke Inbox.
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
