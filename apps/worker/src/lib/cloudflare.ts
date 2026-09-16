import { EmailRouting } from "cloudflare/resources/email-routing/email-routing";
import { Zones } from "cloudflare/resources/zones/zones";
import { createClient } from "cloudflare/tree-shakable";

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

export async function listZones(env: CloudflareEnv): Promise<ZoneSummary[]> {
  const client = createClient({
    resources: [Zones, EmailRouting],
    apiToken: env.CLOUDFLARE_API_TOKEN,
    logLevel: "off",
    timeout: 10_000
  });

  const zones: ZoneSummary[] = [];
  for await (const zone of client.zones.list({ per_page: 50 })) {
    zones.push({ id: zone.id, name: zone.name });
    if (zones.length >= 500) break;
  }
  return zones;
}

export async function getEmailRoutingStatus(
  env: CloudflareEnv,
  zoneId: string
): Promise<EmailRoutingStatus | null> {
  const client = createClient({
    resources: [Zones, EmailRouting],
    apiToken: env.CLOUDFLARE_API_TOKEN,
    logLevel: "off"
  });

  try {
    const settings = await client.emailRouting.get({ zone_id: zoneId });
    return {
      enabled: settings.enabled === true,
      status: typeof settings.status === "string" ? settings.status : ""
    };
  } catch (err: unknown) {
    if (err instanceof Error && ("status" in err ? err.status === 404 : /404/.test(err.message)))
      return null;
    throw err;
  }
}
