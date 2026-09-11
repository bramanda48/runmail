<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

type Shape = "block" | "list" | "detail" | "form";

interface Props {
  shape?: Shape;
  rows?: number;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  shape: "block",
  rows: 3
});
</script>

<template>
  <div :class="cn('animate-pulse', props.class)" aria-hidden="true">
    <template v-if="shape === 'block'">
      <div class="h-24 w-full rounded-md bg-muted" />
    </template>

    <template v-else-if="shape === 'list'">
      <div v-for="i in rows" :key="i" class="flex items-center gap-4 py-3">
        <div class="size-10 rounded-full bg-muted" />
        <div class="flex-1 space-y-2">
          <div class="h-4 w-1/3 rounded bg-muted" />
          <div class="h-3 w-2/3 rounded bg-muted" />
        </div>
      </div>
    </template>

    <template v-else-if="shape === 'detail'">
      <div class="space-y-4">
        <div class="h-8 w-2/3 rounded bg-muted" />
        <div class="h-4 w-full rounded bg-muted" />
        <div class="h-4 w-5/6 rounded bg-muted" />
      </div>
    </template>

    <template v-else-if="shape === 'form'">
      <div class="space-y-4">
        <div v-for="i in rows" :key="i" class="space-y-2">
          <div class="h-4 w-1/4 rounded bg-muted" />
          <div class="h-9 w-full rounded-md bg-muted" />
        </div>
      </div>
    </template>
  </div>
</template>
