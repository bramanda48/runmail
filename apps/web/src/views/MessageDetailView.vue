<script setup lang="ts">
import MailboxWorkspace from "@/components/app/MailboxWorkspace.vue";
import ComposeModal, { type ComposeDraft } from "@/components/email/ComposeModal.vue";
import EmailDetailBody, { type EmailBodyState } from "@/components/email/EmailDetailBody.vue";
import EmailDetailHeader from "@/components/email/EmailDetailHeader.vue";
import EmailDetailToolbar from "@/components/email/EmailDetailToolbar.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { getMailboxDb, type LocalFolder, type LocalMessage } from "@/db/mailbox-db";
import { translateApiError } from "@/i18n/api-errors";
import { ApiError, fetchRawEmail } from "@/lib/api";
import { getCachedRaw, putCachedRaw } from "@/lib/raw-cache";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { computeUnreadCounts } from "@/lib/unread-counts";
import PostalMime from "postal-mime";
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";

const { route, router, mailboxStore, mailboxId, resolveMailbox } = useMailboxWorkspace();
const { t } = useI18n();

/** System folder key for the inbox; system folders persist i18n keys in `name`. */
const INBOX_FOLDER_KEY = "system.inbox";

const messageId = computed(() => route.params.message_id as string);

const message = ref<LocalMessage | null>(null);
const folders = ref<LocalFolder[]>([]);
const unreadCounts = ref<Record<string, number>>({});

const bodyState = ref<EmailBodyState>("loading");
const bodyHtml = ref("");
const rawHtml = ref("");
const bodyText = ref("");
const headers = ref<{ key: string; value: string }[]>([]);
const attachments = ref<{ filename?: string; mimeType?: string; size?: number }[]>([]);

type LoadFailure = { kind: "not-found" } | { kind: "api"; error: ApiError };

const loadFailure = ref<LoadFailure | null>(null);
const fetchError = computed(() => {
  const failure = loadFailure.value;
  if (!failure) return "";
  return failure.kind === "not-found" ? t("message.notFound") : translateApiError(failure.error);
});

const remoteImagesBlocked = ref(false);
const imagesAllowed = ref(false);

const composeOpen = shallowRef(false);
const composeDraft = ref<ComposeDraft | null>(null);

const searchQuery = ref("");

// Prev/next neighbors inside the current folder, newest-first.
const siblingIds = ref<string[]>([]);

const position = computed(() => {
  if (!message.value) return null;
  const idx = siblingIds.value.indexOf(message.value.id);
  return idx === -1 ? null : idx + 1;
});
const total = computed(() => siblingIds.value.length);
const hasOlder = computed(() => position.value !== null && position.value < total.value);
const hasNewer = computed(() => position.value !== null && position.value > 1);

function goSibling(direction: "older" | "newer") {
  if (position.value === null) return;
  const target =
    direction === "older" ? siblingIds.value[position.value] : siblingIds.value[position.value - 2];
  if (!target) return;
  router.push(`/mailboxes/${mailboxId.value}/messages/${target}`);
}

async function loadSiblings() {
  if (!message.value || mailboxStore.mailboxId !== mailboxId.value) return;
  try {
    const db = getMailboxDb(mailboxId.value);
    // Newest-first, same ordering as the list view.
    const all = await db.messages.where("folder_id").equals(message.value.folder_id).toArray();
    all.sort((a, b) => b.email_date - a.email_date || b.received_at - a.received_at);
    siblingIds.value = all.map((m) => m.id);
  } catch {
    siblingIds.value = message.value ? [message.value.id] : [];
  }
}

function sanitizeWithImageBlock(html: string) {
  const result = sanitizeEmailHtml(html, { allowRemoteContent: false });
  remoteImagesBlocked.value = result.blocked;
  return result.html;
}

function sanitizeWithoutImageBlock(html: string) {
  return sanitizeEmailHtml(html, { allowRemoteContent: true }).html;
}

async function loadMessage(autoRead = false) {
  const db = getMailboxDb(mailboxId.value);
  const row = await db.messages.get(messageId.value);
  if (!row) {
    bodyState.value = "error";
    loadFailure.value = { kind: "not-found" };
    return;
  }
  message.value = row;
  if (autoRead && !row.is_read) {
    await mailboxStore.enqueue({
      message_id: row.id,
      mutation_type: "read",
      mutation_value: true,
    });
    message.value.is_read = true;
  }
  await loadSiblings();
  await loadBody();
}

