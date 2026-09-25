<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { computed, ref } from "vue";

type State = "blocked" | "loading" | "loaded";

const state = ref<State>("blocked");

const emit = defineEmits<(e: "load") => void>();

const icon = computed(() =>
  state.value === "loading" ? "lucide:loader-circle" : "lucide:image-off",
);
const spin = computed(() => state.value === "loading");

function load() {
  state.value = "loading";
  emit("load");
}

function markLoaded() {
  state.value = "loaded";
}

defineExpose({ markLoaded });
</script>

<template>
  <div
    v-if="state !== 'loaded'"
    class="flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning/15 px-4 py-3"
  >
    <div class="flex items-center gap-3">
      <Icon :icon="icon" :class="cn('size-4 text-warning', spin && 'animate-spin')" />
      <p class="text-sm text-warning">Gambar eksternal diblokir untuk keamanan.</p>
    </div>
    <Button variant="ghost" size="sm" :disabled="state === 'loading'" @click="load">
      <Icon v-if="state === 'loading'" icon="lucide:loader-circle" class="size-4 animate-spin" />
      <span>Tampilkan gambar</span>
    </Button>
  </div>
</template>
