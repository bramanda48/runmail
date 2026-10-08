<script setup lang="ts">
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { SelectScrollUpButton, type SelectScrollUpButtonProps, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<SelectScrollUpButtonProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <SelectScrollUpButton
    data-slot="select-scroll-up-button"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <Icon icon="lucide:chevron-up" class="size-4" />
    </slot>
  </SelectScrollUpButton>
</template>
