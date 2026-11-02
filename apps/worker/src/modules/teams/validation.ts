import z from "zod";

export const createTeamBodySchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100),
});

export const addMemberBodySchema = z.object({
  user_id: z.string().min(1),
});
