import type { AppEnv } from "@/lib/env";
import { badRequest, fail, notFound, ok } from "@/lib/response";
import { jwtAuth } from "@/middleware/auth";
import { requireMailboxAccess } from "@/middleware/mailbox";
import * as service from "@/modules/rulesets/service";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
  rulesetSchema,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const rulesetRoutes = new Hono<AppEnv>();

rulesetRoutes.get("/:mailbox_id/rulesets", jwtAuth, requireMailboxAccess, async (c) => {
  const query = c.req.query();
  const parsed = cursorQuerySchema.safeParse(query);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }
  const limit = parsed.data.limit ?? PAGINATION_DEFAULT_LIMIT;

  let cursorId: string | undefined;
  if (parsed.data.cursor) {
    const payload = decodeCursor<IdCursorPayload>(parsed.data.cursor);
    if (!payload) {
      return badRequest(c, { cursor: ["Invalid cursor"] });
    }
    cursorId = payload.id;
  }

  const { rulesets, meta } = await service.listRulesets(
    c,
    c.get("mailbox").mailbox_id,
    limit,
    cursorId,
  );
  return ok(c, { rulesets }, meta);
});

rulesetRoutes.post("/:mailbox_id/rulesets", jwtAuth, requireMailboxAccess, async (c) => {
  const body = await c.req.json();
  const parsed = rulesetSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.createRuleset(c, c.get("mailbox").mailbox_id, parsed.data);
  if ("error" in result) {
    if (result.error === "RULESET_INVALID_REGEX") {
      return fail(
        c,
        API_ERROR_CODES.RULESET_INVALID_REGEX,
        "Invalid regular expression",
        400,
        result.details ?? {},
      );
    }
    if (result.error === "FOLDER_NOT_FOUND") {
      return fail(
        c,
        API_ERROR_CODES.RULESET_INVALID_DEPENDENCY,
        "Destination folder not found in this mailbox",
        400,
        result.details ?? {},
      );
    }
    return notFound(c, "Ruleset not found");
  }
  return ok(c, { ruleset: result.ruleset }, undefined, 201);
});

rulesetRoutes.get("/:mailbox_id/rulesets/:ruleset_id", jwtAuth, requireMailboxAccess, async (c) => {
  const result = await service.getRuleset(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("ruleset_id") ?? "",
  );
  if ("error" in result) {
    return notFound(c, "Ruleset not found");
  }
  return ok(c, { ruleset: result.ruleset });
});

rulesetRoutes.put("/:mailbox_id/rulesets/:ruleset_id", jwtAuth, requireMailboxAccess, async (c) => {
  const body = await c.req.json();
  const parsed = rulesetSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.updateRuleset(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("ruleset_id") ?? "",
    parsed.data,
  );
  if ("error" in result) {
    if (result.error === "RULESET_INVALID_REGEX") {
      return fail(
        c,
        API_ERROR_CODES.RULESET_INVALID_REGEX,
        "Invalid regular expression",
        400,
        result.details ?? {},
      );
    }
    if (result.error === "FOLDER_NOT_FOUND") {
      return fail(
        c,
        API_ERROR_CODES.RULESET_INVALID_DEPENDENCY,
        "Destination folder not found in this mailbox",
        400,
        result.details ?? {},
      );
    }
    return notFound(c, "Ruleset not found");
  }
  return ok(c, { ruleset: result.ruleset });
});

rulesetRoutes.delete(
  "/:mailbox_id/rulesets/:ruleset_id",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const result = await service.deleteRuleset(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("ruleset_id") ?? "",
    );
    if ("error" in result) {
      return notFound(c, "Ruleset not found");
    }
    return ok(c, { ok: true });
  },
);
