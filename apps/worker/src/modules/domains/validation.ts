import { domainNameSchema } from "@runmail/shared";
import z from "zod";

export const createDomainBodySchema = z.object({
  domain_name: domainNameSchema,
});
