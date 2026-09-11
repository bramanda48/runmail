import { z } from "zod";
import { PAGINATION_MAX_LIMIT } from "../contracts/pagination";

/**
 * Query schema shared by cursor-paginated list endpoints. `limit` is coerced
 * from string or number and capped at 1-100.
 */
export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION_MAX_LIMIT).optional()
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;
