import z from "zod";

export const createDomainBodySchema = z.object({
  zone_id: z.string().trim().min(1),
});
