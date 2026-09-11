<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

type Size = "sm" | "lg";

interface Props {
  size?: Size;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: "sm"
});

const iconClass = computed(() => (props.size === "lg" ? "size-7" : "size-5"));
const textClass = computed(() => (props.size === "lg" ? "text-xl" : "text-base"));
</script>

<template>
  <div :class="cn('inline-flex items-center gap-2', props.class)">
    <Icon icon="lucide:mail" :class="cn('text-primary-foreground', iconClass)" />
    <span :class="cn('font-semibold text-foreground', textClass)">Runmail</span>
  </div>
</template>
