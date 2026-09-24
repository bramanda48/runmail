<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  modelValue: string;
  options: Option[];
  label?: string;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

const triggerClasses = computed(() =>
  cn(
    "flex h-9 w-full items-center justify-between rounded-md border bg-surface px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    props.error ? "border-destructive" : "border-input",
    props.class
  )
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-medium text-foreground">{{ label }}</label>
    <SelectRoot
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <SelectTrigger :id="id" :aria-label="ariaLabel" :disabled="disabled" :class="triggerClasses">
        <SelectValue :placeholder="placeholder" class="truncate" />
        <Icon icon="lucide:chevron-down" class="size-4 shrink-0 opacity-50" />
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-surface text-foreground shadow-sm"
        >
          <SelectViewport class="p-1">
            <SelectItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
              class="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <SelectItemIndicator>
                  <Icon icon="lucide:check" class="size-4" />
                </SelectItemIndicator>
              </span>
              <SelectItemText>{{ option.label }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>
