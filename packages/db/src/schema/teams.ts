import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { mailboxes } from "./mailboxes";
import { users } from "./users";

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    created_at: integer("created_at").notNull(),
    updated_at: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("teams_name_unique").on(t.name)],
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    team_id: text("team_id")
      .notNull()
      .references(() => teams.id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    created_at: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("team_members_team_id_user_id_unique").on(t.team_id, t.user_id)],
);
export const mailboxTeams = sqliteTable(
  "mailbox_teams",
  {
    id: text("id").primaryKey(),
    mailbox_id: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id),
    team_id: text("team_id")
      .notNull()
      .references(() => teams.id),
    created_at: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("mailbox_teams_mailbox_id_team_id_unique").on(t.mailbox_id, t.team_id)],
);

export type MailboxTeam = typeof mailboxTeams.$inferSelect;
export type NewMailboxTeam = typeof mailboxTeams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
