import type { AppEnv } from "@/lib/env";
import { fail } from "@/lib/http-response";
import { verifyAccessToken } from "@/modules/auth";
import { API_ERROR_CODES } from "@runmail/shared";
import type { MiddlewareHandler } from "hono";

export const jwtAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return fail(c, API_ERROR_CODES.UNAUTHORIZED, "Missing or invalid Authorization header", 401);
  }
  const payload = await verifyAccessToken(c, header.slice(7));
  if (!payload) {
    return fail(c, API_ERROR_CODES.UNAUTHORIZED, "Invalid or expired access token", 401);
  }
  c.set("auth", { user_id: payload.sub, role: payload.role });
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("auth")?.role !== "admin") {
    return fail(c, API_ERROR_CODES.FORBIDDEN, "Admin role required", 403);
  }
  await next();
};
