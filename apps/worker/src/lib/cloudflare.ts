import { getCloudflareAccessToken } from "@/lib/cloudflare-auth";
import type { AppContext } from "@/lib/env";
import { EmailRouting, Zones } from "cloudflare/resources";
import { createClient } from "cloudflare/tree-shakable";

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

export async function getZone(c: AppContext, zoneId: string): Promise<Zones.Zone | null> {
  const client = await createCloudflareClient(c);

  try {
    return await client.zones.get({ zone_id: zoneId });
  } catch {
    return null;
  }
}
