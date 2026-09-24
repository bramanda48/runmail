<script setup lang="ts">
import PostalMime from "postal-mime";
import { computed, onMounted, ref, watch } from "vue";
import AppShell from "@/components/app/app-shell.vue";
import FolderNavigation from "@/components/app/folder-navigation.vue";
import MailboxSwitcher from "@/components/app/mailbox-switcher.vue";
import SyncIndicator from "@/components/app/sync-indicator.vue";
import RemoteImageNotice from "@/components/email/remote-image-notice.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxWorkspace } from "@/composables/useMailboxWorkspace";
import { getMailboxDb, type LocalFolder, type LocalMessage } from "@/db/mailbox-db";
import { Icon } from "@/icons";
import { ApiError, fetchRawEmail, permanentDeleteMessage } from "@/lib/api";
import { deleteCachedRaw, getCachedRaw, putCachedRaw } from "@/lib/raw-cache";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

const { route, router, mailboxStore, mailboxId } = useMailboxWorkspace();

const messageId = computed(() => route.params.message_id as string);

const message = ref<LocalMessage | null>(null);
const folders = ref<LocalFolder[]>([]);
const unreadCounts = ref<Record<string, number>>({});

const bodyState = ref<"loading" | "empty" | "html" | "text" | "error" | "parse-error">("loading");
const bodyHtml = ref("");
const rawHtml = ref("");
const bodyText = ref("");
const attachments = ref<{ filename?: string; mimeType?: string; size?: number }[]>([]);
const fetchError = ref("");
const remoteImagesBlocked = ref(false);
const imagesAllowed = ref(false);

const deleteOpen = ref(false);
const isDeleting = ref(false);

const moveOpen = ref(false);
const moveTargetFolderId = ref("");
const moveSubmitting = ref(false);

const folderOptions = computed(() => folders.value.map((f) => ({ value: f.id, label: f.name })));
const isTrash = computed(
  () => folders.value.find((f) => f.id === message.value?.folder_id)?.name.toLowerCase() === "trash"
);

