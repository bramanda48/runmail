import { domains } from "@runmail/db";
import type { Domain, PageMeta, VerifyDomainResponse } from "@runmail/shared";
import { buildIdCursor, buildPageMeta } from "@runmail/shared";
import { desc, eq } from "drizzle-orm";
import {
  CloudflareOAuthNotConfiguredError,
  getEmailRoutingStatus,
  listZones,
} from "../../lib/cloudflare";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import { isUniqueViolation } from "../../lib/sqlite";

// Re-export for routes error handling
export { CloudflareOAuthNotConfiguredError };

export type DomainErrorCode =
  "DOMAIN_EXISTS" | "DOMAIN_NOT_AVAILABLE" | "NOT_FOUND" | "OAUTH_NOT_CONFIGURED";

export type DomainError = { error: DomainErrorCode };

function toDomain(row: typeof domains.$inferSelect): Domain {
  return {
    id: row.id,
    domain_name: row.domain_name,
    verification_status: row.verification_status === "active" ? "active" : "pending_verification",
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

export async function listAvailableZones(
  c: AppContext,
): Promise<{ zones: Array<{ id: string; name: string }> }> {
  try {
    const zones = await listZones(c);
    const db = getDb(c);
    const existing = await db.select({ domain_name: domains.domain_name }).from(domains);
    const taken = new Set(existing.map((row) => row.domain_name));
    return { zones: zones.filter((zone) => !taken.has(zone.name)) };
  } catch (err) {
    // Re-throw CloudflareOAuthNotConfiguredError for route handler
    // This ensures consistent error handling pattern across all Cloudflare API calls
    if (err instanceof CloudflareOAuthNotConfiguredError) {
      throw err;
    }
    throw err;
  }
}

export async function addDomain(
  c: AppContext,
  domainName: string,
): Promise<{ domain: Domain } | DomainError> {
  try {
    const zones = await listZones(c);
    if (!zones.some((z) => z.name === domainName)) {
      return { error: "DOMAIN_NOT_AVAILABLE" };
    }

    const db = getDb(c);
    const now = Date.now();
    const id = uuidv7();

    try {
      await db.insert(domains).values({
        id,
        domain_name: domainName,
        verification_status: "pending_verification",
        created_at: now,
        updated_at: now,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { error: "DOMAIN_EXISTS" };
      }
      throw err;
    }

    const [row] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    if (!row) return { error: "NOT_FOUND" };
    return { domain: toDomain(row) };
  } catch (err) {
    if (err instanceof CloudflareOAuthNotConfiguredError) {
      return { error: "OAUTH_NOT_CONFIGURED" };
    }
    throw err;
  }
}

export type VerifyDomainResult = VerifyDomainResponse;

export async function verifyDomain(
  c: AppContext,
  domainId: string,
): Promise<VerifyDomainResult | DomainError> {
  const db = getDb(c);
  const [row] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
  if (!row) return { error: "NOT_FOUND" };

  try {
    const zones = await listZones(c);
    const zone = zones.find((z) => z.name === row.domain_name);
    if (!zone) {
      return {
        domain: toDomain(row),
        cf_status: null,
        verification_checked: false,
        reason: "zone_not_found",
      };
    }

    const cfStatus = await getEmailRoutingStatus(c, zone.id);
    const nextStatus = cfStatus?.status === "ready" ? "active" : "pending_verification";
    await db
      .update(domains)
      .set({ verification_status: nextStatus, updated_at: Date.now() })
      .where(eq(domains.id, domainId));

    const [fresh] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!fresh) return { error: "NOT_FOUND" };
    return {
      domain: toDomain(fresh),
      cf_status: cfStatus?.status ?? null,
      verification_checked: true,
    };
  } catch (err) {
    if (err instanceof CloudflareOAuthNotConfiguredError) {
      return { error: "OAUTH_NOT_CONFIGURED" };
    }
    throw err;
  }
}
