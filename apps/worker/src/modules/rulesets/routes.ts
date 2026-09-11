import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
  rulesetSchema
} from "@runmail/shared";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/env";
import { badRequest, notFound } from "../../lib/http-error";
import { jwtAuth } from "../../middleware/auth";
import { requireMailboxAccess } from "../../middleware/mailbox";
import * as service from "./service";

function mapServiceError(result: service.RulesetError) {
  if (result.error === "RULESET_INVALID_REGEX") {
    return {
      status: 400 as const,
      body: {
        error: {
          code: API_ERROR_CODES.RULESET_INVALID_REGEX,
          message: "Ekspresi regex tidak valid",
          details: result.details ?? {}
        }
      }
    };
  }
  if (result.error === "FOLDER_NOT_FOUND") {
    return {
      status: 400 as const,
      body: {
        error: {
          code: API_ERROR_CODES.RULESET_INVALID_DEPENDENCY,
          message: "Folder tujuan tidak ditemukan pada mailbox ini",
          details: result.details ?? {}
        }
      }
    };
  }
  return { status: 404 as const, body: notFound("Ruleset tidak ditemukan") };
}

export const rulesetRoutes = new Hono<AppEnv>();

rulesetRoutes.get("/:mailbox_id/rulesets", jwtAuth, requireMailboxAccess, async (c) => {
  const parsed = cursorQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
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

  const { rulesets, meta } = await service.listRulesets(
    c,
    c.get("mailbox").mailbox_id,
    limit,
    cursorId
  );
  return c.json({ data: { rulesets }, meta }, 200);
});

rulesetRoutes.post("/:mailbox_id/rulesets", jwtAuth, requireMailboxAccess, async (c) => {
  const parsed = rulesetSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const result = await service.createRuleset(c, c.get("mailbox").mailbox_id, parsed.data);
  if ("error" in result) {
    const mapped = mapServiceError(result);
    return c.json(mapped.body, mapped.status);
  }
  return c.json({ data: { ruleset: result.ruleset } }, 201);
});

rulesetRoutes.get("/:mailbox_id/rulesets/:ruleset_id", jwtAuth, requireMailboxAccess, async (c) => {
  const result = await service.getRuleset(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("ruleset_id") ?? ""
  );
  if ("error" in result) {
    return c.json(notFound("Ruleset tidak ditemukan"), 404);
  }
  return c.json({ data: { ruleset: result.ruleset } }, 200);
});

rulesetRoutes.put("/:mailbox_id/rulesets/:ruleset_id", jwtAuth, requireMailboxAccess, async (c) => {
  const parsed = rulesetSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const result = await service.updateRuleset(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("ruleset_id") ?? "",
    parsed.data
  );
  if ("error" in result) {
    const mapped = mapServiceError(result);
    return c.json(mapped.body, mapped.status);
  }
  return c.json({ data: { ruleset: result.ruleset } }, 200);
});

rulesetRoutes.delete(
  "/:mailbox_id/rulesets/:ruleset_id",
  jwtAuth,
  requireMailboxAccess,
  async (c) => {
    const result = await service.deleteRuleset(
      c,
      c.get("mailbox").mailbox_id,
      c.req.param("ruleset_id") ?? ""
    );
    if ("error" in result) {
      return c.json(notFound("Ruleset tidak ditemukan"), 404);
    }
    return c.json({ data: { ok: true } }, 200);
  }
);
