import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import { requireMailboxAccess } from "@/middleware/mailbox";
import * as service from "@/modules/mailboxes/service";
import {
  createMailboxBodySchema,
  linkTeamBodySchema,
  linkUserBodySchema,
  patchMailboxBodySchema,
} from "@/modules/mailboxes/validation";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const mailboxRoutes = new Hono<AppEnv>();

mailboxRoutes.get("/all", jwtAuth, requireAdmin, async (c) => {
  const query = c.req.query();
  const parsed = cursorQuerySchema.safeParse(query);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }
  const limit = parsed.data.limit ?? PAGINATION_DEFAULT_LIMIT;

  let cursorId: string | undefined;
  if (parsed.data.cursor) {
    const payload = decodeCursor<IdCursorPayload>(parsed.data.cursor);
    if (!payload) {
      return c.json(badRequest({ cursor: ["Invalid cursor"] }), 400);
    }
    cursorId = payload.id;
  }

  const { mailboxes, meta } = await service.listAllMailboxes(c, limit, cursorId);
  return c.json({ data: { mailboxes }, meta }, 200);
});

mailboxRoutes.get("/", jwtAuth, async (c) => {
  const query = c.req.query();
  const parsed = cursorQuerySchema.safeParse(query);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }
  const limit = parsed.data.limit ?? PAGINATION_DEFAULT_LIMIT;

  let cursorId: string | undefined;
  if (parsed.data.cursor) {
    const payload = decodeCursor<IdCursorPayload>(parsed.data.cursor);
    if (!payload) {
      return c.json(badRequest({ cursor: ["Invalid cursor"] }), 400);
    }
    cursorId = payload.id;
  }

  const authUser = c.get("auth");
  const { mailboxes, meta } = await service.listMailboxesForUser(
    c,
    authUser.user_id,
    limit,
    cursorId,
  );
  return c.json({ data: { mailboxes }, meta }, 200);
});

mailboxRoutes.post("/", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createMailboxBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.createMailbox(c, parsed.data);
  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.DOMAIN_NOT_FOUND,
            message: "Domain tidak ditemukan",
          },
        },
        404,
      );
    }
    if (result.error === "MAILBOX_ADDRESS_ALREADY_EXISTS") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.MAILBOX_ADDRESS_ALREADY_EXISTS,
            message: "Alamat mailbox sudah digunakan",
            details: { field: "local_part" },
          },
        },
        409,
      );
    }
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

  return c.json({ data: { mailbox: result.mailbox } }, 201);
});

mailboxRoutes.get("/:mailbox_id", jwtAuth, requireMailboxAccess, async (c) => {
  const mailbox = await service.getMailboxDetail(c, c.get("mailbox").mailbox_id);
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
  return c.json({ data: { mailbox } }, 200);
});

mailboxRoutes.patch("/:mailbox_id", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = patchMailboxBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return c.json(
      badRequest({
        ...flat.fieldErrors,
        ...(flat.formErrors.length > 0 ? { _form: flat.formErrors } : {}),
      }),
      400,
    );
  }

  const result = await service.updateMailbox(c, c.req.param("mailbox_id") ?? "", parsed.data);
  if ("error" in result) {
    if (result.error === "MAILBOX_ADDRESS_ALREADY_EXISTS") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.MAILBOX_ADDRESS_ALREADY_EXISTS,
            message: "Alamat mailbox sudah digunakan",
            details: { field: "local_part" },
          },
        },
        409,
      );
    }
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
  return c.json({ data: { mailbox: result.mailbox } }, 200);
});

mailboxRoutes.post("/:mailbox_id/users", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = linkUserBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.linkUser(c, c.req.param("mailbox_id") ?? "", parsed.data.user_id);
  if ("error" in result) {
    if (result.error === "ALREADY_LINKED") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "User sudah terhubung ke mailbox ini",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Mailbox atau user tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 201);
});

mailboxRoutes.delete("/:mailbox_id/users/:user_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.unlinkUser(
    c,
    c.req.param("mailbox_id") ?? "",
    c.req.param("user_id") ?? "",
  );
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Kaitan user tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 200);
});

mailboxRoutes.post("/:mailbox_id/teams", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = linkTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.linkTeam(c, c.req.param("mailbox_id") ?? "", parsed.data.team_id);
  if ("error" in result) {
    if (result.error === "ALREADY_LINKED") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "Team sudah terhubung ke mailbox ini",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Mailbox atau team tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 201);
});

mailboxRoutes.delete("/:mailbox_id/teams/:team_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.unlinkTeam(
    c,
    c.req.param("mailbox_id") ?? "",
    c.req.param("team_id") ?? "",
  );
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Kaitan team tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 200);
});
