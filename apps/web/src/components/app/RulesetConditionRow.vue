<script setup lang="ts">
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Icon } from "@/icons";
import type { MatchType, RuleField } from "@runmail/shared";
import { MATCH_TYPES, RULE_FIELDS } from "@runmail/shared";
import { computed, watch } from "vue";

export interface ConditionRow {
  id: string;
  field: RuleField;
  match_type: MatchType;
  condition_value: string;
}

const props = defineProps<{
  condition: ConditionRow;
  conditionIndex: number;
  isSaving: boolean;
  error?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
}>();

const emits = defineEmits<{
  "update:condition": [condition: ConditionRow];
  remove: [];
  "move-up": [];
  "move-down": [];
}>();

const fieldOptions = computed(() => RULE_FIELDS.map((v) => ({ value: v, label: v })));

const matchTypeOptions = computed(() => MATCH_TYPES.map((v) => ({ value: v, label: v })));

const localCondition = computed({
  get: () => props.condition,
  set: (value) => emits("update:condition", value),
});

watch(
  () => props.condition,
  (newValue) => {
    localCondition.value = newValue;
  },
);
</script>

<template>
  <div class="rounded-xl border bg-background p-3">
    <div class="flex flex-col gap-3 md:flex-row md:items-start">
      <div class="flex flex-1 flex-col gap-3 md:flex-row">
        <Select
          v-model="localCondition.field"
          :options="fieldOptions"
          :disabled="isSaving"
          class="md:w-32"
          ariaLabel="Field kondisi"
        />
        <Select
          v-model="localCondition.match_type"
          :options="matchTypeOptions"
          :disabled="isSaving"
          class="md:w-40"
          ariaLabel="Jenis pencocokan"
        />
        <div class="flex-1">
          <Input
            v-model="localCondition.condition_value"
            placeholder="Nilai yang dicocokkan"
            :disabled="isSaving"
            :variant="error ? 'error' : 'default'"
          />
          <p v-if="error" class="mt-1 text-sm text-destructive">
            {{ error }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <IconButton
          :ariaLabel="`Pindah kondisi ke atas`"
          variant="ghost"
          size="md"
          :disabled="isSaving || !canMoveUp"
          @click="emits('move-up')"
        >
          <Icon icon="lucide:chevron-up" />
        </IconButton>
        <IconButton
          :ariaLabel="`Pindah kondisi ke bawah`"
          variant="ghost"
          size="md"
          :disabled="isSaving || !canMoveDown"
          @click="emits('move-down')"
        >
          <Icon icon="lucide:chevron-down" />
        </IconButton>
        <IconButton
          :ariaLabel="`Hapus kondisi`"
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
