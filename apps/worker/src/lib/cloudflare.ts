export interface CloudflareEnv {
  CLOUDFLARE_API_TOKEN: string;
}

export interface ZoneSummary {
  id: string;
  name: string;
}

export interface EmailRoutingStatus {
  enabled: boolean;
  status: string;
}

const API_BASE = "https://api.cloudflare.com/client/v4";

function authHeaders(env: CloudflareEnv): Record<string, string> {
  return { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` };
}

function isSuccessBody(body: unknown): body is {
  success: boolean;
  result: Array<{ id: string; name: string }>;
} {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { success?: unknown }).success === true &&
    Array.isArray((body as { result?: unknown }).result)
  );
}

export async function listZones(env: CloudflareEnv): Promise<ZoneSummary[]> {
  const zones: ZoneSummary[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${API_BASE}/zones?per_page=50&page=${page}`, {
        headers: authHeaders(env),
        signal: AbortSignal.timeout(10_000)
      });
      const body: unknown = await res.json().catch(() => null);
      if (!isSuccessBody(body)) {
        throw new Error("CLOUDFLARE_API_ERROR");
      }
      for (const zone of body.result) {
        zones.push({ id: zone.id, name: zone.name });
      }
      if (body.result.length < 50) break;
    }
  } catch (err) {
    if (err instanceof Error && err.message === "CLOUDFLARE_API_ERROR") {
      throw err;
    }
    throw new Error("CLOUDFLARE_API_ERROR");
  }
  return zones;
}

export async function getEmailRoutingStatus(
  env: CloudflareEnv,
  zoneId: string
): Promise<EmailRoutingStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/zones/${zoneId}/email/routing`, {
      headers: authHeaders(env),
      signal: AbortSignal.timeout(10_000)
    });
    if (res.status === 404) return null;
    const body: unknown = await res.json().catch(() => null);
    if (
      typeof body !== "object" ||
      body === null ||
      (body as { success?: unknown }).success !== true ||
      typeof (body as { result?: unknown }).result !== "object" ||
      (body as { result?: null }).result === null
    ) {
      throw new Error("CLOUDFLARE_API_ERROR");
    }
    const result = (body as { result: { enabled: unknown; status: unknown } }).result;
    return {
      enabled: result.enabled === true,
      status: typeof result.status === "string" ? result.status : ""
    };
  } catch (err) {
    if (err instanceof Error && err.message === "CLOUDFLARE_API_ERROR") {
      throw err;
    }
    throw new Error("CLOUDFLARE_API_ERROR");
  }
}
