import { z } from "zod";

export const USERNAME_PATTERN = /^[A-Za-z0-9\-_.]{6,20}$/;

export const usernameSchema = z
  .string()
  .regex(
    USERNAME_PATTERN,
    "Username must be 6-20 characters using letters, digits, hyphen, underscore, or dot",
  );
