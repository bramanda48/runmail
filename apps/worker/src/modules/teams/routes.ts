import type { AppEnv } from "@/lib/env";
import { badRequest, fail, ok } from "@/lib/response";
import { jwtAuth, requireAdmin } from "@/middleware/auth";
import * as service from "@/modules/teams/service";
import { addMemberBodySchema, createTeamBodySchema } from "@/modules/teams/validation";
import type { IdCursorPayload } from "@runmail/shared";
import {
  API_ERROR_CODES,
  cursorQuerySchema,
  decodeCursor,
  PAGINATION_DEFAULT_LIMIT,
} from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const teamRoutes = new Hono<AppEnv>();

teamRoutes.get("/", jwtAuth, requireAdmin, async (c) => {
  const query = c.req.query();
  const parsed = cursorQuerySchema.safeParse(query);

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

  const result = await service.listTeams(c, limit, cursorId);
  return ok(c, { teams: result.teams }, result.meta);
});

teamRoutes.post("/", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.createTeam(c, { name: parsed.data.name });
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.VALIDATION_ERROR, "Team name is already taken", 409);
  }
  return ok(c, { team: result.team }, undefined, 201);
});

teamRoutes.patch("/:team_id", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.updateTeam(c, c.req.param("team_id") ?? "", {
    name: parsed.data.name,
  });
  if ("error" in result) {
    if (result.error === "TEAM_NAME_ALREADY_EXISTS") {
      return fail(c, API_ERROR_CODES.VALIDATION_ERROR, "Team name is already taken", 409);
    }
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Team not found", 404);
  }
  return ok(c, { team: result.team });
});

teamRoutes.delete("/:team_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.deleteTeam(c, c.req.param("team_id") ?? "");
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Team not found", 404);
  }
  return ok(c, { ok: true });
});

teamRoutes.get("/:team_id/users", jwtAuth, requireAdmin, async (c) => {
  const query = c.req.query();
  const parsed = cursorQuerySchema.safeParse(query);

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

  const result = await service.listTeamMembers(c, c.req.param("team_id") ?? "", limit, cursorId);
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Team not found", 404);
  }
  return ok(c, { users: result.users }, result.meta);
});

teamRoutes.post("/:team_id/users", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = addMemberBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return badRequest(c, fieldErrors);
  }

  const result = await service.addTeamMember(c, c.req.param("team_id") ?? "", parsed.data.user_id);
  if ("error" in result) {
    if (result.error === "ALREADY_MEMBER") {
      return fail(
        c,
        API_ERROR_CODES.VALIDATION_ERROR,
        "User is already a member of this team",
        409,
      );
    }
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Team or user not found", 404);
  }
  return ok(c, { ok: true }, undefined, 201);
});

teamRoutes.delete("/:team_id/users/:user_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.removeTeamMember(
    c,
    c.req.param("team_id") ?? "",
    c.req.param("user_id") ?? "",
  );
  if ("error" in result) {
    return fail(c, API_ERROR_CODES.NOT_FOUND, "Membership not found", 404);
  }
  return ok(c, { ok: true });
});
