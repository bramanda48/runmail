<script setup lang="ts">
import EmptyState from "@/components/app/EmptyState.vue";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { translateApiError, translateFieldErrors } from "@/i18n/api-errors";
import { folderDisplayName } from "@/i18n/folders";
import { Icon } from "@/icons";
import { ApiError, createFolder, deleteFolder, listFolders, renameFolder } from "@/lib/api";
import { useMailboxStore } from "@/stores/mailbox";
import type { Folder } from "@runmail/shared";
import { SYSTEM_FOLDER_KEYS, folderNameSchema, isReservedFolderName } from "@runmail/shared";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  mailboxId: string;
}>();

const { t, te } = useI18n();
const mailboxStore = useMailboxStore();

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

const editOpen = ref(false);
const folderToEdit = ref<Folder | null>(null);
const editFolderName = ref("");
const editNameError = ref("");
const editInlineError = ref("");
const editSubmitting = ref(false);

const systemFolderOrder = new Map<string, number>(
  SYSTEM_FOLDER_KEYS.map((key, index): [string, number] => [key, index]),
);

const systemFolders = computed(() =>
  folders.value
    .filter((f) => f.folder_type === "system")
    .sort(
      (a, b) =>
        (systemFolderOrder.get(a.name) ?? SYSTEM_FOLDER_KEYS.length) -
        (systemFolderOrder.get(b.name) ?? SYSTEM_FOLDER_KEYS.length),
    ),
);
const customFolders = computed(() =>
  folders.value
    .filter((f) => f.folder_type === "custom")
    .sort((a, b) => a.name.localeCompare(b.name)),
);
const hasCustomFolders = computed(() => customFolders.value.length > 0);
const deletePrefix = computed(() => `${t("folders.delete.messagePrefix")} `);
const deleteSuffix = computed(() =>
  t("folders.delete.messageSuffix", { inbox: t("system.inbox") }),
);

