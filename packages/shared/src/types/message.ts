/**
 * Mirrors the `messages` D1 table for API payloads, per Tech Plan section 7.1.6.
 */
export interface Message {
  id: string;
  mailbox_id: string;
  internet_message_id: string | null;
  from_name: string | null;
  from_address: string;
  subject: string;
  snippet: string;
  email_date: number;
  received_at: number;
  is_read: boolean;
  is_starred: boolean;
  folder_id: string;
  folder_entered_at: number | null;
  raw_object_key: string;
  sync_version: number;
  updated_at: number;
}
