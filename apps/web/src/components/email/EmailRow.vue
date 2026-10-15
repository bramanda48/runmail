<script setup lang="ts">
import MoveFolderMenu from "@/components/email/MoveFolderMenu.vue";
import { Button } from "@/components/ui/button";
import type { LocalFolder, LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { computed, ref } from "vue";

interface Props {
  message: LocalMessage;
  pending?: boolean;
  selected?: boolean;
  folders?: LocalFolder[];
  currentFolderId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  pending: false,
  selected: false,
  folders: () => [],
});

const emit = defineEmits<{
  (e: "click"): void;
  (e: "toggle-star"): void;
  (e: "toggle-read"): void;
  (e: "move-to-folder", folderId: string): void;
  (e: "trash"): void;
  (e: "toggle-select"): void;
}>();
const menuOpen = ref(false);

const sender = computed(() => props.message.from_name || props.message.from_address);

const displayDate = computed(() => {
  const date = new Date(props.message.email_date);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });
});
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :class="
      cn(
        'group flex w-full hover:shadow-sm items-center gap-3 border-b border-border px-4 py-2',
        props.selected ? 'bg-accent/50' : message.is_read ? 'bg-muted/30' : 'bg-background',
      )
    "
    @click="emit('click')"
    @keydown.enter="emit('click')"
    @keydown.space.prevent="emit('click')"
  >
    <Button
      aria-label="Pilih pesan"
      :aria-pressed="selected"
      variant="ghost"
      size="icon"
      @click.stop="emit('toggle-select')"
    >
      <Icon
        :icon="selected ? 'lucide:square-check' : 'lucide:square'"
        :class="cn('size-4', selected ? 'text-primary' : 'text-muted-foreground')"
      />
    </Button>

    <Button
      :aria-label="message.is_starred ? 'Hapus bintang' : 'Tandai bintang'"
      variant="ghost"
      size="icon"
      @click.stop="emit('toggle-star')"
    >
      <Icon
        icon="lucide:star"
        :class="
          cn('size-4', message.is_starred ? 'fill-primary text-primary' : 'text-muted-foreground')
        "
      />
    </Button>

    <div class="flex w-28 shrink-0 items-center gap-1 sm:w-48">
      <span
        :class="
          cn(
            'truncate text-sm',
            message.is_read ? 'font-medium text-foreground' : 'font-bold text-foreground',
          )
        "
      >
        {{ sender }}
      </span>
      <Icon
        v-if="pending"
        icon="lucide:loader-circle"
        class="size-3.5 shrink-0 animate-spin text-muted-foreground"
      />
    </div>

    <div class="min-w-0 flex-1 truncate">
      <span
        :class="
          cn(
            'text-sm',
            message.is_read ? 'font-medium text-foreground' : 'font-bold text-foreground',
          )
        "
      >
        {{ message.subject }}
      </span>
      <span class="truncate text-sm text-muted-foreground"> - {{ message.snippet }}</span>
    </div>

    <span
      :class="
        cn(
          'hidden shrink-0 text-right text-xs sm:inline lg:group-hover:hidden',
          message.is_read ? 'font-medium text-muted-foreground' : 'font-bold text-foreground',
        )
      "
    >
      {{ displayDate }}
    </span>

    <div :class="cn('items-center gap-1', menuOpen ? 'flex' : 'hidden lg:group-hover:flex')">
      <Button
        :aria-label="message.is_read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
        variant="ghost"
        size="icon"
        @click.stop="emit('toggle-read')"
      >
        <Icon :icon="message.is_read ? 'lucide:mail-open' : 'lucide:mail'" class="size-4" />
      </Button>

      <MoveFolderMenu
        :folders="folders"
        :current-folder-id="currentFolderId"
        :open="menuOpen"
        @click.stop
        @update:open="menuOpen = $event"
        @move-to-folder="(id: string) => emit('move-to-folder', id)"
      />

      <Button aria-label="Pindah ke Trash" variant="ghost" size="icon" @click.stop="emit('trash')">
        <Icon icon="lucide:trash" class="size-4 text-destructive" />
      </Button>
    </div>
  </div>
</template>
