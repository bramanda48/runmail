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

export function persistLastMailboxId(mailboxId: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (mailboxId === null) {
    localStorage.removeItem(LAST_MAILBOX_KEY);
  } else {
    localStorage.setItem(LAST_MAILBOX_KEY, mailboxId);
  }
}
