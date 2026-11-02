import { folderNameSchema } from "@runmail/shared";
import z from "zod";

export const createFolderBodySchema = z.object({
  name: folderNameSchema,
});

export const renameFolderBodySchema = z.object({
  name: folderNameSchema,
});
