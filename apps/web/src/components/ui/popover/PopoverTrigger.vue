<script setup lang="ts">
import { cn } from "@/lib/utils";
import { PopoverTrigger, type PopoverTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<PopoverTriggerProps & { class?: HTMLAttributes["class"] }>();
</script>

<template>
  <PopoverTrigger data-slot="popover-trigger" v-bind="$attrs" :class="cn(props.class)">
    <slot />
  </PopoverTrigger>
</template>
