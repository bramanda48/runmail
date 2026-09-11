<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import { DialogContent as DialogContentPrimitive, DialogOverlay, DialogPortal } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { dialogContentVariants } from ".";

interface Props {
  variant?: VariantProps<typeof dialogContentVariants>["variant"];
  size?: VariantProps<typeof dialogContentVariants>["size"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "md"
});

const classes = computed(() =>
  cn(dialogContentVariants({ variant: props.variant, size: props.size }), props.class)
);
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-50 bg-black/50" />
    <DialogContentPrimitive :class="classes">
      <slot />
    </DialogContentPrimitive>
  </DialogPortal>
</template>
