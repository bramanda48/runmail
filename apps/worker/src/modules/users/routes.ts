import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
  passwordSchema,
  usernameSchema
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/env";
import { badRequest } from "../../lib/http-error";
import { jwtAuth, requireAdmin } from "../../middleware/auth";
import * as service from "./service";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", jwtAuth, requireAdmin);

userRoutes.get("/", async (c) => {
  const parsed = cursorQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
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

const createUserBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "member"])
});

userRoutes.post("/", async (c) => {
  const parsed = createUserBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.flatten().fieldErrors), 400);
  }

  const result = await service.createUser(c, parsed.data);
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.USERNAME_ALREADY_EXISTS,
          message: "Username sudah digunakan"
        }
      },
      409
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
          message: "Pengguna tidak ditemukan"
        }
      },
      404
    );
  }
  return c.json({ data: { user } }, 200);
});

const patchUserBodySchema = z
  .object({
    role: z.enum(["admin", "member"]).optional(),
    is_active: z.boolean().optional(),
    password: passwordSchema.optional()
  })
  .refine((v) => v.role !== undefined || v.is_active !== undefined || v.password !== undefined, {
    message: "At least one field is required"
  });

userRoutes.patch("/:user_id", async (c) => {
  const parsed = patchUserBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return c.json(
      badRequest({
        ...flat.fieldErrors,
        ...(flat.formErrors.length > 0 ? { _form: flat.formErrors } : {})
      }),
      400
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
          message: "Tidak dapat menonaktifkan atau menurunkan peran akun sendiri"
        }
      },
      400
    );
  }

  const result = await service.updateUser(c, userId, parsed.data);
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Pengguna tidak ditemukan"
        }
      },
      404
    );
  }
  return c.json({ data: { user: result.user } }, 200);
});
