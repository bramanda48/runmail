import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
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

  const result = await service.listTeams(c, limit, cursorId);
  return c.json({ data: { teams: result.teams }, meta: result.meta }, 200);
});

teamRoutes.post("/", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.createTeam(c, { name: parsed.data.name });
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: "Nama team sudah digunakan",
        },
      },
      409,
    );
  }
  return c.json({ data: { team: result.team } }, 201);
});

teamRoutes.patch("/:team_id", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = createTeamBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.updateTeam(c, c.req.param("team_id") ?? "", {
    name: parsed.data.name,
  });
  if ("error" in result) {
    if (result.error === "TEAM_NAME_ALREADY_EXISTS") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "Nama team sudah digunakan",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Team tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { team: result.team } }, 200);
});

teamRoutes.delete("/:team_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.deleteTeam(c, c.req.param("team_id") ?? "");
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Team tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 200);
});

teamRoutes.get("/:team_id/users", jwtAuth, requireAdmin, async (c) => {
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

  const result = await service.listTeamMembers(c, c.req.param("team_id") ?? "", limit, cursorId);
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Team tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { users: result.users }, meta: result.meta }, 200);
});

teamRoutes.post("/:team_id/users", jwtAuth, requireAdmin, async (c) => {
  const body = await c.req.json();
  const parsed = addMemberBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.addTeamMember(c, c.req.param("team_id") ?? "", parsed.data.user_id);
  if ("error" in result) {
    if (result.error === "ALREADY_MEMBER") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: "User sudah menjadi anggota team ini",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Team atau user tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 201);
});

teamRoutes.delete("/:team_id/users/:user_id", jwtAuth, requireAdmin, async (c) => {
  const result = await service.removeTeamMember(
    c,
    c.req.param("team_id") ?? "",
    c.req.param("user_id") ?? "",
  );
  if ("error" in result) {
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Keanggotaan tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 200);
});
