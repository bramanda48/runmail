import type { AppEnv } from "@/lib/env";
import { badRequest } from "@/lib/http-error";
import { jwtAuth } from "@/middleware/auth";
import { requireMailboxAccess } from "@/middleware/mailbox";
import * as service from "@/modules/folders/service";
import { createFolderBodySchema, renameFolderBodySchema } from "@/modules/folders/validation";
import { API_ERROR_CODES } from "@runmail/shared";
import { Hono } from "hono";
import { z } from "zod";

export const folderRoutes = new Hono<AppEnv>();

folderRoutes.get("/:mailbox_id/folders", jwtAuth, requireMailboxAccess, async (c) => {
  const { folders } = await service.listFolders(c, c.get("mailbox").mailbox_id);
  return c.json({ data: { folders } }, 200);
});

folderRoutes.post("/:mailbox_id/folders", jwtAuth, requireMailboxAccess, async (c) => {
  const body = await c.req.json();
  const parsed = createFolderBodySchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.createFolder(c, c.get("mailbox").mailbox_id, parsed.data.name);
  if ("error" in result) {
    if (result.error === "FOLDER_IS_SYSTEM") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FOLDER_IS_SYSTEM,
            message: "Nama folder tidak boleh sama dengan folder sistem",
          },
        },
        400,
      );
    }
    if (result.error === "FOLDER_NAME_CONFLICT") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FOLDER_NAME_CONFLICT,
            message: "Nama folder sudah digunakan",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Folder tidak ditemukan",
        },
      },
      404,
    );
  }

  return c.json({ data: { folder: result.folder } }, 201);
});

folderRoutes.delete("/:mailbox_id/folders/:folder_id", jwtAuth, requireMailboxAccess, async (c) => {
  const result = await service.deleteFolder(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("folder_id") ?? "",
  );
  if ("error" in result) {
    if (result.error === "FOLDER_IS_SYSTEM") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FOLDER_IS_SYSTEM,
            message: "Folder sistem tidak dapat dihapus",
          },
        },
        400,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Folder tidak ditemukan",
        },
      },
      404,
    );
  }
  return c.json({ data: { ok: true } }, 200);
});

folderRoutes.patch("/:mailbox_id/folders/:folder_id", jwtAuth, requireMailboxAccess, async (c) => {
  const body = await c.req.json();
  const parsed = renameFolderBodySchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return c.json(badRequest(fieldErrors), 400);
  }

  const result = await service.renameFolder(
    c,
    c.get("mailbox").mailbox_id,
    c.req.param("folder_id") ?? "",
    parsed.data.name,
  );
  if ("error" in result) {
    if (result.error === "FOLDER_IS_SYSTEM") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FOLDER_IS_SYSTEM,
            message: "Folder sistem tidak dapat diubah namanya",
          },
        },
        400,
      );
    }
    if (result.error === "FOLDER_NAME_CONFLICT") {
      return c.json(
        {
          error: {
            code: API_ERROR_CODES.FOLDER_NAME_CONFLICT,
            message: "Nama folder sudah digunakan",
          },
        },
        409,
      );
    }
    return c.json(
      {
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: "Folder tidak ditemukan",
        },
      },
      404,
    );
  }

  return c.json({ data: { folder: result.folder } }, 200);
});
