<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/icons";
import { watch } from "vue";
import { useRoute } from "vue-router";

const props = defineProps<{
  open: boolean;
}>();

const emits = defineEmits<{
  "update:open": [value: boolean];
}>();

const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    emits("update:open", false);
  }
);

function onOpenChange(value: boolean) {
  emits("update:open", value);
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/50 lg:hidden" />
      <DialogContent
        class="fixed inset-y-0 left-0 z-50 w-64 bg-surface p-0 outline-none lg:hidden"
      >
        <IconButton
          :ariaLabel="'Tutup menu'"
          variant="ghost"
          size="sm"
          class="absolute right-2 top-2"
          @click="onOpenChange(false)"
        >
          <Icon icon="lucide:x" />
        </IconButton>
        <DialogTitle class="sr-only">Navigasi</DialogTitle>
        <DialogDescription class="sr-only">
          Menu navigasi aplikasi
        </DialogDescription>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
