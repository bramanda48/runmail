import { API_ERROR_CODES } from "@runmail/shared";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../lib/env";
import { verifyAccessToken } from "../modules/auth";

export const jwtAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.UNAUTHORIZED,
          message: "Missing or invalid Authorization header"
        }
      },
      401
    );
  }
  const payload = await verifyAccessToken(c.env.JWT_SIGNING_SECRET, header.slice(7));
  if (!payload) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.UNAUTHORIZED,
          message: "Invalid or expired access token"
        }
      },
      401
    );
  }
  c.set("auth", { user_id: payload.sub, role: payload.role });
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("auth")?.role !== "admin") {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.FORBIDDEN,
          message: "Admin role required"
        }
      },
      403
    );
  }
  await next();
};
