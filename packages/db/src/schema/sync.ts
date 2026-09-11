import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { mailboxes } from "./mailboxes";

export const syncEventTypes = [
  "message_created",
  "message_updated",
  "message_moved",
  "message_deleted"
] as const;
export type SyncEventType = (typeof syncEventTypes)[number];

// sync_version is a per-mailbox monotonic sequence; the natural key is the
// mailbox_id + sync_version pair. Modeled as a composite unique index to
// yield the required UNIQUE(mailbox_id, sync_version) constraint while
// keeping sync_version a non-PK sequence column.
export const syncEvents = sqliteTable(
  "sync_events",
  {
    sync_version: integer("sync_version").notNull(),
    mailbox_id: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id),
    event_type: text("event_type", { enum: syncEventTypes }).notNull(),
    message_id: text("message_id").notNull(),
    payload: text("payload").notNull(),
    created_at: integer("created_at").notNull()
  },
  (t) => [
    uniqueIndex("sync_events_mailbox_id_sync_version_unique").on(t.mailbox_id, t.sync_version)
  ]
);

export type SyncEvent = typeof syncEvents.$inferSelect;
export type NewSyncEvent = typeof syncEvents.$inferInsert;

export const mailboxSyncCounters = sqliteTable("mailbox_sync_counters", {
  mailbox_id: text("mailbox_id")
    .primaryKey()
    .references(() => mailboxes.id),
  last_version: integer("last_version").notNull().default(0)
});

export type MailboxSyncCounter = typeof mailboxSyncCounters.$inferSelect;
