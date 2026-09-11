<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { RouterLink } from "vue-router";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  icon?: string;
  count?: number;
  to?: RouteLocationRaw;
  active?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  active: false
});

const baseClasses =
  "flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const stateClasses = computed(() =>
  props.active
    ? "bg-primary text-primary-foreground"
    : "text-foreground hover:bg-accent hover:text-accent-foreground"
);

const classes = computed(() => cn(baseClasses, stateClasses.value, props.class));

const countClasses = computed(() =>
  cn(
    "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
    props.active
      ? "bg-primary-foreground/10 text-primary-foreground"
      : "bg-muted text-muted-foreground"
  )
);
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="classes">
    <Icon v-if="icon" :icon="icon" class="size-4 shrink-0" />
    <span class="flex-1 text-left">{{ label }}</span>
    <span v-if="count !== undefined" :class="countClasses">{{ count }}</span>
  </RouterLink>

  <button v-else type="button" :class="classes">
    <Icon v-if="icon" :icon="icon" class="size-4 shrink-0" />
    <span class="flex-1 text-left">{{ label }}</span>
    <span v-if="count !== undefined" :class="countClasses">{{ count }}</span>
  </button>
</template>
