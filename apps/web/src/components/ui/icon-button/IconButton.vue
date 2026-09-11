<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { PrimitiveProps } from "reka-ui";
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { iconButtonVariants } from ".";

interface Props extends PrimitiveProps {
  ariaLabel: string;
  variant?: VariantProps<typeof iconButtonVariants>["variant"];
  size?: VariantProps<typeof iconButtonVariants>["size"];
  loading?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  variant: "default",
  size: "md",
  loading: false
});

const classes = computed(() =>
  cn(iconButtonVariants({ variant: props.variant, size: props.size }), props.class)
);
</script>

<template>
  <Primitive
    :as="as"
    :aria-label="ariaLabel"
    :aria-busy="loading"
    :disabled="loading"
    :class="classes"
  >
    <slot v-if="!loading" />
    <Icon v-else icon="lucide:loader-circle" class="animate-spin" />
  </Primitive>
</template>
