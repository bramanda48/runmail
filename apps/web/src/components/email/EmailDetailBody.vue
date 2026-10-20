<script setup lang="ts">
import RemoteImageNotice from "@/components/email/RemoteImageNotice.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/icons";

export type EmailBodyState = "loading" | "empty" | "html" | "text" | "error" | "parse-error";

defineProps<{
  bodyState: EmailBodyState;
  bodyHtml: string;
  bodyText: string;
  error: string;
  remoteImagesBlocked: boolean;
  imagesAllowed: boolean;
  attachments: { filename?: string; mimeType?: string; size?: number }[];
}>();

const emits = defineEmits<{
  retry: [];
  "allow-images": [];
  reply: [];
  forward: [];
}>();

function formatSize(bytes?: number) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="px-4 py-6 sm:px-8">
    <div v-if="bodyState === 'loading'" class="flex flex-col gap-2">
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-full" />
      <Skeleton class="h-4 w-5/6" />
    </div>

    <template v-else-if="bodyState === 'html' || bodyState === 'text'">
      <RemoteImageNotice
        v-if="bodyState === 'html' && remoteImagesBlocked && !imagesAllowed"
        @load="emits('allow-images')"
      />

      <div
        v-if="bodyState === 'html'"
        class="prose prose-sm max-w-none text-foreground"
        v-html="bodyHtml"
      />
      <!-- Safe: HTML is sanitized via DOMPurify before rendering -->

      <pre v-else class="whitespace-pre-wrap text-sm text-foreground">{{ bodyText }}</pre>

      <div v-if="attachments.length > 0" class="mt-6 flex flex-col gap-2">
        <p class="text-sm font-medium text-foreground">Lampiran</p>
        <ul class="flex flex-col gap-1">
          <li
            v-for="(att, i) in attachments"
            :key="i"
            class="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Icon icon="lucide:paperclip" class="size-4" />
            <span>{{ att.filename || "lampiran" }}</span>
            <span v-if="att.size">({{ formatSize(att.size) }})</span>
          </li>
        </ul>
      </div>

      <div class="flex items-center gap-3 py-8">
        <Button variant="outline" class="rounded-full px-6 shadow-xs" @click="emits('reply')">
          <Icon icon="lucide:reply" />
          <span>Balas</span>
        </Button>
        <Button variant="outline" class="rounded-full px-6 shadow-xs" @click="emits('forward')">
          <Icon icon="lucide:forward" />
          <span>Teruskan</span>
        </Button>
      </div>
    </template>

    <div v-else-if="bodyState === 'empty'" class="py-8 text-center text-sm text-muted-foreground">
      Email ini tidak memiliki konten.
    </div>

    <Alert v-else-if="bodyState === 'parse-error'">
      Email tidak dapat ditampilkan. Anda dapat mencoba memuat ulang.
      <Button variant="ghost" size="sm" class="ml-2" @click="emits('retry')">Coba Lagi</Button>
    </Alert>

    <Alert v-else-if="bodyState === 'error'" variant="destructive">
      {{ error }}
      <Button variant="ghost" size="sm" class="ml-2" @click="emits('retry')">Coba Lagi</Button>
    </Alert>
  </div>
</template>
