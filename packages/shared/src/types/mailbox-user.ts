import type { Role } from "./role";

/**
 * Mirrors the `mailbox_users` D1 table for API payloads. Represents the
 * many-to-many relationship between users and mailboxes.
 */
export interface MailboxUserLink {
  id: string;
  mailbox_id: string;
  user_id: string;
  created_at: number;
}

/**
 * User row linked to a mailbox, as returned by
 * `GET /mailboxes/:mailbox_id/users`. Denormalized from the `users` table
 * so the admin manage-users dialog can render without extra lookups.
 */
export interface MailboxLinkedUser {
  user_id: string;
  username: string;
  role: Role;
  is_active: boolean;
}
