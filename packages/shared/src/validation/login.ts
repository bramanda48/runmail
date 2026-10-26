import { z } from "zod";
import { usernameSchema } from "./username";

/**
 * Login accepts a username and a non-empty password. The full password length
 * policy (8-128) is enforced at user creation, not login.
 */
export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "validation.login.passwordRequired"),
});

export type LoginInput = z.infer<typeof loginSchema>;
