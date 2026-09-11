<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <th
    :class="
      cn(
        'h-10 px-4 text-left align-middle font-medium text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
  </th>
</template>
