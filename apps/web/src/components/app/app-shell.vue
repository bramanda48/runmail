<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from "reka-ui";
import type { HTMLAttributes } from "vue";
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const open = ref(false);
const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    open.value = false;
  }
);
</script>

<template>
  <div class="flex min-h-screen bg-background">
    <!-- Desktop sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-surface lg:flex"
    >
      <slot name="navigation" />
    </aside>

    <!-- Mobile drawer -->
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay
          class="fixed inset-0 z-40 bg-black/50 lg:hidden"
          @click="open = false"
        />
        <DialogContent
          class="fixed inset-y-0 left-0 z-50 w-64 bg-surface p-0 outline-none lg:hidden"
        >
          <IconButton
            :ariaLabel="'Tutup menu'"
            variant="ghost"
            size="sm"
            class="absolute right-2 top-2"
            @click="open = false"
          >
            <Icon icon="lucide:x" />
          </IconButton>
          <DialogTitle class="sr-only">Navigasi</DialogTitle>
          <DialogDescription class="sr-only">
            Menu navigasi aplikasi
          </DialogDescription>
          <slot name="navigation" />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <div class="flex min-h-screen flex-1 flex-col lg:ml-64">
      <header
        class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-surface px-4 lg:px-8"
      >
        <IconButton
          :ariaLabel="'Buka menu'"
          variant="ghost"
          size="sm"
          class="lg:hidden"
          @click="open = true"
        >
          <Icon icon="lucide:menu" />
        </IconButton>
        <slot name="topbar" />
      </header>

      <main
        :class="
          cn('flex-1 overflow-y-auto bg-background p-4 lg:p-8', props.class)
        "
      >
        <slot />
      </main>
    </div>
  </div>
</template>
