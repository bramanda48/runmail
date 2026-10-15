<script setup lang="ts">
import { cn } from "@/lib/utils";
import { DropdownMenuTrigger, type DropdownMenuTriggerProps, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<DropdownMenuTriggerProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <DropdownMenuTrigger
    data-slot="dropdown-menu-trigger"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn(props.class)"
  >
    <slot />
  </DropdownMenuTrigger>
</template>
