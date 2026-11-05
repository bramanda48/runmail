import { syncMutationItemSchema } from "@runmail/shared";
import z from "zod";

export const mutationsBodySchema = z.object({
  mutations: z.array(syncMutationItemSchema).min(1).max(100),
});
