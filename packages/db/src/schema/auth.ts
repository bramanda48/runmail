import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token_hash: text("token_hash").notNull(),
    expires_at: integer("expires_at").notNull(),
    revoked_at: integer("revoked_at"),
    created_at: integer("created_at").notNull(),
  },
  (t) => [
    index("refresh_tokens_token_hash_idx").on(t.token_hash),
    index("refresh_tokens_user_id_idx").on(t.user_id),
  ],
);

export const refreshTokensRelation = relations(refreshTokens, ({ one }) => ({
  users: one(users, {
    fields: [refreshTokens.user_id],
    references: [users.id],
  }),
}));

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
