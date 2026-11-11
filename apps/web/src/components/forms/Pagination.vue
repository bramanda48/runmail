<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

interface Props {
  page: number;
  perPage: number;
  total: number;
  knownPages?: number;
  hasMore?: boolean;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
  knownPages: 1,
  hasMore: false,
  disabled: false,
});

const emit = defineEmits<{
  (e: "prev"): void;
  (e: "next"): void;
  (e: "goto", page: number): void;
}>();

const start = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1));
const end = computed(() => Math.min(props.page * props.perPage, props.total));
const isFirst = computed(() => props.page <= 1);
const isLast = computed(() =>
  props.knownPages > 1
    ? !props.hasMore && props.page >= props.knownPages
    : props.page * props.perPage >= props.total,
);
const showNumbers = computed(() => props.knownPages > 1);

const windowPages = computed(() => {
  const total = Math.max(1, Math.floor(props.knownPages));
  const current = Math.min(Math.max(1, props.page), total);
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  let from = current - 2;
  let to = current + 2;
  if (from < 1) {
    to += 1 - from;
    from = 1;
  }
  if (to > total) {
    from -= to - total;
    to = total;
  }
  from = Math.max(1, from);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
});

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

function goto(n: number) {
  if (n !== props.page) {
    emit("goto", n);
  }
}
</script>

<template>
  <nav
    :class="cn('flex items-center gap-3', props.class)"
    :aria-label="t('inbox.pagination.label')"
  >
    <Button
      :aria-label="t('inbox.pagination.previous')"
      variant="ghost"
      size="icon"
      :disabled="disabled || isFirst"
      @click="prev"
    >
      <Icon icon="lucide:chevron-left" />
    </Button>

    <div v-if="showNumbers" class="flex items-center gap-1">
      <Button
        v-for="n in windowPages"
        :key="n"
        :aria-label="t('inbox.pagination.goTo', { page: n })"
        :aria-current="n === props.page ? 'page' : undefined"
        :variant="n === props.page ? 'secondary' : 'ghost'"
        size="sm"
        :disabled="disabled"
        @click="goto(n)"
      >
        {{ n }}
      </Button>
    </div>

    <span v-if="$slots.range" class="text-sm text-foreground">
      <slot name="range" :start="start" :end="end" :total="total">
        {{ t("inbox.pagination.range", { start, end, total }) }}
      </slot>
    </span>

    <Button
      :aria-label="t('inbox.pagination.next')"
      variant="ghost"
      size="icon"
      :disabled="disabled || isLast"
      @click="next"
    >
      <Icon icon="lucide:chevron-right" />
    </Button>
  </nav>
</template>
