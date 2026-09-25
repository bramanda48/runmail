import type { LocalMessage } from "@/db/mailbox-db";
import type { MessageDetail } from "@/lib/api";

/**
 * Maps an API message payload to the local Dexie row shape (drops
 * server-only fields such as mailbox_id / internet_message_id /
 * raw_object_key, keeps to_addresses + folder_entered_at).
 */
export function toLocalMessage(detail: MessageDetail): LocalMessage {
  return {
    id: detail.id,
    from_name: detail.from_name,
    from_address: detail.from_address,
    to_addresses: [...detail.to_addresses],
    subject: detail.subject,
    snippet: detail.snippet,
    email_date: detail.email_date,
    received_at: detail.received_at,
    is_read: detail.is_read,
    is_starred: detail.is_starred,
    folder_id: detail.folder_id,
    folder_entered_at: detail.folder_entered_at,
    sync_version: detail.sync_version,
    updated_at: detail.updated_at,
  };
}
