<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes, InputHTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { inputVariants } from ".";

interface Props {
  modelValue?: string;
  variant?: VariantProps<typeof inputVariants>["variant"];
  size?: VariantProps<typeof inputVariants>["size"];
  type?: InputHTMLAttributes["type"];
  placeholder?: string;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  variant: "default",
  size: "md"
});

const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

const classes = computed(() =>
  cn(inputVariants({ variant: props.variant, size: props.size }), props.class)
);

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="modelValue"
    :class="classes"
    @input="onInput"
  />
</template>
