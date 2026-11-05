import { teamMembers, teams, users } from "@runmail/db";
import type { PageMeta, Team, TeamLinkedUser } from "@runmail/shared";
import { buildIdCursor, buildPageMeta } from "@runmail/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import { isUniqueViolation } from "../../lib/sqlite";

export type TeamErrorCode = "NOT_FOUND" | "TEAM_NAME_ALREADY_EXISTS" | "ALREADY_MEMBER";

export type TeamError = { error: TeamErrorCode };

export async function listTeams(
  c: AppContext,
  limit: number,
  cursorId: string | undefined,
): Promise<{ teams: Team[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db.select().from(teams).orderBy(desc(teams.created_at), desc(teams.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row),
  }));
  return { teams: window.slice(0, limit), meta };
}

export type CreateTeamInput = {
  name: string;
};

export async function createTeam(
  c: AppContext,
  input: CreateTeamInput,
): Promise<{ team: Team } | TeamError> {
  const db = getDb(c);
  const now = Date.now();
  try {
    const [row] = await db
      .insert(teams)
      .values({
        id: uuidv7(),
        name: input.name,
        created_at: now,
        updated_at: now,
      })
      .returning();
    return { team: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "TEAM_NAME_ALREADY_EXISTS" };
    }
    throw err;
  }
}

export async function updateTeam(
  c: AppContext,
  teamId: string,
  input: { name: string },
): Promise<{ team: Team } | TeamError> {
  const db = getDb(c);
  try {
    const updated = await db
      .update(teams)
      .set({ name: input.name, updated_at: Date.now() })
      .where(eq(teams.id, teamId))
      .returning();
    if (updated.length === 0) return { error: "NOT_FOUND" };
    return { team: updated[0] };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "TEAM_NAME_ALREADY_EXISTS" };
    }
    throw err;
  }
}

export async function deleteTeam(c: AppContext, teamId: string): Promise<{ ok: true } | TeamError> {
  const db = getDb(c);
  const deleted = await db.delete(teams).where(eq(teams.id, teamId)).returning({ id: teams.id });
  if (deleted.length === 0) return { error: "NOT_FOUND" };
  return { ok: true };
}

export async function listTeamMembers(
  c: AppContext,
  teamId: string,
  limit: number,
  cursorId: string | undefined,
): Promise<{ users: TeamLinkedUser[]; meta: PageMeta } | TeamError> {
  const db = getDb(c);

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { error: "NOT_FOUND" };

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      is_active: users.is_active,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.user_id, users.id))
    .where(eq(teamMembers.team_id, teamId))
    .orderBy(asc(teamMembers.user_id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row),
  }));
  return {
    users: window.slice(0, limit).map((row) => ({
      user_id: row.id,
      username: row.username,
      role: row.role,
      is_active: row.is_active,
    })),
    meta,
  };
}

export async function addTeamMember(
  c: AppContext,
  teamId: string,
  userId: string,
): Promise<{ ok: true } | TeamError> {
  const db = getDb(c);

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) return { error: "NOT_FOUND" };

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { error: "NOT_FOUND" };

  try {
    await db.insert(teamMembers).values({
      id: uuidv7(),
      team_id: teamId,
      user_id: userId,
      created_at: Date.now(),
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "ALREADY_MEMBER" };
    }
    throw err;
  }

  return { ok: true };
}

export async function removeTeamMember(
  c: AppContext,
  teamId: string,
  userId: string,
): Promise<{ ok: true } | TeamError> {
  const db = getDb(c);

  const deleted = await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.team_id, teamId), eq(teamMembers.user_id, userId)))
    .returning({ id: teamMembers.id });

  if (deleted.length === 0) return { error: "NOT_FOUND" };
  return { ok: true };
}
