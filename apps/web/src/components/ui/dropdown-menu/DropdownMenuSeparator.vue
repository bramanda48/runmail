<script setup lang="ts">
import { cn } from "@/lib/utils";
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  >
    <slot />
  </DropdownMenuSeparator>
</template>
