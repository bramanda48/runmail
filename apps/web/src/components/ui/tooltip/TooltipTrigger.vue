<script setup lang="ts">
import { cn } from "@/lib/utils";
import { TooltipTrigger, type TooltipTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<TooltipTriggerProps & { class?: HTMLAttributes["class"] }>();
</script>

<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="$attrs" :class="cn(props.class)">
    <slot />
  </TooltipTrigger>
</template>
