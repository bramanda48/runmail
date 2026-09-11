<script setup lang="ts">
import type {
  ActionType,
  Folder,
  LogicOperator,
  MatchType,
  RuleField,
  RulesetDetail
} from "@runmail/shared";
import {
  ACTION_TYPES,
  LOGIC_OPERATORS,
  MATCH_TYPES,
  RULE_FIELDS,
  rulesetSchema,
  validateRegexSafe
} from "@runmail/shared";
import { computed, onMounted, reactive, ref, watch } from "vue";
import AppShell from "@/components/app/app-shell.vue";
import FolderNavigation from "@/components/app/folder-navigation.vue";
import MailboxSwitcher from "@/components/app/mailbox-switcher.vue";
import SyncIndicator from "@/components/app/sync-indicator.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMailboxWorkspace } from "@/composables/useMailboxWorkspace";
import { Icon } from "@/icons";
import { ApiError, createRuleset, getRuleset, listFolders, updateRuleset } from "@/lib/api";

interface ConditionRow {
  id: string;
  field: RuleField;
  match_type: MatchType;
  condition_value: string;
}

interface ActionRow {
  id: string;
  action_type: ActionType;
  action_value: string;
}

interface FormErrors {
  name?: string;
  priority?: string;
  inline?: string;
  conditions: (string | undefined)[];
  actions: (string | undefined)[];
}

const {
  route,
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
    notFound.value = true;
  }
});

const rulesetId = computed(() => route.params.ruleset_id as string);
const isCreate = computed(() => rulesetId.value === "new");

const isLoading = ref(false);
const isSaving = ref(false);
const notFound = ref(false);
const folders = ref<Folder[]>([]);

const form = reactive({
  name: "",
  priority: "0",
  logic_operator: "AND" as LogicOperator,
  is_enabled: true,
  conditions: [] as ConditionRow[],
  actions: [] as ActionRow[]
});

const errors = reactive<FormErrors>({
  conditions: [],
  actions: []
});

const folderOptions = computed(() => folders.value.map((f) => ({ value: f.id, label: f.name })));

const fieldOptions = computed(() => RULE_FIELDS.map((v) => ({ value: v, label: v })));

const matchTypeOptions = computed(() => MATCH_TYPES.map((v) => ({ value: v, label: v })));

const logicOperatorOptions = computed(() => LOGIC_OPERATORS.map((v) => ({ value: v, label: v })));

const actionTypeOptions = computed(() =>
  ACTION_TYPES.map((v) => ({
    value: v,
    label:
      v === "move_to_folder"
        ? "Pindah ke folder"
        : v === "mark_as_star"
          ? "Tandai bintang"
          : "Tandai sudah dibaca"
  }))
);

async function init() {
  await resolveMailbox();
  if (mailboxStore.mailboxId === mailboxId.value) {
    await loadFolders();
    await loadLocalFolders();
    await loadRuleset();
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createCondition(): ConditionRow {
  return { id: generateId(), field: "from", match_type: "contains", condition_value: "" };
}

function createAction(): ActionRow {
  return { id: generateId(), action_type: "move_to_folder", action_value: "" };
}

function resetForm() {
  form.name = "";
  form.priority = "0";
  form.logic_operator = "AND";
  form.is_enabled = true;
  form.conditions = [createCondition()];
  form.actions = [createAction()];
  clearErrors();
}

function clearErrors() {
  errors.name = undefined;
  errors.priority = undefined;
  errors.inline = undefined;
  errors.conditions = form.conditions.map(() => undefined);
  errors.actions = form.actions.map(() => undefined);
}

async function loadFolders() {
  try {
    const { folders: list } = await listFolders(mailboxId.value);
    folders.value = list;
  } catch {
    // Folders are only needed for action value select; failures are surfaced at save.
  }
}

function populateDetail(detail: RulesetDetail) {
  form.name = detail.name;
  form.priority = String(detail.priority);
  form.logic_operator = detail.logic_operator;
  form.is_enabled = detail.is_enabled;
  form.conditions = detail.conditions
    .slice()
    .sort((a, b) => a.condition_order - b.condition_order)
    .map((c) => ({
      id: generateId(),
      field: c.field,
      match_type: c.match_type,
      condition_value: c.condition_value
    }));
  form.actions = detail.actions
    .slice()
    .sort((a, b) => a.action_order - b.action_order)
    .map((a) => ({
      id: generateId(),
      action_type: a.action_type,
      action_value: a.action_value ?? ""
    }));
  clearErrors();
}

async function loadRuleset() {
  if (isCreate.value) {
    resetForm();
    return;
  }

  isLoading.value = true;
  notFound.value = false;
  try {
    const { ruleset } = await getRuleset(mailboxId.value, rulesetId.value);
    populateDetail(ruleset);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound.value = true;
    } else if (err instanceof ApiError) {
      errors.inline = err.message || "Gagal memuat ruleset. Coba lagi.";
    } else {
      errors.inline = "Gagal memuat ruleset. Coba lagi.";
    }
  } finally {
    isLoading.value = false;
  }
}

function addCondition() {
  form.conditions.push(createCondition());
  errors.conditions.push(undefined);
}

function removeCondition(index: number) {
  if (form.conditions.length <= 1) return;
  form.conditions.splice(index, 1);
  errors.conditions.splice(index, 1);
}

function moveCondition(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= form.conditions.length) return;
  const temp = form.conditions[index];
  form.conditions[index] = form.conditions[target];
  form.conditions[target] = temp;
  const tempErr = errors.conditions[index];
  errors.conditions[index] = errors.conditions[target];
  errors.conditions[target] = tempErr;
}

