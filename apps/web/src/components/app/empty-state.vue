<script setup lang="ts">
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

interface Props {
  icon: string;
  heading: string;
  description: string;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col items-center justify-center rounded-2xl bg-muted/50 p-8 text-center',
        props.class,
      )
    "
  >
    <Icon :icon="icon" class="mb-4 size-12 text-muted-foreground" />
    <h3 class="text-lg font-semibold text-foreground">{{ heading }}</h3>
    <p class="mt-1 max-w-sm text-sm text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
