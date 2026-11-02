import { passwordSchema, usernameSchema } from "@runmail/shared";
import z from "zod";

export const createUserBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "member"]),
});

export const patchUserBodySchema = z
  .object({
    role: z.enum(["admin", "member"]).optional(),
    is_active: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => v.role !== undefined || v.is_active !== undefined || v.password !== undefined, {
    message: "At least one field is required",
  });
