<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { computed, ref } from "vue";

interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const emit = defineEmits<(e: "update:modelValue", value: string) => void>();

const show = ref(false);
const type = computed(() => (show.value ? "text" : "password"));
const label = computed(() => (show.value ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"));

function onInput(value: string) {
  emit("update:modelValue", value);
}

function toggle() {
  show.value = !show.value;
}
</script>

<template>
  <div :class="cn('relative', props.class)">
    <Input
      :type="type"
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="pr-10"
      @update:model-value="onInput"
    />
    <div class="absolute inset-y-0 right-0 flex items-center pr-2">
      <Button
        type="button"
        :aria-label="label"
        :aria-pressed="show"
        variant="ghost"
        size="icon"
        :disabled="disabled"
        @click="toggle"
      >
        <Icon :icon="show ? 'lucide:eye-off' : 'lucide:eye'" />
      </Button>
    </div>
  </div>
</template>
