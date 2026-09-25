<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { badgeVariants } from ".";

interface Props {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "inactive",
});

const classes = computed(() => cn(badgeVariants({ variant: props.variant }), props.class));
</script>

<template>
  <span :class="classes">
    <slot />
  </span>
</template>
