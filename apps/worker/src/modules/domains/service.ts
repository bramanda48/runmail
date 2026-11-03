import { getDb } from "@/lib/db";
import type { AppContext } from "@/lib/env";
import { createId } from "@/lib/ids";
import { isUniqueViolation } from "@/lib/sqlite";
import { domains } from "@runmail/db";
import type { Domain, PageMeta } from "@runmail/shared";
import { buildIdCursor, buildPageMeta } from "@runmail/shared";
import { desc } from "drizzle-orm";

export type DomainErrorCode = "DOMAIN_EXISTS" | "NOT_FOUND";

export type DomainError = { error: DomainErrorCode };

function toDomain(row: typeof domains.$inferSelect): Domain {
  return {
    id: row.id,
    domain_name: row.domain_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listDomains(
  c: AppContext,
  limit: number,
  cursorId: string | undefined,
): Promise<{ domains: Domain[]; meta: PageMeta }> {
  const db = getDb(c);
  const rows = await db.select().from(domains).orderBy(desc(domains.created_at), desc(domains.id));

  let start = 0;
  if (cursorId) {
    const idx = rows.findIndex((row) => row.id === cursorId);
    start = idx === -1 ? 0 : idx + 1;
  }

  const window = rows.slice(start, start + limit + 1);
  const meta = buildPageMeta(window, limit, (row) => ({
    ...buildIdCursor(row),
  }));
  return { domains: window.slice(0, limit).map(toDomain), meta };
}

export async function addDomain(
  c: AppContext,
  domainName: string,
): Promise<{ domain: Domain } | DomainError> {
  const db = getDb(c);
  const now = Date.now();

  try {
    const [row] = await db
      .insert(domains)
      .values({
        id: createId(),
        domain_name: domainName,
        created_at: now,
        updated_at: now,
      })
      .returning();
    return { domain: toDomain(row) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "DOMAIN_EXISTS" };
    }
    throw err;
  }
}