async function loadBody() {
  bodyState.value = "loading";
  loadFailure.value = null;
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
    headers.value = parsed.headers ?? [];
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
        size,
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
      loadFailure.value = { kind: "api", error: err };
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

async function loadFolders() {
  const db = getMailboxDb(mailboxId.value);
  folders.value = await db.folders.toArray();
  unreadCounts.value = await computeUnreadCounts(db);
}

async function toggleRead() {
  if (!message.value) return;
  await mailboxStore.enqueue({
    message_id: message.value.id,
    mutation_type: "read",
    mutation_value: !message.value.is_read,
  });
  back();
}

async function moveSingle(folderId: string) {
  if (!message.value) return;
  await mailboxStore.enqueue({
    message_id: message.value.id,
    mutation_type: "move",
    mutation_value: folderId,
  });
  back();
}

function quoteBody(): string {
  return bodyText.value
    ? `\n\n---\n${bodyText.value}`
    : `\n\n---\n${t("message.quote.htmlOnly")}`;
}

function openReply() {
  if (!message.value) return;
  const prefix = t("message.subjectPrefix.reply");
  const subject = message.value.subject.startsWith(prefix)
    ? message.value.subject
    : `${prefix} ${message.value.subject}`;
  composeDraft.value = {
    to: message.value.from_address,
    subject,
    body: quoteBody(),
    title: t("message.reply"),
  };
  composeOpen.value = true;
}

function openForward() {
  if (!message.value) return;
  const prefix = t("message.subjectPrefix.forward");
  const subject = message.value.subject.startsWith(prefix)
    ? message.value.subject
    : `${prefix} ${message.value.subject}`;
  composeDraft.value = {
    to: "",
    subject,
    body: quoteBody(),
    title: t("message.forward"),
  };
  composeOpen.value = true;
}

function openCompose() {
  composeDraft.value = null;
  composeOpen.value = true;
}

function onSearch(value: string) {
  const folder = message.value
    ? folders.value.find((f) => f.id === message.value?.folder_id)
    : undefined;
  const base =
    folder?.folder_type === "system" && folder.name.toLowerCase() === INBOX_FOLDER_KEY
      ? `/mailboxes/${mailboxId.value}/inbox`
      : folder
        ? `/mailboxes/${mailboxId.value}/folders/${folder.id}`
        : `/mailboxes/${mailboxId.value}/inbox`;
  router.push({ path: base, query: value ? { q: value } : {} });
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

async function init() {
  await resolveMailbox();
  if (mailboxStore.mailboxId !== mailboxId.value) return;
  await loadFolders();
  await loadMessage(true);
}

onMounted(() => init());

watch(messageId, async () => {
  imagesAllowed.value = false;
  remoteImagesBlocked.value = false;
  siblingIds.value = [];
  headers.value = [];
  await loadMessage(true);
});

watch(mailboxId, () => init());
</script>

<template>
  <MailboxWorkspace
    v-model:search-query="searchQuery"
    :mailbox-id="mailboxId"
    :folders="folders"
    :unread-counts="unreadCounts"
    :live-search="false"
    @search="onSearch"
    @compose="openCompose"
  >
    <h1 class="sr-only">
      {{ message?.subject || (message ? t("message.noSubject") : t("message.screenTitle")) }}
    </h1>

    <EmailDetailToolbar
      v-if="message"
      :folders="folders"
      :current-folder-id="message.folder_id"
      :is-read="message.is_read"
      :position="position"
      :total="total"
      :has-older="hasOlder"
      :has-newer="hasNewer"
      @back="back"
      @toggle-read="toggleRead"
      @move-to="moveSingle"
      @older="goSibling('older')"
      @newer="goSibling('newer')"
    />

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="!message && (bodyState === 'loading' || bodyState === 'error')"
        class="flex flex-col gap-4 px-4 pt-8 sm:px-8"
      >
        <template v-if="bodyState === 'loading'">
          <Skeleton class="h-8 w-2/3" />
          <Skeleton class="h-4 w-1/3" />
          <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-full" />
            <Skeleton class="h-4 w-5/6" />
          </div>
        </template>
        <Alert v-else variant="destructive">
          {{ fetchError }}
          <Button variant="ghost" size="sm" class="ml-2" @click="loadMessage(false)">
            {{ t("common.actions.retry") }}
          </Button>
        </Alert>
      </div>

      <template v-else-if="message">
        <EmailDetailHeader :message="message" :headers="headers" @reply="openReply" />

        <EmailDetailBody
          :body-state="bodyState"
          :body-html="bodyHtml"
          :body-text="bodyText"
          :error="fetchError"
          :remote-images-blocked="remoteImagesBlocked"
          :images-allowed="imagesAllowed"
          :attachments="attachments"
          @retry="bodyState === 'parse-error' ? loadBody() : loadMessage(false)"
          @allow-images="allowImages"
          @reply="openReply"
          @forward="openForward"
        />
      </template>
    </div>

    <template #overlays>
      <div class="absolute bottom-0 right-20 z-50">
        <ComposeModal v-model:open="composeOpen" :draft="composeDraft" />
      </div>
    </template>
  </MailboxWorkspace>
</template>
