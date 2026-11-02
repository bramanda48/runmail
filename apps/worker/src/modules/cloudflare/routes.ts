import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import {
  disconnectCloudflare,
  getAuthorizationUrl,
  handleCloudflareCallback,
  isCloudflareConfigured,
} from "@/modules/cloudflare/service";
import { API_ERROR_CODES } from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

const cloudflare = new Hono<AppEnv>();

const authorizeSchema = z.object({
  redirect_uri: z.string().url(),
});

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// Per-route auth: defined before the wildcard middleware below.
cloudflare.post("/cloudflare/callback", jwtAuth, requireAdmin, async (c) => {
  const parsed = callbackSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const { code, state } = parsed.data;

  const result = await handleCloudflareCallback(c, { code, state });

  if (!result.success) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: result.error,
        },
      },
      400,
    );
  }

  return c.json(
    {
      data: {
        message: "OAuth connected successfully",
      },
    },
    200,
  );
});

cloudflare.use("*", jwtAuth, requireAdmin);

cloudflare.get("/cloudflare/status", async (c) => {
  const configured = await isCloudflareConfigured(c);
  return c.json({
    data: {
      configured,
    },
  });
});

// Cloudflare callbacks to the frontend, so redirect_uri comes from the request body.
cloudflare.post("/cloudflare/authorize", async (c) => {
  const parsed = authorizeSchema.safeParse(await c.req.json().catch(() => null));

  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const { url, state } = await getAuthorizationUrl(c.env, parsed.data.redirect_uri);

  return c.json({
    data: {
      authorization_url: url,
      state,
    },
  });
});

cloudflare.delete("/cloudflare/disconnect", async (c) => {
  await disconnectCloudflare(c);

  return c.json({
    data: {
      message: "OAuth disconnected successfully",
    },
  });
});

export default cloudflare;
