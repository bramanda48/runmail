<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";

interface Props {
  page: number;
  perPage: number;
  total: number;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
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
  <nav :class="cn('flex items-center gap-3', props.class)" aria-label="Navigasi halaman">
    <Button
      aria-label="Halaman sebelumnya"
      variant="ghost"
      size="icon"
      :disabled="disabled || isFirst"
      @click="prev"
    >
      <Icon icon="lucide:chevron-left" />
    </Button>

    <span class="text-sm text-foreground">
      <slot name="range" :start="start" :end="end" :total="total">
        {{ start }}–{{ end }} dari {{ total }}
      </slot>
    </span>

    <Button
      aria-label="Halaman berikutnya"
      variant="ghost"
      size="icon"
      :disabled="disabled || isLast"
      @click="next"
    >
      <Icon icon="lucide:chevron-right" />
    </Button>
  </nav>
</template>
