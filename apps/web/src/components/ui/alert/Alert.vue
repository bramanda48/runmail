<script setup lang="ts">
import type { VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
// biome-ignore lint/style/useImportType: used as a runtime function in the template
import { alertVariants } from ".";

interface Props {
  variant?: VariantProps<typeof alertVariants>["variant"];
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  variant: "info"
});

const role = computed(() =>
  props.variant === "error" || props.variant === "warning" ? "alert" : undefined
);

const icon = computed(() => {
  switch (props.variant) {
    case "success":
      return "lucide:check-circle";
    case "warning":
      return "lucide:alert-triangle";
    case "error":
      return "lucide:circle-alert";
    default:
      return "lucide:info";
  }
});
</script>

<template>
  <div :role="role" :class="cn(alertVariants({ variant }), props.class)">
    <Icon :icon="icon" />
    <div class="text-sm">
      <slot />
    </div>
  </div>
</template>
