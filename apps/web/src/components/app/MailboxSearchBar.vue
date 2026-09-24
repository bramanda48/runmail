<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { Icon } from "@/icons";
import { ref, watch } from "vue";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emits = defineEmits<{
  "update:modelValue": [value: string];
  search: [value: string];
}>();

const searchQuery = ref(props.modelValue);
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.modelValue,
  (newValue) => {
    searchQuery.value = newValue;
  }
);

function onInput(value: string) {
  searchQuery.value = value;
  emits("update:modelValue", value);

  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    emits("search", value.trim());
  }, 300);
}
</script>

<template>
  <div class="relative">
    <Icon
      icon="lucide:search"
      class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      :model-value="searchQuery"
      :placeholder="placeholder || 'Search...'"
      class="h-9 w-full rounded-full pl-9"
      @update:model-value="onInput"
    />
  </div>
</template>
