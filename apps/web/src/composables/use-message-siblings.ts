import { getMailboxDb, type LocalMessage } from "@/db/mailbox-db";
import { computed, ref, type Ref } from "vue";
import type { Router } from "vue-router";

/**
 * Prev/next neighbors inside the current folder, newest-first
 * (same ordering as the list view).
 */
export function useMessageSiblings(
  mailboxId: Ref<string>,
  message: Ref<LocalMessage | null>,
  mailboxStoreId: () => string | null,
  router: Pick<Router, "push">,
) {
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
      direction === "older"
        ? siblingIds.value[position.value]
        : siblingIds.value[position.value - 2];
    if (!target) return;
    router.push(`/mailboxes/${mailboxId.value}/messages/${target}`);
  }

  async function loadSiblings() {
    if (!message.value || mailboxStoreId() !== mailboxId.value) return;
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

  function resetSiblings() {
    siblingIds.value = [];
  }

  return {
    siblingIds,
    position,
    total,
    hasOlder,
    hasNewer,
    goSibling,
    loadSiblings,
    resetSiblings,
  };
}
