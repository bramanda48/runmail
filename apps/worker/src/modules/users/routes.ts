import type { AppEnv } from "@/lib/env";
import { badRequest, fail, ok } from "@/lib/response";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import * as service from "@/modules/users/service";
import { createUserBodySchema, patchUserBodySchema } from "@/modules/users/validation";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
  usersQuerySchema,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", jwtAuth, requireAdmin);

userRoutes.get("/", async (c) => {
  const query = c.req.query();
  const parsed = usersQuerySchema.safeParse(query);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }
  const limit = parsed.data.limit ?? PAGINATION_DEFAULT_LIMIT;

  let cursorId: string | undefined;
  if (parsed.data.cursor) {
    const payload = decodeCursor<IdCursorPayload>(parsed.data.cursor);
    if (!payload) {
      return badRequest(c, { cursor: ["Invalid cursor"] });
    }
    cursorId = payload.id;
  }

  const { users, meta } = await service.listUsers(c, limit, cursorId, {
    search: parsed.data.search,
    role: parsed.data.role,
    status: parsed.data.status,
  });
  return ok(c, { users }, meta);
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createUserBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.createUser(c, parsed.data);
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.USERNAME_ALREADY_EXISTS, "Username is already taken", 409);
  }

  return ok(c, { user: result.user }, undefined, 201);
});

userRoutes.get("/:user_id", async (c) => {
  const user = await service.getUserById(c, c.req.param("user_id"));
  if (!user) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "User not found", 404);
  }
  return ok(c, { user });
});

userRoutes.patch("/:user_id", async (c) => {
  const body = await c.req.json();
  const parsed = patchUserBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return badRequest(c, {
      ...flat.fieldErrors,
      ...(flat.formErrors.length > 0 ? { _form: flat.formErrors } : {}),
    });
  }

  const userId = c.req.param("user_id");
  const authUser = c.get("auth");
  if (
    authUser.user_id === userId &&
    (parsed.data.is_active === false ||
      (parsed.data.role !== undefined && parsed.data.role !== "admin"))
  ) {
    return fail(
      c,
      API_ERROR_CODES.VALIDATION_ERROR,
      "You cannot deactivate or demote your own account",
      400,
    );
  }

  const result = await service.updateUser(c, userId, parsed.data);
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "User not found", 404);
  }
  return ok(c, { user: result.user });
});

userRoutes.delete("/:user_id", async (c) => {
  const userId = c.req.param("user_id");
  if (c.get("auth").user_id === userId) {
    return fail(c, API_ERROR_CODES.CANNOT_DELETE_SELF, "You cannot delete your own account", 400);
  }
  const result = await service.deleteUser(c, userId);
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "User not found", 404);
  }
  return ok(c, { ok: true });
});
