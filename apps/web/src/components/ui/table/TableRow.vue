<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <tr :class="cn('border-b transition-colors hover:bg-accent', props.class)">
    <slot />
  </tr>
</template>
