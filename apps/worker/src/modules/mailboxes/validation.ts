import { localPartSchema } from "@runmail/shared";
import z from "zod";

export const createMailboxBodySchema = z.object({
  domain_id: z.string().min(1),
  local_part: localPartSchema,
});

export const patchMailboxBodySchema = z
  .object({
    local_part: localPartSchema.optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => v.local_part !== undefined || v.is_active !== undefined, {
    message: "At least one field is required",
  });

export const linkUserBodySchema = z.object({
  user_id: z.string().min(1),
});

export const linkTeamBodySchema = z.object({
  team_id: z.string().min(1),
});
