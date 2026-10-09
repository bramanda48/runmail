import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const verificationStatuses = ["pending_verification", "active"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const domains = sqliteTable(
  "domains",
  {
    id: text("id").primaryKey(),
    domain_name: text("domain_name").notNull(),
    verification_status: text("verification_status", {
      enum: verificationStatuses,
    })
      .notNull()
      .default("pending_verification"),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("domains_domain_name_unique").on(t.domain_name)],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
