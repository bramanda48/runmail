import { accessTokenTTL } from "@/config/auth";
import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { fail, ok } from "@/lib/http-response";
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
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Pengguna tidak ditemukan", 404);
  }

  return c.json({ data: { user: me } }, 200, {
    "Cache-Control": `private, max-age=${accessTokenTTL}`,
    Vary: "Authorization",
  });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.login(c, parsed.data.username, parsed.data.password);
  if (!result) {
    return fail(c, API_ERROR_CODES.INVALID_CREDENTIALS, "Username atau password salah", 401);
  }

  return ok(c, result);
});

authRoutes.post("/setup", async (c) => {
  const body = await c.req.json();
  const parsed = setupBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.setup(c, parsed.data);
  if ("error" in result) {
    if (result.error === "KEYPAIR_UNAVAILABLE") {
      return fail(
        c,
        API_ERROR_CODES.INTERNAL_ERROR,
        "Gagal menyiapkan kunci keamanan, silakan coba lagi",
        500,
      );
    }
    if (result.error === "SETUP_COMPLETE") {
      return fail(c, API_ERROR_CODES.FORBIDDEN, "Setup sudah selesai", 403);
    }
    return fail(c, API_ERROR_CODES.USERNAME_ALREADY_EXISTS, "Username sudah digunakan", 409);
  }

  return ok(c, result, undefined, 201);
});

authRoutes.post("/refresh", async (c) => {
  const body = await c.req.json();
  const parsed = refreshBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
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
      TOKEN_EXPIRED: "Sesi kedaluwarsa, silakan login kembali",
      TOKEN_REUSED: "Token sudah digunakan, silakan login kembali",
      UNAUTHORIZED: "Sesi tidak valid, silakan login kembali",
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
    return c.json(badRequest(fieldErrors), 400);
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
    return c.json(badRequest(fieldErrors), 400);
  }

  const authUser = c.get("auth");
  const result = await service.changePassword(
    c,
    authUser.user_id,
    parsed.data.current_password,
    parsed.data.new_password,
  );
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.INVALID_CREDENTIALS, "Kata sandi saat ini salah", 401);
  }

  return ok(c, result);
});
