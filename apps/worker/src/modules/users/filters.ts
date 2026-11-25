import { users } from "@runmail/db";
import type { UsersQuery } from "@runmail/shared";
import { and, eq, type SQL, sql } from "drizzle-orm";

export type UsersFilter = Pick<UsersQuery, "search" | "role" | "status">;

/**
 * Escapes LIKE wildcards so user input matches literally.
 * Backslash first to avoid double-escaping `%` and `_`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Builds the `%...%` LIKE pattern for a search term (lowercased, wildcards escaped). */
export function buildUsersSearchPattern(search: string): string {
  return `%${escapeLikePattern(search.toLowerCase())}%`;
}

/**
 * Pure filter builder for `listUsers`. Returns a drizzle condition combining
 * all provided filters with `and()`, or `undefined` when no filter is set.
 */
export function buildUsersFilter(filters: UsersFilter): SQL | undefined {
  const search = filters.search?.trim();
  return and(
    search
      ? sql`lower(${users.username}) like ${buildUsersSearchPattern(search)} escape '\\'`
      : undefined,
    filters.role ? eq(users.role, filters.role) : undefined,
    filters.status ? eq(users.is_active, filters.status === "active") : undefined,
  );
}
