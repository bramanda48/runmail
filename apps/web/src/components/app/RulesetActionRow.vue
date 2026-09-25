<script setup lang="ts">
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Icon } from "@/icons";
import type { ActionType } from "@runmail/shared";
import { ACTION_TYPES } from "@runmail/shared";
import { computed, watch } from "vue";

export interface ActionRow {
  id: string;
  action_type: ActionType;
  action_value: string;
}

export interface FolderOption {
  id: string;
  name: string;
}

const props = defineProps<{
  action: ActionRow;
  actionIndex: number;
  folders: FolderOption[];
  isSaving: boolean;
  error?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
}>();

const emits = defineEmits<{
  "update:action": [action: ActionRow];
  remove: [];
  "move-up": [];
  "move-down": [];
}>();

const actionTypeOptions = computed(() =>
  ACTION_TYPES.map((v) => ({
    value: v,
    label:
      v === "move_to_folder"
        ? "Pindah ke folder"
        : v === "mark_as_star"
          ? "Tandai bintang"
          : "Tandai sudah dibaca",
  })),
);

const folderOptions = computed(() => props.folders.map((f) => ({ value: f.id, label: f.name })));

const localAction = computed({
  get: () => props.action,
  set: (value) => emits("update:action", value),
});

watch(
  () => props.action,
  (newValue) => {
    localAction.value = newValue;
  },
);
</script>

<template>
  <div class="rounded-xl border bg-background p-3">
    <div class="flex flex-col gap-3 md:flex-row md:items-start">
      <div class="flex flex-1 flex-col gap-3 md:flex-row">
        <Select
          v-model="localAction.action_type"
          :options="actionTypeOptions"
          :disabled="isSaving"
          class="md:w-48"
          ariaLabel="Tipe aksi"
        />
        <div class="flex-1">
          <Select
            v-if="localAction.action_type === 'move_to_folder'"
            v-model="localAction.action_value"
            :options="folderOptions"
            placeholder="Pilih folder tujuan"
            :disabled="isSaving"
            :error="Boolean(error)"
            ariaLabel="Folder tujuan aksi"
          />
          <p v-if="error" class="mt-1 text-sm text-destructive">
            {{ error }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <IconButton
          :ariaLabel="`Pindah aksi ke atas`"
          variant="ghost"
          size="md"
          :disabled="isSaving || !canMoveUp"
          @click="emits('move-up')"
        >
          <Icon icon="lucide:chevron-up" />
        </IconButton>
        <IconButton
          :ariaLabel="`Pindah aksi ke bawah`"
          variant="ghost"
          size="md"
          :disabled="isSaving || !canMoveDown"
          @click="emits('move-down')"
        >
          <Icon icon="lucide:chevron-down" />
        </IconButton>
        <IconButton
          :ariaLabel="`Hapus aksi`"
          variant="ghost"
          size="md"
          :disabled="isSaving || !canRemove"
          @click="emits('remove')"
        >
          <Icon icon="lucide:x" />
        </IconButton>
      </div>
    </div>
  </div>
</template>
