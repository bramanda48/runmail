import { accessTokenTTL } from "@/config/auth";
import type { AppEnv } from "@/lib/env";
import { badRequest, fail, ok } from "@/lib/response";
import { jwtAuth } from "@/middleware/auth";
import * as service from "@/modules/auth/service";
import {
  changePasswordBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  setupBodySchema,
} from "@/modules/auth/validation";
import type { ApiErrorCode } from "@runmail/shared";
import { API_ERROR_CODES, loginSchema } from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const authRoutes = new Hono<AppEnv>();

authRoutes.get("/me", jwtAuth, async (c) => {
  const auth = c.get("auth");
  const me = await service.getMe(c, auth.user_id);
  if (!me) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "User not found", 404);
  }

  c.header("Cache-Control", `private, max-age=${accessTokenTTL}`);
  c.header("Vary", "Authorization");

  return ok(c, { user: me });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.login(c, parsed.data.username, parsed.data.password);
  if (!result) {
    return fail(c, API_ERROR_CODES.INVALID_CREDENTIALS, "Incorrect username or password", 401);
  }

  return ok(c, result);
});

authRoutes.post("/setup", async (c) => {
  const body = await c.req.json();
  const parsed = setupBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.setup(c, parsed.data);
  if ("error" in result) {
    if (result.error === "KEYPAIR_UNAVAILABLE") {
      return fail(
        c,
        API_ERROR_CODES.INTERNAL_ERROR,
        "Failed to set up the security key, please try again",
        500,
      );
    }
    if (result.error === "SETUP_COMPLETE") {
      return fail(c, API_ERROR_CODES.FORBIDDEN, "Setup has already been completed", 403);
    }
    return fail(c, API_ERROR_CODES.USERNAME_ALREADY_EXISTS, "Username is already taken", 409);
  }

  return ok(c, result, undefined, 201);
});

authRoutes.post("/refresh", async (c) => {
  const body = await c.req.json();
  const parsed = refreshBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.refresh(c, parsed.data.refresh_token);
  if ("error" in result) {
    const errors: Record<string, ApiErrorCode> = {
      TOKEN_EXPIRED: API_ERROR_CODES.TOKEN_EXPIRED,
      TOKEN_REUSED: API_ERROR_CODES.TOKEN_REUSED,
      UNAUTHORIZED: API_ERROR_CODES.UNAUTHORIZED,
    };
    const code = errors[result.error] ?? API_ERROR_CODES.UNAUTHORIZED;
    const messages: Record<string, string> = {
      TOKEN_EXPIRED: "Session expired, please sign in again",
      TOKEN_REUSED: "Token has already been used, please sign in again",
      UNAUTHORIZED: "Invalid session, please sign in again",
    };
    return fail(c, code, messages[result.error] ?? code, 401);
  }

  return ok(c, result);
});

authRoutes.post("/logout", jwtAuth, async (c) => {
  const body = await c.req.json();
  const parsed = logoutBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const authUser = c.get("auth");
  await service.logout(c, authUser.user_id, parsed.data.refresh_token);
  return ok(c, { ok: true });
});

authRoutes.post("/change-password", jwtAuth, async (c) => {
  const body = await c.req.json();
  const parsed = changePasswordBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const authUser = c.get("auth");
  const result = await service.changePassword(
    c,
    authUser.user_id,
    parsed.data.current_password,
    parsed.data.new_password,
  );
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.INVALID_CREDENTIALS, "Current password is incorrect", 401);
  }

  return ok(c, result);
});
