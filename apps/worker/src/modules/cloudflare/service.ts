import { CloudflareOAuthNotConfiguredError } from "@/lib/cloudflare";
import {
  clearCachedAccessToken,
  exchangeAuthorizationCode,
  generateCloudflareState,
  getCloudflareAccessToken,
  setCachedAccessToken,
  verifyCloudflareState,
  type CloudflareTokenResponse,
} from "@/lib/cloudflare-auth";
import type { AppContext } from "@/lib/env";
import { clearCloudflareToken, getSettings, updateSettings } from "@/modules/settings";

const CLOUDFLARE_OAUTH_SCOPES = [
  "zone.read",
  "zone-settings.read",
  "zone-settings.write",
  "email-routing-rule.read",
  "email-routing-rule.write",
  "workers-scripts.metadata_read",
  "offline_access",
].join(" ");

export async function getAuthorizationUrl(
  c: AppContext,
  redirectUri: string,
): Promise<{ url: string; state: string }> {
  // c.env is typed as the generic CloudflareBindings; narrow it here so a
  // missing CLOUDFLARE_OAUTH_CLIENT_ID fails typecheck instead of runtime.
  const oauthEnv: { CLOUDFLARE_OAUTH_CLIENT_ID: string } = c.env;
  const clientId = oauthEnv.CLOUDFLARE_OAUTH_CLIENT_ID;
  const state = await generateCloudflareState(c, redirectUri);

  const authUrl = new URL("https://dash.cloudflare.com/oauth2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", CLOUDFLARE_OAUTH_SCOPES);
  authUrl.searchParams.set("state", state);

  return { url: authUrl.toString(), state };
}

export async function handleCloudflareCallback(
  c: AppContext,
  params: {
    code: string;
    state: string;
    redirectUri?: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  // Same narrowing as getAuthorizationUrl above: surface missing secrets at compile time.
  const env: {
    CLOUDFLARE_OAUTH_CLIENT_ID: string;
    CLOUDFLARE_OAUTH_CLIENT_SECRET: string;
  } = c.env;

  const stateResult = await verifyCloudflareState(c, params.state);
  if (!stateResult.valid) {
    return { success: false, error: "Invalid or expired state parameter" };
  }

  // Redirect URI lives in the state JWT; an explicit param is only a compat check.
  const redirectUri = stateResult.redirectUri;
  if (params.redirectUri !== undefined && params.redirectUri !== redirectUri) {
    return { success: false, error: "Redirect URI mismatch" };
  }

  let tokenResponse: CloudflareTokenResponse;
  try {
    tokenResponse = await exchangeAuthorizationCode({
      code: params.code,
      clientId: env.CLOUDFLARE_OAUTH_CLIENT_ID,
      clientSecret: env.CLOUDFLARE_OAUTH_CLIENT_SECRET,
      redirectUri,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Token exchange failed: ${message}` };
  }

  await updateSettings(c, {
    cloudflare_oauth_token: tokenResponse.refresh_token,
  });

  setCachedAccessToken(tokenResponse.access_token, tokenResponse.expires_in);

  return { success: true };
}

export async function isCloudflareConfigured(c: AppContext): Promise<boolean> {
  const row = await getSettings(c);
  return row?.cloudflare_oauth_token != null;
}

export async function disconnectCloudflare(c: AppContext): Promise<void> {
  await clearCloudflareToken(c);
  clearCachedAccessToken();
}

export async function proxyCloudflareRequest(
  c: AppContext,
  upstreamPath: string,
): Promise<{ accessToken: string; upstreamUrl: string }> {
  const accessToken = await getCloudflareAccessToken(c);
  if (!accessToken) {
    throw new CloudflareOAuthNotConfiguredError();
  }
  const normalized = upstreamPath.replace(/^\/+/, "");
  return {
    accessToken,
    upstreamUrl: `https://api.cloudflare.com/client/v4/${normalized}`,
  };
}
