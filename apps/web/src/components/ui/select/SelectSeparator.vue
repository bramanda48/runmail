<script setup lang="ts">
import { cn } from "@/lib/utils";
import { SelectSeparator, type SelectSeparatorProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<SelectSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});
</script>

<template>
  <SelectSeparator
    data-slot="select-separator"
    v-bind="{ ...$attrs, ...delegatedProps }"
    :class="cn('-mx-1 my-1 h-px bg-muted', props.class)"
  />
</template>
