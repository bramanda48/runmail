<script setup lang="ts">
import { cn } from "@/lib/utils";
import { DropdownMenuLabel, type DropdownMenuLabelProps, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<
  DropdownMenuLabelProps & { class?: HTMLAttributes["class"]; inset?: boolean }
>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    v-bind="{ ...$attrs, ...forwarded }"
    :data-inset="inset || undefined"
    :class="cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', props.class)"
  >
    <slot />
  </DropdownMenuLabel>
</template>
