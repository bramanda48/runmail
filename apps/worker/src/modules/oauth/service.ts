import type { AppContext } from "../../lib/env";
import {
  clearCachedAccessToken,
  exchangeAuthorizationCode,
  generateOAuthState,
  setCachedAccessToken,
  verifyOAuthState,
  type CloudflareTokenResponse,
} from "../../lib/oauth";
import { deleteSetting, getSetting, SETTING_NAMES, upsertSetting } from "../settings";

const CLOUDFLARE_OAUTH_SCOPES = [
  "zone.read",
  "zone-settings.read",
  "zone-settings.write",
  "email-routing-rule.read",
  "offline_access",
].join(" ");

export async function getAuthorizationUrl(
  env: {
    CLOUDFLARE_OAUTH_CLIENT_ID: string;
    JWT_SIGNING_SECRET: string;
  },
  redirectUri: string,
): Promise<{ url: string; state: string }> {
  const state = await generateOAuthState(env.JWT_SIGNING_SECRET, redirectUri);

  const authUrl = new URL("https://dash.cloudflare.com/oauth2/auth");
  authUrl.searchParams.set("client_id", env.CLOUDFLARE_OAUTH_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", CLOUDFLARE_OAUTH_SCOPES);
  authUrl.searchParams.set("state", state);

  return { url: authUrl.toString(), state };
}

export async function handleOAuthCallback(
  c: AppContext,
  params: {
    code: string;
    state: string;
    redirectUri?: string;
  },
): Promise<{ success: true } | { success: false; error: string }> {
  const env = c.env as {
    CLOUDFLARE_OAUTH_CLIENT_ID: string;
    CLOUDFLARE_OAUTH_CLIENT_SECRET: string;
    JWT_SIGNING_SECRET: string;
  };

  const stateResult = await verifyOAuthState(env.JWT_SIGNING_SECRET, params.state);
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

  await upsertSetting(c, SETTING_NAMES.CLOUDFLARE_OAUTH_TOKEN, tokenResponse.refresh_token);

  setCachedAccessToken(tokenResponse.access_token, tokenResponse.expires_in);

  return { success: true };
}

export async function isOAuthConfigured(c: AppContext): Promise<boolean> {
  const setting = await getSetting(c, SETTING_NAMES.CLOUDFLARE_OAUTH_TOKEN);
  return setting !== null;
}

export async function disconnectOAuth(c: AppContext): Promise<void> {
  await deleteSetting(c, SETTING_NAMES.CLOUDFLARE_OAUTH_TOKEN);
  clearCachedAccessToken();
}
