import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable(
  "domains",
  {
    id: text("id").primaryKey(),
    domain_name: text("domain_name").notNull(),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("domains_domain_name_unique").on(t.domain_name)],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
