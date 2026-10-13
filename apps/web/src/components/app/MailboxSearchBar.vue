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
  },
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
  <div
    class="relative flex h-12 w-full items-center rounded-full bg-muted px-4 transition-all focus-within:border focus-within:border-border focus-within:bg-background focus-within:ring-1 focus-within:ring-ring"
  >
    <Icon icon="lucide:search" class="mr-3 size-4 shrink-0 text-muted-foreground" />
    <Input
      :model-value="searchQuery"
      :placeholder="placeholder || 'Search...'"
      class="h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
      @update:model-value="onInput"
    />
    <Icon
      icon="lucide:sliders-horizontal"
      class="ml-3 size-4 shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  </div>
</template>
