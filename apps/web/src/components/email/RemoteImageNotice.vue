<script setup lang="ts">
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/icons";
import { ref } from "vue";

type State = "blocked" | "loading" | "loaded";

const state = ref<State>("blocked");

const emit = defineEmits<(e: "load") => void>();

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
  <Alert v-if="state !== 'loaded'" class="items-center">
    <Icon icon="lucide:image-off" class="size-4" />
    <AlertDescription class="flex-1"> Gambar eksternal diblokir untuk keamanan. </AlertDescription>
    <Button
      variant="ghost"
      size="sm"
      class="shrink-0"
      :disabled="state === 'loading'"
      @click="load"
    >
      <Icon v-if="state === 'loading'" icon="lucide:loader-circle" class="animate-spin" />
      <span>Tampilkan gambar</span>
    </Button>
  </Alert>
</template>
