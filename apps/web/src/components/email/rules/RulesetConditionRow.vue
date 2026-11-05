<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon } from "@/icons";
import type { MatchType, RuleField } from "@runmail/shared";
import { MATCH_TYPES, RULE_FIELDS } from "@runmail/shared";
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";

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

const { t } = useI18n();

const FIELD_LABEL_KEYS: Record<RuleField, string> = {
  from: "rulesets.field.from",
  subject: "rulesets.field.subject",
  header: "rulesets.field.header",
};

const MATCH_TYPE_LABEL_KEYS: Record<MatchType, string> = {
  contains: "rulesets.match.contains",
  "not contains": "rulesets.match.notContains",
  equal: "rulesets.match.equal",
  "not equal": "rulesets.match.notEqual",
  "start with": "rulesets.match.startWith",
  "end with": "rulesets.match.endWith",
  "match regex": "rulesets.match.matchRegex",
};

const fieldOptions = computed(() =>
  RULE_FIELDS.map((value) => ({ value, label: t(FIELD_LABEL_KEYS[value]) })),
);

const matchTypeOptions = computed(() =>
  MATCH_TYPES.map((value) => ({ value, label: t(MATCH_TYPE_LABEL_KEYS[value]) })),
);

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
        <Select v-model="localCondition.field" :disabled="isSaving">
          <SelectTrigger class="md:w-32" :aria-label="t('rulesets.condition.fieldAria')">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in fieldOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="localCondition.match_type" :disabled="isSaving">
          <SelectTrigger class="md:w-40" :aria-label="t('rulesets.condition.matchAria')">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in matchTypeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="flex-1">
          <Input
            v-model="localCondition.condition_value"
            :placeholder="t('rulesets.condition.valuePlaceholder')"
            :disabled="isSaving"
            :aria-invalid="Boolean(error)"
          />
          <p v-if="error" class="mt-1 text-sm text-destructive">
            {{ error }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <Button
          :aria-label="t('rulesets.condition.moveUpAria')"
          variant="ghost"
          size="icon"
          :disabled="isSaving || !canMoveUp"
          @click="emits('move-up')"
        >
          <Icon icon="lucide:chevron-up" />
        </Button>
        <Button
          :aria-label="t('rulesets.condition.moveDownAria')"
          variant="ghost"
          size="icon"
          :disabled="isSaving || !canMoveDown"
          @click="emits('move-down')"
        >
          <Icon icon="lucide:chevron-down" />
        </Button>
        <Button
          :aria-label="t('rulesets.condition.removeAria')"
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
