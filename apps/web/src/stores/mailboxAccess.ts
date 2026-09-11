import type { Mailbox } from "@runmail/shared";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { ApiError, getMailbox } from "@/lib/api";

export type MailboxAccessVerdict = "ok" | "inactive" | "forbidden" | "not_found";

/**
 * Mailbox-scope access cache for the router guard. Positive detail fetches
 * are cached per mailbox so repeated navigation is cheap; the resolved
 * mailbox is also kept as runtime context (`current`).
 */
export const useMailboxAccessStore = defineStore("mailboxAccess", () => {
  const accessible = ref(new Map<string, { is_active: boolean }>());
  const current = ref<Mailbox | null>(null);

  async function ensureAccessible(mailboxId: string): Promise<MailboxAccessVerdict> {
    const cached = accessible.value.get(mailboxId);
    if (cached) {
      return cached.is_active ? "ok" : "inactive";
    }
    try {
      const { mailbox } = await getMailbox(mailboxId);
      accessible.value.set(mailboxId, { is_active: mailbox.is_active });
      return mailbox.is_active ? "ok" : "inactive";
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) return "not_found";
        if (err.status === 403) return "forbidden";
      }
      // Transient failure (network/5xx/401): allow navigation optimistically
      // and do NOT cache — the screen's own data loading surfaces the error.
      return "ok";
    }
  }

  function setCurrent(mailbox: Mailbox | null): void {
    current.value = mailbox;
  }

  const currentMailboxId = computed(() => current.value?.id ?? null);

  return {
    accessible,
    current,
    ensureAccessible,
    setCurrent,
    currentMailboxId
  };
});
