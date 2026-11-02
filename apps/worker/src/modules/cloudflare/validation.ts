import z from "zod";

export const authorizeSchema = z.object({
  redirect_uri: z.string().url(),
});

export const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
