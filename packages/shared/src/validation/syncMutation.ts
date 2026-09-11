import { z } from "zod";

export const MUTATION_TYPES = ["read", "star", "move"] as const;
export type MutationType = (typeof MUTATION_TYPES)[number];

const messageIdSchema = z.string().min(1, "message_id is required");

const readMutationSchema = z.object({
  mutation_type: z.literal("read"),
  message_id: messageIdSchema,
  mutation_value: z.boolean()
});

const starMutationSchema = z.object({
  mutation_type: z.literal("star"),
  message_id: messageIdSchema,
  mutation_value: z.boolean()
});

const moveMutationSchema = z.object({
  mutation_type: z.literal("move"),
  message_id: messageIdSchema,
  mutation_value: z.string().min(1, "move requires a folder id")
});

/**
 * A single optimistic mutation. `read`/`star` carry a boolean value; `move`
 * carries the target folder id.
 */
export const syncMutationItemSchema = z.discriminatedUnion("mutation_type", [
  readMutationSchema,
  starMutationSchema,
  moveMutationSchema
]);

export type SyncMutationItem = z.infer<typeof syncMutationItemSchema>;

export const syncMutationSchema = z.object({
  items: z.array(syncMutationItemSchema).min(1, "At least one mutation is required")
});

export type SyncMutationInput = z.infer<typeof syncMutationSchema>;
