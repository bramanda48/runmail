export type RecipientType = "to" | "cc" | "bcc";

/**
 * Mirrors the `message_recipients` D1 table for API payloads.
 */
export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_type: RecipientType;
  display_name: string | null;
  email_address: string;
}
