import { domains, folders, mailboxes, mailboxUsers, users } from "@runmail/db";
import type { Mailbox, MailboxLinkedUser, PageMeta } from "@runmail/shared";
import { buildIdCursor, buildPageMeta, SYSTEM_FOLDER_NAMES } from "@runmail/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import { isUniqueViolation } from "../../lib/sqlite";

export type MailboxErrorCode =
  | "DOMAIN_NOT_ACTIVE"
  | "MAILBOX_ADDRESS_ALREADY_EXISTS"
  | "NOT_FOUND"
  | "ALREADY_LINKED";

export type MailboxError = { error: MailboxErrorCode };

type MailboxRow = typeof mailboxes.$inferSelect & { domain_name: string };

function toMailbox(row: MailboxRow): Mailbox {
  return {
    id: row.id,
    domain_id: row.domain_id,
    local_part: row.local_part,
    is_active: row.is_active,
    address: `${row.local_part}@${row.domain_name}`,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listMailboxesForUser(
  c: AppContext,
  userId: string,
  limit: number,
  cursorId: string | undefined
): Promise<{ mailboxes: Mailbox[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db
    .select({
      id: mailboxes.id,
      domain_id: mailboxes.domain_id,
      local_part: mailboxes.local_part,
      domain_name: domains.domain_name,
      is_active: mailboxes.is_active,
      created_at: mailboxes.created_at,
      updated_at: mailboxes.updated_at
    })
    .from(mailboxUsers)
    .innerJoin(mailboxes, eq(mailboxUsers.mailbox_id, mailboxes.id))
    .innerJoin(domains, eq(mailboxes.domain_id, domains.id))
    .where(eq(mailboxUsers.user_id, userId))
    .orderBy(desc(mailboxes.created_at), desc(mailboxes.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row)
  }));
  return { mailboxes: window.slice(0, limit).map(toMailbox), meta };
}

export async function listAllMailboxes(
  c: AppContext,
  limit: number,
  cursorId: string | undefined
): Promise<{ mailboxes: Mailbox[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db
    .select({
      id: mailboxes.id,
      domain_id: mailboxes.domain_id,
      local_part: mailboxes.local_part,
      domain_name: domains.domain_name,
      is_active: mailboxes.is_active,
      created_at: mailboxes.created_at,
      updated_at: mailboxes.updated_at
    })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domain_id, domains.id))
    .orderBy(desc(mailboxes.created_at), desc(mailboxes.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row)
  }));
  return { mailboxes: window.slice(0, limit).map(toMailbox), meta };
}

export type CreateMailboxInput = {
  domain_id: string;
  local_part: string;
};

export async function createMailbox(
  c: AppContext,
  input: CreateMailboxInput
): Promise<{ mailbox: Mailbox } | MailboxError> {
  const db = getDb(c);

  const [domain] = await db.select().from(domains).where(eq(domains.id, input.domain_id)).limit(1);
  if (domain?.verification_status !== "active") {
    return { error: "DOMAIN_NOT_ACTIVE" };
  }

  const now = Date.now();
  const id = uuidv7();

  try {
    await db.batch([
      db.insert(mailboxes).values({
        id,
        domain_id: input.domain_id,
        local_part: input.local_part,
        is_active: true,
        created_at: now,
        updated_at: now
      }),
      ...SYSTEM_FOLDER_NAMES.map((name) =>
        db.insert(folders).values({
          id: uuidv7(),
          mailbox_id: id,
          name,
          folder_type: "system",
          created_at: now,
          updated_at: now
        })
      )
    ]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "MAILBOX_ADDRESS_ALREADY_EXISTS" };
    }
    throw err;
  }

  const mailbox = await getMailboxDetail(c, id);
  if (!mailbox) {
    return { error: "NOT_FOUND" };
  }
  return { mailbox };
}

export async function getMailboxDetail(c: AppContext, mailboxId: string): Promise<Mailbox | null> {
  const db = getDb(c);
  const [row] = await db
    .select({
      id: mailboxes.id,
      domain_id: mailboxes.domain_id,
      local_part: mailboxes.local_part,
      domain_name: domains.domain_name,
      is_active: mailboxes.is_active,
      created_at: mailboxes.created_at,
      updated_at: mailboxes.updated_at
    })
    .from(mailboxes)
    .innerJoin(domains, eq(mailboxes.domain_id, domains.id))
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);
  return row ? toMailbox(row) : null;
}

export type UpdateMailboxInput = {
  local_part?: string;
  is_active?: boolean;
};

export async function updateMailbox(
  c: AppContext,
  mailboxId: string,
  input: UpdateMailboxInput
): Promise<{ mailbox: Mailbox } | MailboxError> {
  const db = getDb(c);

  const [existing] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);
  if (!existing) return { error: "NOT_FOUND" };

  const set: Partial<typeof mailboxes.$inferInsert> = {
    updated_at: Date.now()
  };
  if (input.local_part !== undefined) set.local_part = input.local_part;
  if (input.is_active !== undefined) set.is_active = input.is_active;

  try {
    await db.update(mailboxes).set(set).where(eq(mailboxes.id, mailboxId));
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "MAILBOX_ADDRESS_ALREADY_EXISTS" };
    }
    throw err;
  }

  const mailbox = await getMailboxDetail(c, mailboxId);
  if (!mailbox) return { error: "NOT_FOUND" };
  return { mailbox };
}

export async function linkUser(
  c: AppContext,
  mailboxId: string,
  userId: string
): Promise<{ ok: true } | MailboxError> {
  const db = getDb(c);

  const [mailbox] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);
  if (!mailbox) return { error: "NOT_FOUND" };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: "NOT_FOUND" };

  try {
    await db.insert(mailboxUsers).values({
      id: uuidv7(),
      mailbox_id: mailboxId,
      user_id: userId,
      created_at: Date.now()
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "ALREADY_LINKED" };
    }
    throw err;
  }

  return { ok: true };
}

export async function unlinkUser(
  c: AppContext,
  mailboxId: string,
  userId: string
): Promise<{ ok: true } | MailboxError> {
  const db = getDb(c);

  const deleted = await db
    .delete(mailboxUsers)
    .where(and(eq(mailboxUsers.mailbox_id, mailboxId), eq(mailboxUsers.user_id, userId)))
    .returning({ id: mailboxUsers.id });

  if (deleted.length === 0) return { error: "NOT_FOUND" };
  return { ok: true };
}

export async function listMailboxUsers(
  c: AppContext,
  mailboxId: string,
  limit: number,
  cursorId: string | undefined
): Promise<{ users: MailboxLinkedUser[]; meta: PageMeta } | MailboxError> {
  const db = getDb(c);

  const [mailbox] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);
  if (!mailbox) return { error: "NOT_FOUND" };

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      is_active: users.is_active
    })
    .from(mailboxUsers)
    .innerJoin(users, eq(mailboxUsers.user_id, users.id))
    .where(eq(mailboxUsers.mailbox_id, mailboxId))
    .orderBy(asc(mailboxUsers.user_id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row)
  }));
  return {
    users: window.slice(0, limit).map((row) => ({
      user_id: row.id,
      username: row.username,
      role: row.role,
      is_active: row.is_active
    })),
    meta
  };
}
