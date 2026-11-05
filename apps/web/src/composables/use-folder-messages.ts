import { getMailboxDb, type LocalMessage } from "@/db/mailbox-db";
import { translateApiError } from "@/i18n/api-errors";
import { ApiError } from "@/lib/api";
import { parseSearchQuery, type SearchFilter } from "@/lib/search";
import Dexie from "dexie";
import { computed, ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";

export const FOLDER_MESSAGES_PER_PAGE = 10;

function haystack(parts: string[], values: (string | null | undefined)[]): boolean {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  return parts.every((token) => text.includes(token.toLowerCase()));
}

function matchesSearch(message: LocalMessage, filter: SearchFilter): boolean {
  if (filter.general.length) {
    if (
      !haystack(filter.general, [
        message.from_name,
        message.from_address,
        ...message.to_addresses,
        message.subject,
      ])
    ) {
      return false;
    }
  }
  if (filter.from.length) {
    if (!haystack(filter.from, [message.from_name, message.from_address])) return false;
  }
  if (filter.to.length) {
    if (!haystack(filter.to, message.to_addresses)) return false;
  }
  if (filter.subject.length) {
    if (!haystack(filter.subject, [message.subject])) return false;
  }
  return true;
}

export function useFolderMessages(
  activeFolderId: Ref<string | null>,
  debouncedSearch: Ref<string>,
  mailboxId: Ref<string>,
  isMailboxOpen: () => boolean,
  perPage: number = FOLDER_MESSAGES_PER_PAGE,
) {
  const { t } = useI18n();

  const messages = ref<LocalMessage[]>([]);
  const totalMessages = ref(0);
  const page = ref(1);
  const isLoading = ref(false);
  const listError = ref("");
  const pendingIds = ref<Set<string>>(new Set());

  const showPagination = computed(() => !debouncedSearch.value && totalMessages.value > perPage);

  async function loadMessages(): Promise<void> {
    if (!activeFolderId.value || !isMailboxOpen()) return;

    isLoading.value = true;
    listError.value = "";
    const db = getMailboxDb(mailboxId.value);

    try {
      const queue = await db.sync_queue.filter((row) => row.status === "pending").toArray();
      pendingIds.value = new Set(queue.map((row) => row.message_id));

      if (debouncedSearch.value) {
        const filter = parseSearchQuery(debouncedSearch.value);
        const results = await db.messages
          .where("folder_id")
          .equals(activeFolderId.value)
          .filter((m) => matchesSearch(m, filter))
          .limit(50)
          .toArray();
        const sorted = results.sort(
          (a, b) => b.email_date - a.email_date || b.received_at - a.received_at,
        );
        messages.value = sorted;
        totalMessages.value = messages.value.length;
        return;
      }

      const folderId = activeFolderId.value;

      const offset = (page.value - 1) * perPage;
      const rows = await db.messages
        .where("[folder_id+email_date]")
        .between([folderId, Dexie.minKey], [folderId, Dexie.maxKey])
        .reverse()
        .offset(offset)
        .limit(perPage)
        .toArray();

      const sorted = rows.sort(
        (a, b) => b.email_date - a.email_date || b.received_at - a.received_at,
      );
      messages.value = sorted;
      totalMessages.value = await db.messages.where("folder_id").equals(folderId).count();
    } catch (err) {
      listError.value =
        err instanceof ApiError ? translateApiError(err) : t("inbox.errors.loadMessages");
    } finally {
      isLoading.value = false;
    }
  }

  function goNext(): void {
    if (page.value * perPage >= totalMessages.value) return;
    page.value += 1;
  }

  function goPrev(): void {
    if (page.value <= 1) return;
    page.value -= 1;
  }

  return {
    messages,
    totalMessages,
    page,
    isLoading,
    listError,
    pendingIds,
    showPagination,
    loadMessages,
    goNext,
    goPrev,
  };
}
