import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
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

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
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

authRoutes.post("/setup", async (c) => {
  const body = await c.req.json();
  const parsed = setupBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.setup(c, parsed.data);
  if ("error" in result) {
    if (result.error === "SETUP_COMPLETE") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FORBIDDEN,
            message: "Setup sudah selesai",
          },
        },
        403,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.USERNAME_ALREADY_EXISTS,
          message: "Username sudah digunakan",
        },
      },
      409,
    );
  }

  return c.json({ data: result }, 201);
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
    return c.json({ error: { code, message: messages[result.error] ?? code } }, 401);
  }

  return c.json({ data: result }, 200);
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
  return c.json({ data: { ok: true } }, 200);
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
