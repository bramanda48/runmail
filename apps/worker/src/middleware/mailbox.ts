import { mailboxes, mailboxUsers } from "@runmail/db";
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

  const [row] = await db
    .select({ id: mailboxes.id, is_active: mailboxes.is_active })
    .from(mailboxes)
    .innerJoin(mailboxUsers, eq(mailboxUsers.mailbox_id, mailboxes.id))
    .where(and(eq(mailboxes.id, mailboxId), eq(mailboxUsers.user_id, auth.user_id)))
    .limit(1);

  if (!row) {
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

  if (!row.is_active) {
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

  c.set("mailbox", { mailbox_id: mailboxId });
  await next();
};
