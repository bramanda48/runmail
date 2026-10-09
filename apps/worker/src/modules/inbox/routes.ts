import type { MessageCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/env";
import { badRequest, notFound } from "../../lib/http-error";
import { jwtAuth } from "../../middleware/auth";
import { requireMailboxAccess } from "../../middleware/mailbox";
import * as service from "./service";

export const inboxRoutes = new Hono<AppEnv>();

inboxRoutes.get("/:mailbox_id/messages", jwtAuth, requireMailboxAccess, async (c) => {
  const parsed = cursorQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }
  const limit = parsed.data.limit ?? PAGINATION_DEFAULT_LIMIT;

  let cursor: MessageCursorPayload | undefined;
  if (parsed.data.cursor) {
    const payload = decodeCursor<MessageCursorPayload>(parsed.data.cursor);
    if (!payload) {
      return c.json(badRequest({ cursor: ["Invalid cursor"] }), 400);
    }
    cursor = payload;
  }

  const { messages, meta } = await service.listMessages(
    c,
    c.get("mailbox").mailbox_id,
    limit,
    cursor,
  );
  return c.json({ data: { messages }, meta }, 200);
});

inboxRoutes.get("/:mailbox_id/messages/:message_id", jwtAuth, requireMailboxAccess, async (c) => {
  const result = await service.getMessageDetail(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("message_id") ?? "",
  );
  if ("error" in result) {
    return c.json(notFound("Pesan tidak ditemukan"), 404);
  }
  return c.json({ data: { message: result.message } }, 200);
});

inboxRoutes.get(
  "/:mailbox_id/messages/:message_id/raw",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const result = await service.getRawEmail(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("message_id") ?? "",
    );
    if ("error" in result) {
      return c.json(notFound("Pesan tidak ditemukan"), 404);
    }
    return result.response;
  },
);

const readBodySchema = z.object({
  is_read: z.boolean(),
});

inboxRoutes.patch(
  "/:mailbox_id/messages/:message_id/read",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const parsed = readBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
    }
    const result = await service.setMessageRead(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("message_id") ?? "",
      parsed.data.is_read,
    );
    if ("error" in result) {
      return c.json(notFound("Pesan tidak ditemukan"), 404);
    }
    return c.json({ data: { message: result.message } }, 200);
  },
);

const starBodySchema = z.object({
  is_starred: z.boolean(),
});

inboxRoutes.patch(
  "/:mailbox_id/messages/:message_id/star",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const parsed = starBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
    }
    const result = await service.setMessageStarred(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("message_id") ?? "",
      parsed.data.is_starred,
    );
    if ("error" in result) {
      return c.json(notFound("Pesan tidak ditemukan"), 404);
    }
    return c.json({ data: { message: result.message } }, 200);
  },
);

const moveBodySchema = z.object({
  folder_id: z.string().min(1),
});

inboxRoutes.patch(
  "/:mailbox_id/messages/:message_id/move",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const parsed = moveBodySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
    }
    const result = await service.moveMessage(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("message_id") ?? "",
      parsed.data.folder_id,
    );
    if ("error" in result) {
      if (result.error === "INVALID_FOLDER") {
        return c.json(
          {
            error: {
              code: API_ERROR_CODES.VALIDATION_ERROR,
              message: "Folder tujuan tidak valid",
            },
          },
          400,
        );
      }
      return c.json(notFound("Pesan tidak ditemukan"), 404);
    }
    return c.json({ data: { message: result.message } }, 200);
  },
);

inboxRoutes.delete(
  "/:mailbox_id/messages/:message_id",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const result = await service.permanentDelete(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("message_id") ?? "",
      c.env,
    );
    if ("error" in result) {
      if (result.error === "NOT_IN_TRASH") {
        return c.json(
          {
            error: {
              code: API_ERROR_CODES.VALIDATION_ERROR,
              message: "Pesan hanya dapat dihapus permanen dari Trash",
            },
          },
          400,
        );
      }
      return c.json(notFound("Pesan tidak ditemukan"), 404);
    }
    return c.json({ data: { ok: true } }, 200);
  },
);
