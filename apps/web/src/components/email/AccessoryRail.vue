<script setup lang="ts">
import { Icon } from "@/icons";

const actions = [
  { icon: "lucide:calendar-check", label: "Kalender" },
  { icon: "lucide:lightbulb", label: "Keep" },
  { icon: "lucide:check-circle-2", label: "Tasks" },
  { icon: "lucide:circle-user-round", label: "Kontak" },
];
</script>

<template>
  <aside aria-label="Aplikasi tambahan" class="flex w-[56px] flex-col items-center gap-6 py-4">
    <button
      v-for="action in actions"
      :key="action.icon"
      type="button"
      disabled
      title="Segera hadir"
      :aria-label="action.label"
      class="flex size-10 items-center justify-center rounded-full text-muted-foreground"
    >
      <Icon :icon="action.icon" class="size-5" />
    </button>
    <div aria-hidden="true" class="w-6 border-b border-border" />
    <button
      type="button"
      disabled
      title="Segera hadir"
      aria-label="Tambah aplikasi"
      class="flex size-10 items-center justify-center rounded-full text-muted-foreground"
    >
      <Icon icon="lucide:plus" class="size-5" />
    </button>
  </aside>
</template>
