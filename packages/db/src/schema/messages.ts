import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { folders } from "./folders";
import { mailboxes } from "./mailboxes";

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    mailbox_id: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id),
    internet_message_id: text("internet_message_id"),
    from_name: text("from_name"),
    from_address: text("from_address").notNull(),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull(),
    email_date: integer("email_date").notNull(),
    received_at: integer("received_at").notNull(),
    is_read: integer("is_read", { mode: "boolean" }).notNull().default(false),
    is_starred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
    folder_id: text("folder_id")
      .notNull()
      .references(() => folders.id),
    folder_entered_at: integer("folder_entered_at"),
    raw_object_key: text("raw_object_key").notNull(),
    sync_version: integer("sync_version").notNull(),
    updated_at: integer("updated_at").notNull()
  },
  (t) => [
    index("messages_mailbox_folder_email_date_idx").on(t.mailbox_id, t.folder_id, t.email_date),
    index("messages_mailbox_updated_at_idx").on(t.mailbox_id, t.updated_at),
    index("messages_mailbox_sync_version_idx").on(t.mailbox_id, t.sync_version)
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export const recipientTypes = ["to", "cc", "bcc"] as const;
export type RecipientType = (typeof recipientTypes)[number];

export const messageRecipients = sqliteTable(
  "message_recipients",
  {
    id: text("id").primaryKey(),
    message_id: text("message_id")
      .notNull()
      .references(() => messages.id),
    recipient_type: text("recipient_type", { enum: recipientTypes }).notNull(),
    display_name: text("display_name"),
    email_address: text("email_address").notNull()
  },
  (t) => [
    index("message_recipients_message_id_idx").on(t.message_id),
    index("message_recipients_message_id_recipient_type_idx").on(t.message_id, t.recipient_type)
  ]
);

export type MessageRecipient = typeof messageRecipients.$inferSelect;
export type NewMessageRecipient = typeof messageRecipients.$inferInsert;
