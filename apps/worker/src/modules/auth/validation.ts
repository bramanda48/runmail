import { passwordSchema, usernameSchema } from "@runmail/shared";
import z from "zod";

export const setupBodySchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const refreshBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const logoutBodySchema = z.object({
  refresh_token: z.string().min(1),
});

export const changePasswordBodySchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});
