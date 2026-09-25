import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { mailboxes } from "./mailboxes";

export const folderTypes = ["system", "custom"] as const;
export type FolderType = (typeof folderTypes)[number];

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    mailbox_id: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id),
    name: text("name").notNull(),
    folder_type: text("folder_type", { enum: folderTypes }).notNull().default("custom"),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
  },
  // Expression index enforcing case-insensitive-unique custom folder names per mailbox
  // (SQLite supports expression indexes; applies to custom folders only).
  (t) => [uniqueIndex("folders_mailbox_id_name_unique").on(t.mailbox_id, sql`lower(${t.name})`)],
);

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
