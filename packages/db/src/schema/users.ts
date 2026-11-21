import { relations } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { refreshTokens } from "./auth";
import { mailboxUsers } from "./mailboxes";
import { teamMembers } from "./teams";

export const userRoles = ["admin", "member"] as const;
export type UserRole = (typeof userRoles)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    password_hash: text("password_hash").notNull(),
    role: text("role", { enum: userRoles }).notNull().default("member"),
    is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
    last_login_at: integer("last_login_at"),
  },
  (t) => [uniqueIndex("users_username_unique").on(t.username)],
);

export const usersRelation = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  mailboxUsers: many(mailboxUsers),
  refreshTokens: many(refreshTokens),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