function formatDate(ts: number) {
  return new Date(ts).toLocaleString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatSize(bytes?: number) {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadFolders() {
  const db = getMailboxDb(mailboxId.value);
  folders.value = await db.folders.toArray();
  const counts: Record<string, number> = {};
  for (const folder of folders.value) {
    counts[folder.id] = await db.messages
      .where("folder_id")
      .equals(folder.id)
      .and((m) => !m.is_read)
      .count();
  }
  unreadCounts.value = counts;
}

async function loadMessage(autoRead = false) {
  const db = getMailboxDb(mailboxId.value);
  const row = await db.messages.get(messageId.value);
  if (!row) {
    bodyState.value = "error";
    fetchError.value = "Email tidak ditemukan di perangkat ini.";
    return;
  }
  message.value = row;
  if (autoRead && !row.is_read) {
    await mailboxStore.enqueue({
      message_id: row.id,
      mutation_type: "read",
      mutation_value: true
    });
    message.value.is_read = true;
  }
  await loadBody();
}

function sanitizeWithImageBlock(html: string) {
  const result = sanitizeEmailHtml(html, { allowRemoteContent: false });
  remoteImagesBlocked.value = result.blocked;
  return result.html;
}

function sanitizeWithoutImageBlock(html: string) {
  return sanitizeEmailHtml(html, { allowRemoteContent: true }).html;
}

async function loadBody() {
  bodyState.value = "loading";
  fetchError.value = "";
  try {
    const cached = await getCachedRaw(mailboxId.value, messageId.value);
    let blob: Blob;
    if (cached) {
      blob = await cached.blob();
    } else {
      blob = await fetchRawEmail(mailboxId.value, messageId.value);
      await putCachedRaw(mailboxId.value, messageId.value, blob);
    }
    const parsed = await PostalMime.parse(await blob.arrayBuffer());
    attachments.value = (parsed.attachments || []).map((a) => {
      const content = a.content;
      let size: number | undefined;
      if (content instanceof ArrayBuffer) {
        size = content.byteLength;
      } else if (content instanceof Uint8Array) {
        size = content.byteLength;
      } else if (typeof content === "string") {
        size = new Blob([content]).size;
      }
      return {
        filename: a.filename ?? undefined,
        mimeType: a.mimeType ?? undefined,
        size
      };
    });

    if (parsed.html) {
      rawHtml.value = parsed.html;
      bodyHtml.value = sanitizeWithImageBlock(parsed.html);
      bodyState.value = "html";
    } else if (parsed.text) {
      bodyText.value = parsed.text;
      bodyState.value = "text";
    } else {
      bodyState.value = "empty";
    }
  } catch (err) {
    if (err instanceof ApiError) {
      bodyState.value = "error";
      fetchError.value = err.message;
    } else {
      bodyState.value = "parse-error";
    }
  }
}

function allowImages() {
  if (!rawHtml.value) return;
  bodyHtml.value = sanitizeWithoutImageBlock(rawHtml.value);
  remoteImagesBlocked.value = false;
  imagesAllowed.value = true;
}

async function enqueue(mutation: {
  message_id: string;
  mutation_type: "read" | "star" | "move";
  mutation_value: boolean | string;
}) {
  await mailboxStore.enqueue(mutation);
  await loadMessage(false);
  await loadFolders();
}

function toggleStar() {
  if (!message.value) return;
  enqueue({
    message_id: message.value.id,
    mutation_type: "star",
    mutation_value: !message.value.is_starred
  });
}

function toggleRead() {
  if (!message.value) return;
  enqueue({
    message_id: message.value.id,
    mutation_type: "read",
    mutation_value: !message.value.is_read
  });
}

function openMove() {
  moveTargetFolderId.value = "";
  moveOpen.value = true;
}

async function confirmMove() {
  if (!message.value || !moveTargetFolderId.value) return;
  moveSubmitting.value = true;
  await enqueue({
    message_id: message.value.id,
    mutation_type: "move",
    mutation_value: moveTargetFolderId.value
  });
  moveSubmitting.value = false;
  moveOpen.value = false;
}

async function confirmDelete() {
  if (!message.value) return;
  isDeleting.value = true;
  try {
    await permanentDeleteMessage(mailboxId.value, message.value.id);
    await deleteCachedRaw(mailboxId.value, message.value.id);
    await getMailboxDb(mailboxId.value).messages.delete(messageId.value);
    router.back();
  } catch (err) {
    isDeleting.value = false;
    fetchError.value = err instanceof ApiError ? err.message : "Gagal menghapus email.";
  }
}

function back() {
  if (window.history.length > 1) {
    router.back();
  } else if (message.value) {
    router.push(`/mailboxes/${mailboxId.value}/folders/${message.value.folder_id}`);
  } else {
    router.push(`/mailboxes/${mailboxId.value}/inbox`);
  }
}

onMounted(async () => {
  await loadFolders();
  await loadMessage(true);
});

watch(messageId, async () => {
  imagesAllowed.value = false;
  remoteImagesBlocked.value = false;
  await loadMessage(true);
});
</script>

<template>
  <AppShell>
    <template #navigation>
      <div class="flex h-full flex-col">
        <FolderNavigation
          :mailbox-id="mailboxId"
          :folders="folders"
          :unread-counts="unreadCounts"
        />
      </div>
    </template>

    <template #topbar>
      <div class="flex items-center gap-3">
        <IconButton :ariaLabel="'Kembali'" variant="ghost" size="sm" @click="back">
          <Icon icon="lucide:arrow-left" />
        </IconButton>
        <MailboxSwitcher />
        <SyncIndicator
          :status="mailboxStore.syncStatus"
          :pending-count="mailboxStore.pendingCount"
        />
      </div>
    </template>

    <main class="flex flex-1 flex-col p-4 lg:p-8">
      <div v-if="!message && bodyState === 'loading'" class="flex flex-col gap-4">
        <Skeleton shape="detail" />
      </div>

      <Alert v-else-if="bodyState === 'error'" variant="error">
        {{ fetchError }}
        <Button variant="ghost" size="sm" class="ml-2" @click="loadMessage(false)">Coba Lagi</Button>
      </Alert>

      <div v-else-if="message" class="mx-auto w-full max-w-4xl flex flex-col gap-4">
        <!-- Header -->
        <div class="rounded-2xl border bg-surface p-4 lg:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h1 class="text-xl font-semibold text-foreground lg:text-2xl">
                {{ message.subject || "(Tanpa subjek)" }}
              </h1>
              <div class="mt-2 text-sm text-foreground">
                <span class="font-medium">{{ message.from_name || message.from_address }}</span>
                <span class="text-muted-foreground">&lt;{{ message.from_address }}&gt;</span>
              </div>
              <div class="text-sm text-muted-foreground">
                Kepada: {{ message.to_addresses.join(", ") }}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                {{ formatDate(message.email_date) }}
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1">
              <IconButton
                :ariaLabel="message.is_starred ? 'Hapus bintang' : 'Tandai bintang'"
                variant="ghost"
                size="sm"
                @click="toggleStar"
              >
                <Icon
                  icon="lucide:star"
                  :class="
                    cn(
                      'size-5',
                      message.is_starred ? 'fill-current text-warning' : 'text-muted-foreground',
                    )
                  "
                />
              </IconButton>

              <IconButton
                :ariaLabel="message.is_read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'"
                variant="ghost"
                size="sm"
                @click="toggleRead"
              >
                <Icon :icon="message.is_read ? 'lucide:mail-open' : 'lucide:mail'" class="size-5" />
              </IconButton>

              <IconButton
                :ariaLabel="'Pindahkan ke folder'"
                variant="ghost"
                size="sm"
                @click="openMove"
              >
                <Icon icon="lucide:folder-input" class="size-5" />
              </IconButton>

              <IconButton
                v-if="isTrash"
                :ariaLabel="'Hapus permanen'"
                variant="ghost"
                size="sm"
                @click="deleteOpen = true"
              >
                <Icon icon="lucide:trash-2" class="size-5 text-destructive" />
              </IconButton>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="rounded-2xl border bg-surface p-4 lg:p-6">
          <div v-if="bodyState === 'loading'" class="flex flex-col gap-3">
            <Skeleton shape="block" />
          </div>

          <RemoteImageNotice
            v-if="bodyState === 'html' && remoteImagesBlocked && !imagesAllowed"
            @load="allowImages"
          />

          <div
            v-if="bodyState === 'html'"
            class="prose prose-sm max-w-none text-foreground"
            v-html="bodyHtml"
          />

          <pre
            v-else-if="bodyState === 'text'"
            class="whitespace-pre-wrap text-sm text-foreground"
            >{{ bodyText }}</pre
          >

          <div v-else-if="bodyState === 'empty'" class="py-8 text-center text-sm text-muted-foreground">
            Email ini tidak memiliki konten.
          </div>

          <Alert v-else-if="bodyState === 'parse-error'" variant="warning">
            Email tidak dapat ditampilkan. Anda dapat mencoba memuat ulang.
            <Button variant="ghost" size="sm" class="ml-2" @click="loadBody">Coba Lagi</Button>
          </Alert>

          <!-- Attachments -->
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
        </div>
      </div>

      <!-- Move dialog -->
      <DialogRoot v-model:open="moveOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pindahkan Email</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="ghost" :disabled="moveSubmitting" @click="moveOpen = false">
              Batal
            </Button>
            <Button
              :disabled="!moveTargetFolderId || moveSubmitting"
              @click="confirmMove"
            >
              <Icon v-if="moveSubmitting" icon="lucide:loader-circle" class="animate-spin" />
              <span>Pindahkan</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>

      <!-- Permanent delete dialog -->
      <DialogRoot v-model:open="deleteOpen">
        <DialogContent variant="destructive" size="sm">
          <DialogHeader>
            <DialogTitle>Hapus Permanen</DialogTitle>
            <DialogDescription>
              Email tidak dapat dikembalikan. Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" @click="deleteOpen = false">Batal</Button>
            <Button variant="destructive" :disabled="isDeleting" @click="confirmDelete">
              <Icon v-if="isDeleting" icon="lucide:loader-circle" class="animate-spin" />
              <span>Hapus</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </main>
  </AppShell>
</template>
