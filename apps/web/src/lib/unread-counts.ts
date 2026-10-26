import type { LocalFolder, MailboxDb } from "@/db/mailbox-db";

/**
 * Unread count per folder. Callers that already hold the folder rows pass them
 * in so the folders table is not read twice.
 */
export async function computeUnreadCounts(
  db: MailboxDb,
  folders?: LocalFolder[],
): Promise<Record<string, number>> {
  const rows = folders ?? (await db.folders.toArray());
  const counts: Record<string, number> = {};
  for (const folder of rows) {
    counts[folder.id] = await db.messages
      .where("folder_id")
      .equals(folder.id)
      .and((m) => !m.is_read)
      .count();
  }
  return counts;
}
