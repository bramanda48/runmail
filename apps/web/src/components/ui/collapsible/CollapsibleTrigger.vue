<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui";
import { CollapsibleTrigger, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<CollapsibleTriggerProps & { class?: HTMLAttributes["class"] }>();
const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CollapsibleTrigger
    v-bind="forwardedProps"
    :class="cn('group flex w-full cursor-pointer items-center justify-between', props.class)"
  >
    <slot />
  </CollapsibleTrigger>
</template>
