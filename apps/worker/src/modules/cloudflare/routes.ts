import { CloudflareOAuthNotConfiguredError } from "@/lib/cloudflare";
import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import {
  disconnectCloudflare,
  getAuthorizationUrl,
  handleCloudflareCallback,
  isCloudflareConfigured,
  proxyCloudflareRequest,
} from "@/modules/cloudflare/service";
import { authorizeSchema, callbackSchema } from "@/modules/cloudflare/validation";
import { API_ERROR_CODES } from "@runmail/shared";
import { Hono } from "hono";
import { proxy } from "hono/proxy";
import { z } from "zod";

const cloudflare = new Hono<AppEnv>();

cloudflare.use("*", jwtAuth, requireAdmin);

cloudflare.post("/cloudflare/callback", async (c) => {
  const body = await c.req.json();
  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
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

cloudflare.all("/cloudflare/proxy/*", async (c) => {
  try {
    const marker = "/cloudflare/proxy/";
    const fullPath = c.req.path;
    const idx = fullPath.indexOf(marker);
    const remainder = idx >= 0 ? fullPath.slice(idx + marker.length) : "";
    const queryIndex = c.req.url.indexOf("?");
    const search = queryIndex >= 0 ? c.req.url.slice(queryIndex) : "";
    if (!remainder) {
      return c.json(badRequest({ path: ["Proxy path is required"] }), 400);
    }
    const { accessToken, upstreamUrl } = await proxyCloudflareRequest(c, remainder);

    return proxy(`${upstreamUrl}${search}`, {
      ...c.req,
      headers: {
        ...c.req.header(),
        Authorization: `Bearer ${accessToken}`,
      },
    });
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
    throw err;
  }
});

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
  const body = await c.req.json();
  const parsed = authorizeSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
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
