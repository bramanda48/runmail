import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import * as service from "@/modules/users/service";
import { createUserBodySchema, patchUserBodySchema } from "@/modules/users/validation";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", jwtAuth, requireAdmin);

userRoutes.get("/", async (c) => {
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

  const { users, meta } = await service.listUsers(c, limit, cursorId);
  return c.json({ data: { users }, meta }, 200);
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createUserBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.createUser(c, parsed.data);
  if ("error" in result) {
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

  return c.json({ data: { user: result.user } }, 201);
});

userRoutes.get("/:user_id", async (c) => {
  const user = await service.getUserById(c, c.req.param("user_id"));
  if (!user) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Pengguna tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { user } }, 200);
});

userRoutes.patch("/:user_id", async (c) => {
  const body = await c.req.json();
  const parsed = patchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return c.json(
      badRequest({
        ...flat.fieldErrors,
        ...(flat.formErrors.length > 0 ? { _form: flat.formErrors } : {}),
      }),
      400,
    );
  }

  const userId = c.req.param("user_id");
  const authUser = c.get("auth");
  if (
    authUser.user_id === userId &&
    (parsed.data.is_active === false ||
      (parsed.data.role !== undefined && parsed.data.role !== "admin"))
  ) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: "Tidak dapat menonaktifkan atau menurunkan peran akun sendiri",
        },
      },
      400,
    );
  }

  const result = await service.updateUser(c, userId, parsed.data);
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Pengguna tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { user: result.user } }, 200);
});
