import type { Domain } from "./domain";

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
  created_at: number;
  updated_at: number;
}

export interface MailboxWithDomain extends Mailbox {
  domain: Domain;
}
