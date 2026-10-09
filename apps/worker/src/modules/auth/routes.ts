import type { ApiErrorCode } from "@runmail/shared";
import { API_ERROR_CODES, loginSchema, passwordSchema } from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/env";
import { badRequest } from "../../lib/http-error";
import { jwtAuth } from "../../middleware/auth";
import * as service from "./service";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const result = await service.login(c, parsed.data.username, parsed.data.password);
  if (!result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.INVALID_CREDENTIALS,
          message: "Username atau password salah",
        },
      },
      401,
    );
  }

  return c.json({ data: result }, 200);
});

const refreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

authRoutes.post("/refresh", async (c) => {
  const parsed = refreshBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
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
    return c.json({ error: { code, message: messages[result.error] ?? code } }, 401);
  }

  return c.json({ data: result }, 200);
});

const logoutBodySchema = z.object({
  refresh_token: z.string().min(1),
});

authRoutes.post("/logout", jwtAuth, async (c) => {
  const parsed = logoutBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const authUser = c.get("auth");
  await service.logout(c, authUser.user_id, parsed.data.refresh_token);
  return c.json({ data: { ok: true } }, 200);
});

const changePasswordBodySchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});

authRoutes.post("/change-password", jwtAuth, async (c) => {
  const parsed = changePasswordBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const authUser = c.get("auth");
  const result = await service.changePassword(
    c,
    authUser.user_id,
    parsed.data.current_password,
    parsed.data.new_password,
  );
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.INVALID_CREDENTIALS,
          message: "Kata sandi saat ini salah",
        },
      },
      401,
    );
  }

  return c.json({ data: result }, 200);
});
