import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { domains } from "./domains";
import { users } from "./users";

export const mailboxes = sqliteTable(
  "mailboxes",
  {
    id: text("id").primaryKey(),
    domain_id: text("domain_id")
      .notNull()
      .references(() => domains.id),
    local_part: text("local_part").notNull(),
    is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("mailboxes_domain_id_local_part_unique").on(t.domain_id, t.local_part)],
);

export type Mailbox = typeof mailboxes.$inferSelect;
export type NewMailbox = typeof mailboxes.$inferInsert;

export const mailboxUsers = sqliteTable(
  "mailbox_users",
  {
    id: text("id").primaryKey(),
    mailbox_id: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    created_at: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("mailbox_users_mailbox_id_user_id_unique").on(t.mailbox_id, t.user_id)],
);

export type MailboxUser = typeof mailboxUsers.$inferSelect;
export type NewMailboxUser = typeof mailboxUsers.$inferInsert;
