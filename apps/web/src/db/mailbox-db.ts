import type { FolderType } from "@runmail/shared";
import Dexie, { type Table } from "dexie";
import { clearMailboxRawCache } from "@/lib/raw-cache";

export const DB_NAME_PREFIX = "runmail-mailbox-";

/** One Dexie DB per mailbox (TECH_PLAN §7.2). Rulesets are NOT stored locally. */
export interface LocalMessage {
  id: string;
  from_name: string | null;
  from_address: string;
  to_addresses: string[];
  subject: string;
  snippet: string;
  email_date: number;
  received_at: number;
  is_read: boolean;
  is_starred: boolean;
  folder_id: string;
  folder_entered_at: number | null;
  sync_version: number;
  updated_at: number;
}

export interface LocalFolder {
  id: string;
  name: string;
  folder_type: FolderType;
  updated_at: number;
}

export interface SyncStateRow {
  id: "state";
  last_sync_version: number;
  last_sync_timestamp: number;
  latest_message_id: string | null;
  last_full_sync_at: number | null;
  updated_at: number;
}

export type QueueStatus = "pending" | "failed";
export type QueueMutationType = "read" | "star" | "move";

export interface QueueItem {
  /** Local auto-increment PK — NOT the API idempotency key. */
  id?: number;
  message_id: string;
  mutation_type: QueueMutationType;
  mutation_value: boolean | string;
  created_at: number;
  attempt_count: number;
  last_attempt_at: number | null;
  status: QueueStatus;
}

export class MailboxDb extends Dexie {
  messages!: Table<LocalMessage, string>;
  folders!: Table<LocalFolder, string>;
  sync_state!: Table<SyncStateRow, string>;
  sync_queue!: Table<QueueItem, number>;

  constructor(mailboxId: string) {
    super(`${DB_NAME_PREFIX}${mailboxId}`);
    this.version(1).stores({
      messages: "&id, folder_id, email_date, [folder_id+email_date], sync_version, updated_at",
      folders: "&id, folder_type",
      sync_state: "id",
      sync_queue: "++id"
    });
  }
}

const instances = new Map<string, MailboxDb>();

/**
 * Registry of known per-mailbox DB names (Safari <16.4 fallback: no
 * `indexedDB.databases()`, so `wipeLocalData` cannot enumerate DBs).
 */
const KNOWN_DBS_KEY = "runmail-known-mailbox-dbs";

export function readKnownMailboxDbNames(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KNOWN_DBS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((name): name is string => typeof name === "string");
  } catch {
    return [];
  }
}

function registerMailboxDbName(name: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const known = readKnownMailboxDbNames();
    if (!known.includes(name)) {
      known.push(name);
      localStorage.setItem(KNOWN_DBS_KEY, JSON.stringify(known));
    }
  } catch {
    // Best-effort: registry must never break opening a mailbox DB.
  }
}

export function clearKnownMailboxDbNames(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KNOWN_DBS_KEY);
  } catch {
    // Best-effort.
  }
}

/** Cached open instance per mailbox (used by the mailbox store + sync engine). */
export function getMailboxDb(mailboxId: string): MailboxDb {
  let db = instances.get(mailboxId);
  if (!db) {
    db = new MailboxDb(mailboxId);
    instances.set(mailboxId, db);
    registerMailboxDbName(`${DB_NAME_PREFIX}${mailboxId}`);
  }
  return db;
}

/** Alias kept for the specified factory name. */
export function openMailboxDb(mailboxId: string): MailboxDb {
  return getMailboxDb(mailboxId);
}

export function closeMailboxDb(mailboxId: string): void {
  const db = instances.get(mailboxId);
  if (db) {
    db.close();
    instances.delete(mailboxId);
  }
}

export function closeAllMailboxDbs(): void {
  for (const mailboxId of instances.keys()) {
    closeMailboxDb(mailboxId);
  }
}

export async function deleteMailboxDb(mailboxId: string): Promise<void> {
  closeMailboxDb(mailboxId);
  await Dexie.delete(`${DB_NAME_PREFIX}${mailboxId}`);
  try {
    await clearMailboxRawCache(mailboxId);
  } catch {
    // Best-effort: raw eviction must not fail the DB delete.
  }
}