async function load() {
  if (!props.mailboxId) return;
  isLoading.value = true;
  error.value = "";
  try {
    const { folders: list } = await listFolders(props.mailboxId);
    folders.value = list;
  } catch (err) {
    error.value = err instanceof ApiError ? translateApiError(err) : t("folders.errors.load");
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

function nameErrorFromMessage(message?: string): string {
  if (!message) return t("folders.errors.invalidName");
  return te(message) ? t(message) : message;
}

function nameErrorFromApi(err: ApiError): string | null {
  if (err.code === "FOLDER_NAME_CONFLICT" || err.code === "FOLDER_IS_SYSTEM") {
    return translateApiError(err);
  }
  if (err.code === "VALIDATION_ERROR") {
    const details = translateFieldErrors(err.details);
    return details.name?.[0] ?? null;
  }
  return null;
}

function validateName(): boolean {
  nameError.value = "";
  const trimmed = newFolderName.value.trim();
  if (!trimmed) {
    nameError.value = t("validation.folderName.required");
    return false;
  }
  const parsed = folderNameSchema.safeParse(trimmed);
  if (!parsed.success) {
    nameError.value = nameErrorFromMessage(parsed.error.issues[0]?.message);
    return false;
  }
  if (isReservedFolderName(trimmed)) {
    nameError.value = t("folders.errors.reserved");
    return false;
  }
  return true;
}

function mapCreateError(err: ApiError) {
  const fieldError = nameErrorFromApi(err);
  if (fieldError) {
    nameError.value = fieldError;
    return;
  }
  createInlineError.value = translateApiError(err);
}

async function submitCreate() {
  createInlineError.value = "";
  if (!validateName()) return;

  createSubmitting.value = true;
  try {
    await createFolder(props.mailboxId, newFolderName.value.trim());
    createOpen.value = false;
    await load();
    void mailboxStore.runSync();
  } catch (err) {
    if (err instanceof ApiError) {
      mapCreateError(err);
    } else {
      createInlineError.value = t("folders.errors.connection");
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
    await deleteFolder(props.mailboxId, folderToDelete.value.id);
    deleteOpen.value = false;
    await load();
    void mailboxStore.runSync();
  } catch (err) {
    error.value = err instanceof ApiError ? translateApiError(err) : t("folders.errors.delete");
  } finally {
    deleteSubmitting.value = false;
  }
}

function resetEdit() {
  editFolderName.value = "";
  editNameError.value = "";
  editInlineError.value = "";
}

function openEdit(folder: Folder) {
  resetEdit();
  folderToEdit.value = folder;
  editFolderName.value = folder.name;
  editOpen.value = true;
}

function validateEditName(): boolean {
  editNameError.value = "";
  const trimmed = editFolderName.value.trim();
  if (!trimmed) {
    editNameError.value = t("validation.folderName.required");
    return false;
  }
  const parsed = folderNameSchema.safeParse(trimmed);
  if (!parsed.success) {
    editNameError.value = nameErrorFromMessage(parsed.error.issues[0]?.message);
    return false;
  }
  if (isReservedFolderName(trimmed)) {
    editNameError.value = t("folders.errors.reserved");
    return false;
  }
  return true;
}

function mapEditError(err: ApiError) {
  const fieldError = nameErrorFromApi(err);
  if (fieldError) {
    editNameError.value = fieldError;
    return;
  }
  editInlineError.value = translateApiError(err);
}

async function submitEdit() {
  editInlineError.value = "";
  if (!folderToEdit.value) return;
  if (!validateEditName()) return;

  editSubmitting.value = true;
  try {
    await renameFolder(props.mailboxId, folderToEdit.value.id, editFolderName.value.trim());
    editOpen.value = false;
    await load();
    void mailboxStore.runSync();
  } catch (err) {
    if (err instanceof ApiError) {
      mapEditError(err);
    } else {
      editInlineError.value = t("folders.errors.connection");
    }
  } finally {
    editSubmitting.value = false;
  }
}

onMounted(() => load());
watch(
  () => props.mailboxId,
  () => load(),
);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-lg font-semibold text-foreground">{{ t("folders.title") }}</h2>
        <p class="text-sm text-muted-foreground">{{ t("folders.description") }}</p>
      </div>
      <Button @click="openCreate">
        <Icon icon="lucide:folder-plus" />
        <span>{{ t("folders.actions.create") }}</span>
      </Button>
    </div>

    <div v-if="isLoading" class="flex flex-col gap-4">
      <Skeleton v-for="n in 4" :key="n" class="h-13 w-full" />
    </div>

    <div v-else-if="error" class="flex flex-col gap-4">
      <Alert variant="destructive">{{ error }}</Alert>
      <Button variant="ghost" @click="load">{{ t("common.actions.retry") }}</Button>
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- System folders -->
      <Collapsible class="rounded-lg border bg-card p-4">
        <CollapsibleTrigger class="mb-3">
          <h3 class="text-sm font-semibold text-muted-foreground">
            {{ t("folders.system.title") }}
          </h3>
          <span class="flex items-center gap-2">
            <Badge variant="outline">{{ systemFolders.length }}</Badge>
            <Icon
              icon="lucide:chevron-down"
              class="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul class="divide-y">
            <li
              v-for="folder in systemFolders"
              :key="folder.id"
              class="flex items-center justify-between py-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <Icon icon="lucide:folder" class="size-5 shrink-0 text-muted-foreground" />
                <span class="truncate text-foreground">{{ folderDisplayName(folder) }}</span>
                <Badge variant="outline">{{ t("folders.system.badge") }}</Badge>
              </div>
              <Icon icon="lucide:lock" class="size-4 shrink-0 text-muted-foreground" />
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <!-- Custom folders -->
      <Collapsible default-open class="rounded-lg border bg-card p-4">
        <CollapsibleTrigger class="mb-3">
          <h3 class="text-sm font-semibold text-muted-foreground">
            {{ t("folders.custom.title") }}
          </h3>
          <span class="flex items-center gap-2">
            <Badge variant="outline">{{ customFolders.length }}</Badge>
            <Icon
              icon="lucide:chevron-down"
              class="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <EmptyState
            v-if="!hasCustomFolders"
            icon="lucide:folder-open"
            :heading="t('folders.empty.title')"
            :description="t('folders.empty.description')"
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
              <div class="flex items-center gap-1">
                <Button
                  :aria-label="t('folders.aria.renameFolder', { name: folder.name })"
                  variant="ghost"
                  size="icon"
                  @click="openEdit(folder)"
                >
                  <Icon icon="lucide:pencil" class="size-4 shrink-0 text-muted-foreground" />
                </Button>
                <Button
                  :aria-label="t('folders.aria.deleteFolder', { name: folder.name })"
                  variant="ghost"
                  size="icon"
                  @click="openDelete(folder)"
                >
                  <Icon icon="lucide:trash" class="text-destructive" />
                </Button>
              </div>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>

    <!-- Create folder dialog -->
    <DialogRoot v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("folders.create.title") }}</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="createInlineError" variant="destructive">{{ createInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("folders.fields.name") }}</span>
            <Input
              v-model="newFolderName"
              :placeholder="t('folders.fields.namePlaceholder')"
              :disabled="createSubmitting"
              :aria-invalid="nameError ? 'true' : undefined"
              maxlength="64"
            />
            <p v-if="nameError" class="text-sm text-destructive">{{ nameError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="createSubmitting" @click="createOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="createSubmitting" @click="submitCreate">
            <Icon v-if="createSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("folders.create.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Edit folder dialog -->
    <DialogRoot v-model:open="editOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("folders.edit.title") }}</DialogTitle>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-2">
          <Alert v-if="editInlineError" variant="destructive">{{ editInlineError }}</Alert>

          <label class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("folders.fields.name") }}</span>
            <Input
              v-model="editFolderName"
              :placeholder="t('folders.fields.namePlaceholder')"
              :disabled="editSubmitting"
              :aria-invalid="editNameError ? 'true' : undefined"
              maxlength="64"
            />
            <p v-if="editNameError" class="text-sm text-destructive">{{ editNameError }}</p>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" :disabled="editSubmitting" @click="editOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button :disabled="editSubmitting" @click="submitEdit">
            <Icon v-if="editSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("folders.edit.submit") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>

    <!-- Delete confirmation -->
    <DialogRoot v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("folders.delete.title") }}</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-foreground">
          {{ deletePrefix }}<strong>{{ folderToDelete?.name }}</strong>{{ deleteSuffix }}
        </p>
        <DialogFooter>
          <Button variant="ghost" :disabled="deleteSubmitting" @click="deleteOpen = false">
            {{ t("common.actions.cancel") }}
          </Button>
          <Button variant="destructive" :disabled="deleteSubmitting" @click="confirmDelete">
            <Icon v-if="deleteSubmitting" icon="lucide:loader-circle" class="animate-spin" />
            <span>{{ t("common.actions.delete") }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  </div>
</template>
