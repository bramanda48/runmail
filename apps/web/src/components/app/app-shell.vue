<script setup lang="ts">
import MobileNavDrawer from "@/components/app/MobileNavDrawer.vue";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { ref } from "vue";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();

const open = ref(false);
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
    <MobileNavDrawer v-model:open="open">
      <slot name="navigation" />
    </MobileNavDrawer>

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
