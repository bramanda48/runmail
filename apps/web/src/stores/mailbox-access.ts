import { ApiError, getMailbox } from "@/lib/api";
import type { Mailbox } from "@runmail/shared";
import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";

export type MailboxAccessVerdict = "ok" | "inactive" | "forbidden" | "not_found";

const LAST_MAILBOX_KEY = "runmail_last_mailbox_id";

export function getLastMailboxId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_MAILBOX_KEY);
}

export function clearLastMailboxId(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(LAST_MAILBOX_KEY);
  } catch {
    // Best-effort: clearing the registry must never break session teardown.
  }
}

function persistLastMailboxId(mailboxId: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (mailboxId === null) {
    localStorage.removeItem(LAST_MAILBOX_KEY);
  } else {
    localStorage.setItem(LAST_MAILBOX_KEY, mailboxId);
  }
}

/**
 * Mailbox-scope access cache for the router guard. Positive detail fetches
 * are cached per mailbox so repeated navigation is cheap; the resolved
 * mailbox is also kept as runtime context (`current`).
 */
export const useMailboxAccessStore = defineStore("mailboxAccess", () => {
  const accessible = reactive(new Map<string, { is_active: boolean }>());
  const current = ref<Mailbox | null>(null);

  async function ensureAccessible(mailboxId: string): Promise<MailboxAccessVerdict> {
    const cached = accessible.get(mailboxId);
    if (cached) {
      return cached.is_active ? "ok" : "inactive";
    }
    try {
      const { mailbox } = await getMailbox(mailboxId);
      accessible.set(mailboxId, { is_active: mailbox.is_active });
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
    persistLastMailboxId(mailbox?.id ?? null);
  }

  const currentMailboxId = computed(() => current.value?.id ?? null);

  return {
    accessible,
    current,
    ensureAccessible,
    setCurrent,
    currentMailboxId,
  };
});
