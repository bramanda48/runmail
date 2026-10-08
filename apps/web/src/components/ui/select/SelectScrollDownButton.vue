<script setup lang="ts">
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { SelectScrollDownButton, type SelectScrollDownButtonProps, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<SelectScrollDownButtonProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = computed(() => {
  const { class: _ignored, ...delegated } = props;
  void _ignored;
  return delegated;
});

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <SelectScrollDownButton
    data-slot="select-scroll-down-button"
    v-bind="{ ...$attrs, ...forwarded }"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <Icon icon="lucide:chevron-down" class="size-4" />
    </slot>
  </SelectScrollDownButton>
</template>
