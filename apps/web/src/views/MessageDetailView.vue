<script setup lang="ts">
import MailboxWorkspace from "@/components/layouts/MailboxWorkspace.vue";
import ComposeModal from "@/components/email/compose/ComposeModal.vue";
import EmailDetailBody from "@/components/email/detail/EmailDetailBody.vue";
import EmailDetailHeader from "@/components/email/detail/EmailDetailHeader.vue";
import EmailDetailToolbar from "@/components/email/detail/EmailDetailToolbar.vue";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useComposeDraft } from "@/composables/use-compose-draft";
import { useEmailBody } from "@/composables/use-email-body";
import { useMailboxWorkspace } from "@/composables/use-mailbox-workspace";
import { useMessageSiblings } from "@/composables/use-message-siblings";
import { getMailboxDb, type LocalMessage } from "@/db/mailbox-db";
import { useMailboxFoldersStore } from "@/stores/mailbox-folders";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { route, router, mailboxStore, mailboxId, resolveMailbox } = useMailboxWorkspace();
const { t } = useI18n();

/** System folder key for the inbox; system folders persist i18n keys in `name`. */
const INBOX_FOLDER_KEY = "system.inbox";

const messageId = computed(() => route.params.message_id as string);

const message = ref<LocalMessage | null>(null);
const foldersStore = useMailboxFoldersStore();
const { folders, unreadCounts } = storeToRefs(foldersStore);

const {
  bodyState,
  bodyHtml,
  bodyText,
  headers,
  attachments,
  loadFailure,
  fetchError,
  remoteImagesBlocked,
  imagesAllowed,
  loadBody,
  allowImages,
  resetBody,
} = useEmailBody(mailboxId, messageId);

const { position, total, hasOlder, hasNewer, goSibling, loadSiblings, resetSiblings } =
  useMessageSiblings(mailboxId, message, () => mailboxStore.mailboxId, router);

const { composeOpen, composeDraft, openReply, openForward, openCompose } = useComposeDraft(
  message,
  bodyText,
);

const searchQuery = ref("");

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
    foldersStore.invalidate();
    message.value.is_read = true;
  }
  await loadSiblings();
  await loadBody();
}

async function toggleRead() {
  if (!message.value) return;
  await mailboxStore.enqueue({
    message_id: message.value.id,
    mutation_type: "read",
    mutation_value: !message.value.is_read,
  });
  foldersStore.invalidate();
  back();
}

async function moveSingle(folderId: string) {
  if (!message.value) return;
  await mailboxStore.enqueue({
    message_id: message.value.id,
    mutation_type: "move",
    mutation_value: folderId,
  });
  foldersStore.invalidate();
  back();
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
  await foldersStore.load(mailboxId.value);
  await loadMessage(true);
}

onMounted(() => init());

watch(messageId, async () => {
  resetBody();
  resetSiblings();
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
