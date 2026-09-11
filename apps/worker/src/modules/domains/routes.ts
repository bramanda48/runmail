import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  domainNameSchema,
  PAGINATION_DEFAULT_LIMIT
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/env";
import { badRequest } from "../../lib/http-error";
import { jwtAuth, requireAdmin } from "../../middleware/auth";
import * as service from "./service";

function cloudflareUnavailable() {
  return {
    error: {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: "Gagal menghubungi Cloudflare API"
    }
  };
}

function isCloudflareError(err: unknown): boolean {
  return err instanceof Error && err.message === "CLOUDFLARE_API_ERROR";
}

export const domainRoutes = new Hono<AppEnv>();

domainRoutes.use("*", jwtAuth, requireAdmin);

domainRoutes.get("/available", async (c) => {
  try {
    const { zones } = await service.listAvailableZones(c);
    return c.json({ data: { zones } }, 200);
  } catch (err) {
    if (isCloudflareError(err)) {
      return c.json(cloudflareUnavailable(), 502);
    }
    throw err;
  }
});

domainRoutes.get("/", async (c) => {
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

  const { domains, meta } = await service.listDomains(c, limit, cursorId);
  return c.json({ data: { domains }, meta }, 200);
});

const createDomainBodySchema = z.object({
  domain_name: domainNameSchema
});

domainRoutes.post("/", async (c) => {
  const parsed = createDomainBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const result = await service.addDomain(c, parsed.data.domain_name);
  if ("error" in result) {
    if (result.error === "DOMAIN_EXISTS") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "Domain sudah terdaftar",
            details: { field: "domain_name" }
          }
        },
        409
      );
    }
    if (result.error === "DOMAIN_NOT_AVAILABLE") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "Domain tidak tersedia pada akun Cloudflare",
            details: { field: "domain_name" }
          }
        },
        400
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Domain tidak ditemukan"
        }
      },
      404
    );
  }

  return c.json({ data: { domain: result.domain } }, 201);
});

domainRoutes.post("/:domain_id/verify", async (c) => {
  try {
    const result = await service.verifyDomain(c, c.req.param("domain_id") ?? "");
    if ("error" in result) {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.NOT_FOUND,
            message: "Domain tidak ditemukan"
          }
        },
        404
      );
    }
    return c.json({ data: result }, 200);
  } catch (err) {
    if (isCloudflareError(err)) {
      return c.json(cloudflareUnavailable(), 502);
    }
    throw err;
  }
});
