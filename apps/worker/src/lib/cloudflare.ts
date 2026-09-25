import { EmailRouting } from "cloudflare/resources/email-routing/email-routing";
import { Zones } from "cloudflare/resources/zones/zones";
import { createClient } from "cloudflare/tree-shakable";
import type { AppContext } from "./env";
import { getCloudflareAccessToken } from "./oauth";

export interface ZoneSummary {
  id: string;
  name: string;
}

export interface EmailRoutingStatus {
  enabled: boolean;
  status: string;
}

export class CloudflareOAuthNotConfiguredError extends Error {
  constructor() {
    super("CLOUDFLARE_OAUTH_NOT_CONFIGURED");
    this.name = "CloudflareOAuthNotConfiguredError";
  }
}

async function createCloudflareClient(c: AppContext) {
  const accessToken = await getCloudflareAccessToken(c);

  if (!accessToken) {
    throw new CloudflareOAuthNotConfiguredError();
  }

  return createClient({
    resources: [Zones, EmailRouting],
    apiToken: accessToken,
    logLevel: "off",
    timeout: 10_000,
  });
}

export async function listZones(c: AppContext): Promise<ZoneSummary[]> {
  const client = await createCloudflareClient(c);

  const zones: ZoneSummary[] = [];
  for await (const zone of client.zones.list({ per_page: 50 })) {
    zones.push({ id: zone.id, name: zone.name });
    if (zones.length >= 500) break;
  }
  return zones;
}

export async function getEmailRoutingStatus(
  c: AppContext,
  zoneId: string,
): Promise<EmailRoutingStatus | null> {
  const client = await createCloudflareClient(c);

  try {
    const settings = await client.emailRouting.get({ zone_id: zoneId });
    return {
      enabled: settings.enabled === true,
      status: typeof settings.status === "string" ? settings.status : "",
    };
  } catch (err: unknown) {
    if (err instanceof Error && ("status" in err ? err.status === 404 : /404/.test(err.message)))
      return null;
    throw err;
  }
}
