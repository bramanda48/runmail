<script setup lang="ts">
import { cn } from "@/lib/utils";
import { SelectLabel, type SelectLabelProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<SelectLabelProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});
</script>

<template>
  <SelectLabel
    data-slot="select-label"
    v-bind="{ ...$attrs, ...delegatedProps }"
    :class="cn('px-2 py-1.5 text-sm font-semibold', props.class)"
  >
    <slot />
  </SelectLabel>
</template>
