<script setup lang="ts">
import { cn } from "@/lib/utils";
import { DialogTitle } from "reka-ui";
import type { HTMLAttributes } from "vue";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <DialogTitle
    as="h2"
    :class="cn('text-lg font-semibold leading-none tracking-tight text-foreground', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
