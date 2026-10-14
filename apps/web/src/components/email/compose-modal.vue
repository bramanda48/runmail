<script setup lang="ts">
import { Icon } from "@/icons";
import { shallowRef } from "vue";

const open = defineModel<boolean>("open", { default: false });

const to = shallowRef("");
const subject = shallowRef("");
const body = shallowRef("");
const minimized = shallowRef(false);

function toggleMinimized() {
  minimized.value = !minimized.value;
}

function close() {
  open.value = false;
}
</script>

<template>
  <div
    v-if="open"
    role="dialog"
    aria-label="Tulis pesan baru"
    class="flex w-140 h-145 max-h-full max-w-full flex-col overflow-hidden rounded-t-xl shadow-xs border bg-background"
  >
    <div class="flex items-center gap-2 bg-secondary px-4 py-3">
      <p class="truncate text-sm font-semibold">Pesan Baru</p>
      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          aria-label="Minimalkan"
          class="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          @click="toggleMinimized"
        >
          <Icon icon="lucide:minus" class="size-4" />
        </button>
        <button
          type="button"
          aria-label="Perbesar"
          disabled
          title="Segera hadir"
          class="flex size-8 items-center justify-center rounded-full text-muted-foreground"
        >
          <Icon icon="lucide:maximize-2" class="size-4" />
        </button>
        <button
          type="button"
          aria-label="Tutup"
          class="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
          @click="close"
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </div>
    </div>

    <div v-if="!minimized" class="flex flex-1 flex-col overflow-hidden">
      <div class="flex items-center gap-3 border-b border-border px-4 py-2">
        <label for="compose-to" class="shrink-0 text-sm text-muted-foreground">Kepada</label>
        <input
          id="compose-to"
          v-model="to"
          type="text"
          class="flex-1 truncate bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div class="flex items-center gap-3 border-b border-border px-4 py-2">
        <input
          v-model="subject"
          type="text"
          aria-label="Subjek"
          placeholder="Subjek"
          class="flex-1 truncate bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
        />
      </div>
      <textarea
        v-model="body"
        aria-label="Isi pesan"
        class="flex-1 resize-none bg-transparent p-4 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>

    <div v-if="!minimized" class="flex items-center gap-1 border-t border-border px-4 py-3">
      <button
        type="button"
        disabled
        title="Segera hadir"
        class="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
      >
        Kirim
      </button>
      <button
        type="button"
        aria-label="Format teks"
        disabled
        title="Segera hadir"
        class="flex size-9 items-center justify-center rounded-full text-muted-foreground"
      >
        <Icon icon="lucide:type" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="Lampirkan file"
        disabled
        title="Segera hadir"
        class="flex size-9 items-center justify-center rounded-full text-muted-foreground"
      >
        <Icon icon="lucide:paperclip" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="Sisipkan tautan"
        disabled
        title="Segera hadir"
        class="flex size-9 items-center justify-center rounded-full text-muted-foreground"
      >
        <Icon icon="lucide:link" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="Sisipkan emoji"
        disabled
        title="Segera hadir"
        class="flex size-9 items-center justify-center rounded-full text-muted-foreground"
      >
        <Icon icon="lucide:smile" class="size-4" />
      </button>
      <button
        type="button"
        aria-label="Buang draf"
        disabled
        title="Segera hadir"
        class="ml-auto flex size-9 items-center justify-center rounded-full text-muted-foreground"
      >
        <Icon icon="lucide:trash-2" class="size-4" />
      </button>
    </div>
  </div>
</template>
