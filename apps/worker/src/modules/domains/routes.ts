import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { fail, ok } from "@/lib/http-response";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import * as service from "@/modules/domains/service";
import { createDomainBodySchema } from "@/modules/domains/validation";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const domainRoutes = new Hono<AppEnv>();

domainRoutes.use("*", jwtAuth, requireAdmin);

domainRoutes.get("/", async (c) => {
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

  const { domains, meta } = await service.listDomains(c, limit, cursorId);
  return ok(c, { domains }, meta);
});

domainRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createDomainBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.addDomain(c, parsed.data.zone_id);
  if ("error" in result) {
    if (result.error === "DOMAIN_EXISTS") {
      return fail(c, API_ERROR_CODES.DOMAIN_ALREADY_EXISTS, "Domain sudah terdaftar", 409, {
        field: "zone_id",
      });
    }
    if (result.error === "OAUTH_NOT_CONFIGURED") {
      return fail(
        c,
        API_ERROR_CODES.OAUTH_NOT_CONFIGURED,
        "Cloudflare OAuth belum dikonfigurasi. Silakan hubungkan akun Cloudflare terlebih dahulu.",
        400,
      );
    }
    return fail(c, API_ERROR_CODES.DOMAIN_NOT_FOUND, "Zone tidak ditemukan di Cloudflare", 404);
  }

  return ok(c, { domain: result.domain }, undefined, 201);
});
