import { refreshTokens, users } from "@runmail/db";
import type { PageMeta, User } from "@runmail/shared";
import { buildIdCursor, buildPageMeta } from "@runmail/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import { isUniqueViolation } from "../../lib/sqlite";
import { hashPassword } from "../auth";

export type PublicUser = User;

export function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listUsers(
  c: AppContext,
  limit: number,
  cursorId: string | undefined,
): Promise<{ users: PublicUser[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db.select().from(users).orderBy(desc(users.created_at), desc(users.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row),
  }));
  return { users: window.slice(0, limit).map(toPublicUser), meta };
}

export type CreateUserInput = {
  username: string;
  password: string;
  role: "admin" | "member";
};

export async function createUser(
  c: AppContext,
  input: CreateUserInput,
): Promise<{ user: PublicUser } | { error: "USERNAME_EXISTS" }> {
  const db = getDb(c);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);
  if (existing) return { error: "USERNAME_EXISTS" };

  const now = Date.now();
  const id = uuidv7();
  const password_hash = await hashPassword(input.password);

  try {
    await db.insert(users).values({
      id,
      username: input.username,
      password_hash,
      role: input.role,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "USERNAME_EXISTS" };
    }
    throw err;
  }

  return {
    user: {
      id,
      username: input.username,
      role: input.role,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  };
}

export async function getUserById(c: AppContext, id: string): Promise<PublicUser | null> {
  const db = getDb(c);
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toPublicUser(row) : null;
}

export type UpdateUserInput = {
  role?: "admin" | "member";
  is_active?: boolean;
  password?: string;
};

export async function updateUser(
  c: AppContext,
  id: string,
  input: UpdateUserInput,
): Promise<{ user: PublicUser } | { error: "NOT_FOUND" }> {
  const db = getDb(c);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return { error: "NOT_FOUND" };

  const now = Date.now();
  const set: Partial<typeof users.$inferInsert> = { updated_at: now };
  if (input.role !== undefined) set.role = input.role;
  if (input.is_active !== undefined) set.is_active = input.is_active;
  if (input.password !== undefined) {
    set.password_hash = await hashPassword(input.password);
  }

  if (input.is_active === false || input.password !== undefined) {
    await db.batch([
      db.update(users).set(set).where(eq(users.id, id)),
      db
        .update(refreshTokens)
        .set({ revoked_at: now })
        .where(and(eq(refreshTokens.user_id, id), isNull(refreshTokens.revoked_at))),
    ]);
  } else {
    await db.update(users).set(set).where(eq(users.id, id));
  }

  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return { error: "NOT_FOUND" };
  return { user: toPublicUser(row) };
}
