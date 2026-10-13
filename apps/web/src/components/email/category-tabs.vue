<script setup lang="ts">
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue: string;
}>();

const emits = defineEmits<{
  "update:modelValue": [value: string];
}>();

const tabs = [
  { value: "utama", label: "Utama", icon: "lucide:inbox" },
  { value: "promosi", label: "Promosi", icon: "lucide:tag" },
  { value: "sosial", label: "Sosial", icon: "lucide:users" },
] as const;

const baseTabClasses = "flex items-center gap-3 border-b-2 px-6 py-3";

function selectTab(value: string) {
  emits("update:modelValue", value);
}
</script>

<template>
  <div role="tablist" class="flex px-4 border-b border-border">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      :aria-selected="props.modelValue === tab.value"
      :class="
        cn(
          baseTabClasses,
          props.modelValue === tab.value
            ? 'border-primary text-primary font-semibold'
            : 'border-transparent text-muted-foreground hover:bg-accent font-medium',
        )
      "
      @click="selectTab(tab.value)"
    >
      <Icon :icon="tab.icon" class="size-4 shrink-0" />
      <span class="truncate text-sm">{{ tab.label }}</span>
    </button>
  </div>
</template>