function addAction() {
  form.actions.push(createAction());
  errors.actions.push(undefined);
}

function removeAction(index: number) {
  if (form.actions.length <= 1) return;
  form.actions.splice(index, 1);
  errors.actions.splice(index, 1);
}

function moveAction(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= form.actions.length) return;
  const temp = form.actions[index];
  form.actions[index] = form.actions[target];
  form.actions[target] = temp;
  const tempErr = errors.actions[index];
  errors.actions[index] = errors.actions[target];
  errors.actions[target] = tempErr;
}

function validateForm(): boolean {
  clearErrors();
  let valid = true;

  const priorityNum = Number(form.priority);
  if (!form.name.trim()) {
    errors.name = "Nama ruleset wajib diisi";
    valid = false;
  }
  if (form.priority.trim() === "" || !Number.isInteger(priorityNum) || priorityNum < 0) {
    errors.priority = "Prioritas harus berupa bilangan bulat 0 atau lebih";
    valid = false;
  }

  const parsed = rulesetSchema.safeParse({
    name: form.name,
    priority: priorityNum,
    logic_operator: form.logic_operator,
    is_enabled: form.is_enabled,
    conditions: form.conditions.map((c) => ({
      field: c.field,
      match_type: c.match_type,
      condition_value: c.condition_value
    })),
    actions: form.actions.map((a) => ({
      action_type: a.action_type,
      action_value: a.action_type === "move_to_folder" ? a.action_value || null : null
    }))
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    if (flat.fieldErrors.name?.length) errors.name = flat.fieldErrors.name[0];
    if (flat.fieldErrors.priority?.length) errors.priority = flat.fieldErrors.priority[0];
    if (flat.fieldErrors.conditions?.length) {
      errors.inline = flat.fieldErrors.conditions[0];
      valid = false;
    }
    if (flat.fieldErrors.actions?.length) {
      errors.inline = flat.fieldErrors.actions[0];
      valid = false;
    }
  }

  form.conditions.forEach((c, i) => {
    if (!c.condition_value.trim()) {
      errors.conditions[i] = "Nilai kondisi wajib diisi";
      valid = false;
    } else if (c.match_type === "match regex" && !validateRegexSafe(c.condition_value)) {
      errors.conditions[i] = "Regex tidak valid";
      valid = false;
    }
  });

  form.actions.forEach((a, i) => {
    if (a.action_type === "move_to_folder" && !a.action_value) {
      errors.actions[i] = "Pilih folder tujuan";
      valid = false;
    }
  });

  return valid && parsed.success;
}

function mapSaveError(err: ApiError) {
  if (err.code === "RULESET_INVALID_REGEX") {
    const details = err.details as { index?: number } | undefined;
    const idx = details?.index;
    if (typeof idx === "number" && form.conditions[idx]) {
      errors.conditions[idx] = "Regex tidak valid";
    } else {
      errors.inline = "Regex tidak valid";
    }
    return;
  }
  if (err.code === "RULESET_INVALID_DEPENDENCY") {
    const details = err.details as { index?: number } | undefined;
    const idx = details?.index;
    if (typeof idx === "number" && form.actions[idx]) {
      errors.actions[idx] = "Folder tujuan tidak ditemukan pada mailbox ini";
    } else {
      errors.inline = "Folder tujuan tidak ditemukan pada mailbox ini";
    }
    return;
  }
  if (err.code === "VALIDATION_ERROR" && err.details && typeof err.details === "object") {
    const details = err.details as Record<string, string[]>;
    if (details.name?.length) errors.name = details.name[0];
    if (details.priority?.length) errors.priority = details.priority[0];
    if (details.logic_operator?.length) errors.inline = details.logic_operator[0];
    if (details.conditions?.length) errors.inline = details.conditions[0];
    if (details.actions?.length) errors.inline = details.actions[0];
    return;
  }
  errors.inline = err.message || "Gagal menyimpan ruleset. Coba lagi.";
}

async function submit() {
  if (!validateForm()) return;

  isSaving.value = true;
  errors.inline = undefined;

  const body = {
    name: form.name.trim(),
    priority: Number(form.priority),
    logic_operator: form.logic_operator,
    is_enabled: form.is_enabled,
    conditions: form.conditions.map((c) => ({
      field: c.field,
      match_type: c.match_type,
      condition_value: c.condition_value
    })),
    actions: form.actions.map((a) => ({
      action_type: a.action_type,
      action_value: a.action_type === "move_to_folder" ? a.action_value : null
    }))
  };

  try {
    if (isCreate.value) {
      await createRuleset(mailboxId.value, body);
    } else {
      await updateRuleset(mailboxId.value, rulesetId.value, body);
    }
    router.push(`/mailboxes/${mailboxId.value}/rulesets`);
  } catch (err) {
    if (err instanceof ApiError) {
      mapSaveError(err);
    } else {
      errors.inline = "Tidak dapat terhubung ke server. Coba lagi.";
    }
    isSaving.value = false;
  }
}

function goBack() {
  router.push(`/mailboxes/${mailboxId.value}/rulesets`);
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
      <Button
        variant="ghost"
        size="sm"
        class="mb-4 w-fit"
        @click="goBack"
      >
        <Icon icon="lucide:arrow-left" />
        <span>Kembali ke Ruleset</span>
      </Button>

      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-foreground">
          {{ isCreate ? "Ruleset Baru" : "Ubah Ruleset" }}
        </h1>
        <p class="text-sm text-muted-foreground">
          Atur kondisi dan aksi pemrosesan email.
        </p>
      </div>

      <div v-if="isLoading" class="space-y-4">
        <Skeleton shape="form" :rows="6" />
      </div>

      <div v-else-if="notFound" class="space-y-4">
        <Alert variant="error">Ruleset tidak ditemukan.</Alert>
        <Button variant="ghost" @click="goBack">Kembali ke daftar ruleset</Button>
      </div>

      <Card v-else>
        <CardHeader>
          <CardTitle>Detail Ruleset</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <Alert v-if="errors.inline" variant="error">{{ errors.inline }}</Alert>

          <div class="grid gap-4 md:grid-cols-2">
            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-foreground">Nama Ruleset</span>
              <Input
                v-model="form.name"
                placeholder="Contoh: Filter newsletter"
                :disabled="isSaving"
                :variant="errors.name ? 'error' : 'default'"
              />
              <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
            </label>

            <label class="block space-y-1.5">
              <span class="text-sm font-medium text-foreground">Prioritas</span>
              <Input
                v-model="form.priority"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                :disabled="isSaving"
                :variant="errors.priority ? 'error' : 'default'"
              />
              <p class="text-xs text-muted-foreground">Angka lebih kecil dieksekusi lebih dahulu.</p>
              <p v-if="errors.priority" class="text-sm text-destructive">{{ errors.priority }}</p>
            </label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <Select
              v-model="form.logic_operator"
              label="Logika Kondisi"
              id="select-logic-operator"
              :options="logicOperatorOptions"
              :disabled="isSaving"
            />

            <div class="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium text-foreground">Aktifkan Ruleset</p>
                <p class="text-xs text-muted-foreground">Ruleset nonaktif tidak akan dieksekusi.</p>
              </div>
              <Switch
                :model-value="form.is_enabled"
                ariaLabel="Aktifkan ruleset"
                :disabled="isSaving"
                @update:model-value="form.is_enabled = $event"
              />
            </div>
          </div>

          <!-- Conditions -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">Kondisi</h3>
            <div
              v-for="(condition, index) in form.conditions"
              :key="condition.id"
              class="rounded-xl border bg-background p-3"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start">
                <div class="flex-1 space-y-3 md:space-y-0 md:flex md:gap-3">
                  <Select
                    v-model="condition.field"
                    :options="fieldOptions"
                    :disabled="isSaving"
                    class="md:w-32"
                    ariaLabel="Field kondisi"
                  />
                  <Select
                    v-model="condition.match_type"
                    :options="matchTypeOptions"
                    :disabled="isSaving"
                    class="md:w-40"
                    ariaLabel="Jenis pencocokan"
                  />
                  <div class="flex-1">
                    <Input
                      v-model="condition.condition_value"
                      placeholder="Nilai yang dicocokkan"
                      :disabled="isSaving"
                      :variant="errors.conditions[index] ? 'error' : 'default'"
                    />
                    <p v-if="errors.conditions[index]" class="mt-1 text-sm text-destructive">
                      {{ errors.conditions[index] }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <IconButton
                    :ariaLabel="`Pindah kondisi ke atas`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || index === 0"
                    @click="moveCondition(index, -1)"
                  >
                    <Icon icon="lucide:chevron-up" />
                  </IconButton>
                  <IconButton
                    :ariaLabel="`Pindah kondisi ke bawah`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || index === form.conditions.length - 1"
                    @click="moveCondition(index, 1)"
                  >
                    <Icon icon="lucide:chevron-down" />
                  </IconButton>
                  <IconButton
                    :ariaLabel="`Hapus kondisi`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || form.conditions.length <= 1"
                    @click="removeCondition(index)"
                  >
                    <Icon icon="lucide:x" />
                  </IconButton>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="isSaving"
              @click="addCondition"
            >
              <Icon icon="lucide:plus" />
              <span>Tambah Condition</span>
            </Button>
          </div>

          <!-- Actions -->
          <div class="space-y-3">
            <h3 class="text-sm font-semibold text-foreground">Aksi</h3>
            <div
              v-for="(action, index) in form.actions"
              :key="action.id"
              class="rounded-xl border bg-background p-3"
            >
              <div class="flex flex-col gap-3 md:flex-row md:items-start">
                <div class="flex-1 space-y-3 md:space-y-0 md:flex md:gap-3">
                  <Select
                    v-model="action.action_type"
                    :options="actionTypeOptions"
                    :disabled="isSaving"
                    class="md:w-48"
                    ariaLabel="Tipe aksi"
                  />
                  <div class="flex-1">
                    <Select
                      v-if="action.action_type === 'move_to_folder'"
                      v-model="action.action_value"
                      :options="folderOptions"
                      placeholder="Pilih folder tujuan"
                      :disabled="isSaving"
                      :error="Boolean(errors.actions[index])"
                      ariaLabel="Folder tujuan aksi"
                    />
                    <p v-if="errors.actions[index]" class="mt-1 text-sm text-destructive">
                      {{ errors.actions[index] }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <IconButton
                    :ariaLabel="`Pindah aksi ke atas`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || index === 0"
                    @click="moveAction(index, -1)"
                  >
                    <Icon icon="lucide:chevron-up" />
                  </IconButton>
                  <IconButton
                    :ariaLabel="`Pindah aksi ke bawah`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || index === form.actions.length - 1"
                    @click="moveAction(index, 1)"
                  >
                    <Icon icon="lucide:chevron-down" />
                  </IconButton>
                  <IconButton
                    :ariaLabel="`Hapus aksi`"
                    variant="ghost"
                    size="md"
                    :disabled="isSaving || form.actions.length <= 1"
                    @click="removeAction(index)"
                  >
                    <Icon icon="lucide:x" />
                  </IconButton>
                </div>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              Jika ada beberapa aksi move, move terakhir menentukan folder akhir.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="isSaving"
              @click="addAction"
            >
              <Icon icon="lucide:plus" />
              <span>Tambah Action</span>
            </Button>
          </div>

          <div class="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" :disabled="isSaving" @click="goBack">
              Batal
            </Button>
            <Button :disabled="isSaving" @click="submit">
              <Icon v-if="isSaving" icon="lucide:loader-circle" class="animate-spin" />
              <span>Simpan</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  </AppShell>
</template>
