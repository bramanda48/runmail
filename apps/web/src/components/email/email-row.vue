<script setup lang="ts">
import { IconButton } from "@/components/ui/icon-button";
import type { LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { cn } from "@/lib/utils";
import { computed } from "vue";

interface Props {
  message: LocalMessage;
  pending?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "click"): void;
  (e: "toggle-star"): void;
  (e: "toggle-read"): void;
  (e: "move"): void;
  (e: "trash"): void;
}>();

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
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
});
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-xl border-b bg-surface p-3 text-left transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    @click="emit('click')"
  >
    <span
      class="size-2 shrink-0 rounded-full"
      :class="message.is_read ? 'bg-transparent' : 'bg-primary-foreground'"
      aria-hidden="true"
    />

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <p
          :class="
            cn(
              'truncate text-sm',
              message.is_read ? 'font-normal text-foreground' : 'font-bold text-foreground',
            )
          "
        >
          {{ sender }}
        </p>
        <Icon
          v-if="pending"
          icon="lucide:loader-circle"
          class="size-3.5 shrink-0 animate-spin text-muted-foreground"
        />
      </div>
      <p
        :class="
          cn(
            'truncate text-sm',
            message.is_read ? 'font-normal text-muted-foreground' : 'font-bold text-foreground',
          )
        "
      >
        {{ message.subject }}
      </p>
      <p class="truncate text-xs text-muted-foreground">{{ message.snippet }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <span class="hidden text-xs text-muted-foreground sm:inline">{{ displayDate }}</span>

      <div
        class="flex items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
      >
        <IconButton
          :ariaLabel="message.is_starred ? 'Hapus bintang' : 'Tandai bintang'"
          variant="ghost"
          size="sm"
          @click.stop="emit('toggle-star')"
        >
          <Icon
            icon="lucide:star"
            :class="
              cn(
                'size-4',
                message.is_starred ? 'fill-current text-warning' : 'text-muted-foreground',
              )
            "
          />
        </IconButton>

        <IconButton
          :ariaLabel="message.is_read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
          variant="ghost"
          size="sm"
          @click.stop="emit('toggle-read')"
        >
          <Icon :icon="message.is_read ? 'lucide:mail-open' : 'lucide:mail'" class="size-4" />
        </IconButton>

        <IconButton
          :ariaLabel="'Pindahkan ke folder'"
          variant="ghost"
          size="sm"
          @click.stop="emit('move')"
        >
          <Icon icon="lucide:folder-input" class="size-4" />
        </IconButton>

        <IconButton
          :ariaLabel="'Pindah ke Trash'"
          variant="ghost"
          size="sm"
          @click.stop="emit('trash')"
        >
          <Icon icon="lucide:trash" class="size-4 text-destructive" />
        </IconButton>
      </div>
    </div>
  </button>
</template>
