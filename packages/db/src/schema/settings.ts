import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const SETTINGS_SINGLETON_ID = 1;

export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    brand_name: text("brand_name").notNull().default("Runmail"),
    is_setup_complete: integer("is_setup_complete", { mode: "boolean" }).notNull().default(false),
    cloudflare_oauth_token: text("cloudflare_oauth_token"),
    jwt_private_key: text("jwt_private_key"),
    jwt_public_key: text("jwt_public_key"),
    updated_at: integer("updated_at").notNull(),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
