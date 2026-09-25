<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

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
