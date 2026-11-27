import { CloudflareOAuthNotConfiguredError } from "@/lib/cloudflare";
import type { AppEnv } from "@/lib/env";
import { badRequest, fail, ok } from "@/lib/response";
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
    return badRequest(c, fieldErrors);
  }

  const { code, state } = parsed.data;

  const result = await handleCloudflareCallback(c, { code, state });

  if (!result.success) {
    return fail(c, API_ERROR_CODES.VALIDATION_ERROR, result.error, 400);
  }

  return ok(c, { message: "OAuth connected successfully" });
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
      return badRequest(c, { path: ["Proxy path is required"] });
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
      return fail(
        c,
        API_ERROR_CODES.OAUTH_NOT_CONFIGURED,
        "Cloudflare OAuth belum dikonfigurasi. Silakan hubungkan akun Cloudflare terlebih dahulu.",
        400,
      );
    }
    throw err;
  }
});

cloudflare.get("/cloudflare/status", async (c) => {
  const configured = await isCloudflareConfigured(c);
  return ok(c, { configured });
});

// Cloudflare callbacks to the frontend, so redirect_uri comes from the request body.
cloudflare.post("/cloudflare/authorize", async (c) => {
  const body = await c.req.json();
  const parsed = authorizeSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const { url, state } = await getAuthorizationUrl(c, parsed.data.redirect_uri);

  return ok(c, { authorization_url: url, state });
});

cloudflare.delete("/cloudflare/disconnect", async (c) => {
  await disconnectCloudflare(c);

  return ok(c, { message: "OAuth disconnected successfully" });
});

export default cloudflare;
