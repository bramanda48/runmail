<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui";
import { CollapsibleContent, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<CollapsibleContentProps & { class?: HTMLAttributes["class"] }>();
const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CollapsibleContent
    v-bind="forwardedProps"
    :class="cn('overflow-hidden', props.class)"
  >
    <slot />
  </CollapsibleContent>
</template>
