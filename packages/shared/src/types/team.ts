import type { Role } from "./role";

/**
 * Mirrors the `teams` D1 table for API payloads. Teams group users so a
 * mailbox can be shared to many users at once.
 */
export interface Team {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

/**
 * User row linked to a team, as returned by
 * `GET /teams/:team_id/users`. Denormalized from the `users` table so the
 * admin teams page can render without extra lookups.
 */
export interface TeamLinkedUser {
  user_id: string;
  username: string;
  role: Role;
  is_active: boolean;
}

/**
 * Team row linked to a mailbox, as returned by
 * `GET /mailboxes/:mailbox_id/teams`.
 */
export interface MailboxLinkedTeam {
  team_id: string;
  name: string;
}
