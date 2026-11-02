import { CloudflareOAuthNotConfiguredError } from "@/lib/cloudflare";
import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
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

function cloudflareUnavailable() {
  return {
    error: {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: "Gagal menghubungi Cloudflare API",
    },
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
    if (err instanceof CloudflareOAuthNotConfiguredError) {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.OAUTH_NOT_CONFIGURED,
            message:
              "Cloudflare OAuth belum dikonfigurasi. Silakan hubungkan akun Cloudflare terlebih dahulu.",
          },
        },
        400,
      );
    }
    if (isCloudflareError(err)) {
      return c.json(cloudflareUnavailable(), 502);
    }
    throw err;
  }
});

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
  return c.json({ data: { domains }, meta }, 200);
});

domainRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createDomainBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.addDomain(c, parsed.data.domain_name);
  if ("error" in result) {
    if (result.error === "OAUTH_NOT_CONFIGURED") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.OAUTH_NOT_CONFIGURED,
            message:
              "Cloudflare OAuth belum dikonfigurasi. Silakan hubungkan akun Cloudflare terlebih dahulu.",
          },
        },
        400,
      );
    }
    if (result.error === "DOMAIN_EXISTS") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.DOMAIN_ALREADY_EXISTS,
            message: "Domain sudah terdaftar",
            details: { field: "domain_name" },
          },
        },
        409,
      );
    }
    if (result.error === "DOMAIN_NOT_AVAILABLE") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.DOMAIN_NOT_AVAILABLE,
            message: "Domain tidak tersedia pada akun Cloudflare",
            details: { field: "domain_name" },
          },
        },
        400,
      );
    }
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

  return c.json({ data: { domain: result.domain } }, 201);
});

domainRoutes.post("/:domain_id/verify", async (c) => {
  try {
    const result = await service.verifyDomain(c, c.req.param("domain_id") ?? "");
    if ("error" in result) {
      if (result.error === "OAUTH_NOT_CONFIGURED") {
        return c.json(
          {
            error: {
              code: API_ERROR_CODES.OAUTH_NOT_CONFIGURED,
              message:
                "Cloudflare OAuth belum dikonfigurasi. Silakan hubungkan akun Cloudflare terlebih dahulu.",
            },
          },
          400,
        );
      }
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
    return c.json({ data: result }, 200);
  } catch (err) {
    if (isCloudflareError(err)) {
      return c.json(cloudflareUnavailable(), 502);
    }
    throw err;
  }
});
