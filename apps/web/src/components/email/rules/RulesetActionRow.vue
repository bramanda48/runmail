<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/icons";
import { folderDisplayName } from "@/i18n/folders";
import type { ActionType } from "@runmail/shared";
import { ACTION_TYPES } from "@runmail/shared";
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";

export interface ActionRow {
  id: string;
  action_type: ActionType;
  action_value: string;
}

export interface FolderOption {
  id: string;
  name: string;
  folder_type: "system" | "custom";
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

const { t } = useI18n();

const ACTION_TYPE_LABEL_KEYS: Record<ActionType, string> = {
  move_to_folder: "rulesets.action.moveToFolder",
  mark_as_star: "rulesets.action.markAsStar",
  mark_as_read: "rulesets.action.markAsRead",
};

const actionTypeOptions = computed(() =>
  ACTION_TYPES.map((value) => ({ value, label: t(ACTION_TYPE_LABEL_KEYS[value]) })),
);

const folderOptions = computed(() =>
  props.folders.map((folder) => ({
    value: folder.id,
    label: folderDisplayName(folder),
  })),
);

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
        <Select v-model="localAction.action_type" :disabled="isSaving">
          <SelectTrigger class="md:w-48" :aria-label="t('rulesets.actionRow.typeAria')">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in actionTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex-1">
          <template v-if="localAction.action_type === 'move_to_folder'">
            <Select v-model="localAction.action_value" :disabled="isSaving">
              <SelectTrigger
                :aria-label="t('rulesets.actionRow.folderAria')"
                :aria-invalid="Boolean(error)"
              >
                <SelectValue :placeholder="t('rulesets.actionRow.folderPlaceholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in folderOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </template>
          <p v-if="error" class="mt-1 text-sm text-destructive">
            {{ error }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <Button
          :aria-label="t('rulesets.actionRow.moveUpAria')"
          variant="ghost"
          size="icon"
          :disabled="isSaving || !canMoveUp"
          @click="emits('move-up')"
        >
          <Icon icon="lucide:chevron-up" />
        </Button>
        <Button
          :aria-label="t('rulesets.actionRow.moveDownAria')"
          variant="ghost"
          size="icon"
          :disabled="isSaving || !canMoveDown"
          @click="emits('move-down')"
        >
          <Icon icon="lucide:chevron-down" />
        </Button>
        <Button
          :aria-label="t('rulesets.actionRow.removeAria')"
          variant="ghost"
          size="icon"
          :disabled="isSaving || !canRemove"
          @click="emits('remove')"
        >
          <Icon icon="lucide:x" />
        </Button>
      </div>
    </div>
  </div>
</template>
