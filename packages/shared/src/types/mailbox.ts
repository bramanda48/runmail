import type { Domain } from "./domain";
import type { MailboxLinkedTeam } from "./team";

/**
 * Mirrors the `mailboxes` D1 table for API payloads. A mailbox is the tenant
 * boundary. `address` is computed from the domain and local part.
 */
export interface Mailbox {
  id: string;
  domain_id: string;
  local_part: string;
  is_active: boolean;
  address: string;
  /** Teams granting this user access to the mailbox; empty or absent = direct access only. */
  via_teams?: MailboxLinkedTeam[];
  created_at: number;
  updated_at: number;
}

export interface MailboxWithDomain extends Mailbox {
  domain: Domain;
}
