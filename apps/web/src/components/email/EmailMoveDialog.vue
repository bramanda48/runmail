<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import type { LocalFolder } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  open: boolean;
  folders: LocalFolder[];
  currentFolderId?: string;
}>();

const emits = defineEmits<{
  "update:open": [value: boolean];
  "move-to-folder": [folderId: string];
}>();

const moveTargetFolderId = ref("");
const moveSubmitting = ref(false);

const folderOptions = computed(() =>
  props.folders
    .filter((f) => f.id !== props.currentFolderId)
    .map((f) => ({ value: f.id, label: f.name }))
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      moveTargetFolderId.value = "";
      moveSubmitting.value = false;
    }
  }
);

function onOpenChange(value: boolean) {
  if (!moveSubmitting.value) {
    emits("update:open", value);
  }
}

async function confirmMove() {
  if (!moveTargetFolderId.value) return;
  moveSubmitting.value = true;
  emits("move-to-folder", moveTargetFolderId.value);
}
</script>

<template>
  <DialogRoot :open="open" @update:open="onOpenChange">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Pindahkan Email</DialogTitle>
      </DialogHeader>
      <DialogDescription>
        <div class="flex flex-col gap-4 py-2">
          <Select
            v-model="moveTargetFolderId"
            label="Folder tujuan"
            id="select-move-target"
            placeholder="Pilih folder"
            :options="folderOptions"
            :disabled="moveSubmitting"
          />
        </div>
      </DialogDescription>
      <DialogFooter>
        <Button
          variant="ghost"
          :disabled="moveSubmitting"
          @click="onOpenChange(false)"
        >
          Batal
        </Button>
        <Button
          :disabled="!moveTargetFolderId || moveSubmitting"
          @click="confirmMove"
        >
          <Icon
            v-if="moveSubmitting"
            icon="lucide:loader-circle"
            class="animate-spin"
          />
          <span>Pindahkan</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </DialogRoot>
</template>
