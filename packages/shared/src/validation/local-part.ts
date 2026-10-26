import { z } from "zod";

export const LOCAL_PART_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

export const LOCAL_PART_MIN_LENGTH = 1;
export const LOCAL_PART_MAX_LENGTH = 64;

export const localPartSchema = z
  .string()
  .min(LOCAL_PART_MIN_LENGTH)
  .max(LOCAL_PART_MAX_LENGTH)
  .regex(LOCAL_PART_PATTERN, "validation.localPart.invalidChars")
  .refine((value) => !value.startsWith("."), "validation.localPart.leadingDot")
  .refine((value) => !value.endsWith("."), "validation.localPart.trailingDot")
  .refine((value) => !value.includes(".."), "validation.localPart.consecutiveDots")
  .transform((v) => v.toLowerCase());
