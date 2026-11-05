import z from "zod";

export const readBodySchema = z.object({
  is_read: z.boolean(),
});

export const starBodySchema = z.object({
  is_starred: z.boolean(),
});

export const moveBodySchema = z.object({
  folder_id: z.string().min(1),
});
