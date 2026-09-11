<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  perPage: number;
  total: number;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<{
  (e: "prev"): void;
  (e: "next"): void;
}>();

const start = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1));
const end = computed(() => Math.min(props.page * props.perPage, props.total));
const isFirst = computed(() => props.page <= 1);
const isLast = computed(() => props.page * props.perPage >= props.total);

function prev() {
  if (!isFirst.value) {
    emit("prev");
  }
}

function next() {
  if (!isLast.value) {
    emit("next");
  }
}
</script>

<template>
  <nav
    :class="cn('flex items-center gap-3', props.class)"
    aria-label="Navigasi halaman"
  >
    <IconButton
      :ariaLabel="'Halaman sebelumnya'"
      variant="ghost"
      size="sm"
      :disabled="disabled || isFirst"
      @click="prev"
    >
      <Icon icon="lucide:chevron-left" />
    </IconButton>

    <span class="text-sm text-foreground">
      <slot name="range" :start="start" :end="end" :total="total">
        {{ start }}–{{ end }} dari {{ total }}
      </slot>
    </span>

    <IconButton
      :ariaLabel="'Halaman berikutnya'"
      variant="ghost"
      size="sm"
      :disabled="disabled || isLast"
      @click="next"
    >
      <Icon icon="lucide:chevron-right" />
    </IconButton>
  </nav>
</template>
