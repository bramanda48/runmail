import { z } from "zod";

export const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

export const LOCAL_PART_MIN_LENGTH = 1;
export const LOCAL_PART_MAX_LENGTH = 64;

export const localPartSchema = z
  .string()
  .min(LOCAL_PART_MIN_LENGTH)
  .max(LOCAL_PART_MAX_LENGTH)
  .regex(LOCAL_PART_PATTERN, "Local part contains invalid characters")
  .refine((value) => !value.startsWith("."), "Local part must not start with a dot")
  .refine((value) => !value.endsWith("."), "Local part must not end with a dot")
  .refine((value) => !value.includes(".."), "Local part must not contain consecutive dots")
  .transform((v) => v.toLowerCase());
