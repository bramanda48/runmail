import type { MailboxDb } from "@/db/mailbox-db";

export async function computeUnreadCounts(db: MailboxDb): Promise<Record<string, number>> {
  const folders = await db.folders.toArray();
  const counts: Record<string, number> = {};
  for (const folder of folders) {
    counts[folder.id] = await db.messages
      .where("folder_id")
      .equals(folder.id)
      .and((m) => !m.is_read)
      .count();
  }
  return counts;
}
