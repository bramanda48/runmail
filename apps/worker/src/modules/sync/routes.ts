import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { ok } from "@/lib/http-response";
import { jwtAuth } from "@/middleware/auth";
import { requireMailboxAccess } from "@/middleware/mailbox";
import * as messageService from "@/modules/messages";
import { Hono } from "hono";
import { z } from "zod";
import { mutationsBodySchema } from "./validation";

export const syncRoutes = new Hono<AppEnv>();

const syncQuerySchema = z.object({
  last_sync_version: z.coerce.number().int().min(0).optional(),
  last_sync_timestamp: z.coerce.number().int().min(0).optional(),
});

syncRoutes.get("/:mailbox_id/sync", jwtAuth, requireMailboxAccess, async (c) => {
  const query = c.req.query();
  const parsed = syncQuerySchema.safeParse(query);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }
  const delta = await messageService.getSyncDelta(c, c.get("mailbox").mailbox_id, {
    last_sync_version: parsed.data.last_sync_version,
    last_sync_timestamp: parsed.data.last_sync_timestamp,
  });
  if (delta.full_resync_required) {
    return ok(c, {
      events: delta.events,
      last_sync_version: delta.last_sync_version,
      has_more: delta.has_more,
      full_resync_required: true,
      min_version: delta.min_version,
    });
  }
  return ok(c, {
    events: delta.events,
    last_sync_version: delta.last_sync_version,
    has_more: delta.has_more,
  });
});

syncRoutes.post("/:mailbox_id/sync/mutations", jwtAuth, requireMailboxAccess, async (c) => {
  const body = await c.req.json();
  const parsed = mutationsBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }
  const { results } = await messageService.processMutations(
    c,
    c.get("mailbox").mailbox_id,
    parsed.data.mutations,
  );
  return ok(c, { results });
});
