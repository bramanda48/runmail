import { mailboxes, mailboxTeams, mailboxUsers, teamMembers } from "@runmail/db";
import { API_ERROR_CODES } from "@runmail/shared";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { getDb } from "../lib/db";
import type { AppEnv } from "../lib/env";

export const requireMailboxAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.get("auth");
  const mailboxId = c.req.param("mailbox_id");
  if (!mailboxId) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Mailbox tidak ditemukan",
        },
      },
      404,
    );
  }
  const db = getDb(c);

  const [mailbox] = await db
    .select({ id: mailboxes.id, is_active: mailboxes.is_active })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);

  if (!mailbox) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Mailbox tidak ditemukan",
        },
      },
      404,
    );
  }

  if (!mailbox.is_active) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.FORBIDDEN,
          message: "Mailbox tidak aktif",
        },
      },
      403,
    );
  }

  // Union access: direct link OR membership in a team the mailbox is shared to.
  const [direct] = await db
    .select({ id: mailboxUsers.id })
    .from(mailboxUsers)
    .where(and(eq(mailboxUsers.mailbox_id, mailboxId), eq(mailboxUsers.user_id, auth.user_id)))
    .limit(1);

  let allowed = Boolean(direct);
  if (!allowed) {
    const [viaTeam] = await db
      .select({ id: mailboxTeams.id })
      .from(mailboxTeams)
      .innerJoin(teamMembers, eq(teamMembers.team_id, mailboxTeams.team_id))
      .where(and(eq(mailboxTeams.mailbox_id, mailboxId), eq(teamMembers.user_id, auth.user_id)))
      .limit(1);
    allowed = Boolean(viaTeam);
  }

  if (!allowed) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Mailbox tidak ditemukan",
        },
      },
      404,
    );
  }

  c.set("mailbox", { mailbox_id: mailboxId });
  await next();
};
