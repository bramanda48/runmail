import { sign, verify } from "hono/jwt";
import type { AppContext } from "./env";
import { deleteSetting, getSetting, SETTING_NAMES } from "../modules/settings/service";

type OAuthStatePayload = {
  type: "oauth_state";
  nonce: string;
  redirectUri: string;
  exp: number;
};

export async function generateOAuthState(secret: string, redirectUri: string): Promise<string> {
  const nonce = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const payload: OAuthStatePayload = {
    type: "oauth_state",
    nonce,
    redirectUri,
    exp
  };

  return await sign(payload, secret, "HS256");
}

export async function verifyOAuthState(
  secret: string,
  state: string
): Promise<{ valid: true; nonce: string; redirectUri: string } | { valid: false }> {
  try {
    const payload = (await verify(state, secret, "HS256")) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("type" in payload) ||
      !("nonce" in payload) ||
      !("redirectUri" in payload) ||
      payload.type !== "oauth_state" ||
      typeof payload.nonce !== "string" ||
      typeof payload.redirectUri !== "string"
    ) {
      return { valid: false };
    }

    return { valid: true, nonce: payload.nonce, redirectUri: payload.redirectUri };
  } catch {
    return { valid: false };
  }
}

export type CloudflareTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: "Bearer";
  scope: string;
};

export async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<CloudflareTokenResponse> {
  const tokenUrl = "https://dash.cloudflare.com/oauth2/token";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudflare token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as CloudflareTokenResponse;
}

export async function exchangeRefreshToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const tokenUrl = "https://dash.cloudflare.com/oauth2/token";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 400) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.error === "invalid_grant") {
          throw new Error("REFRESH_TOKEN_REVOKED");
        }
      } catch (parseErr) {
        // The caught error may itself be the revoked sentinel thrown above.
        if (parseErr instanceof Error && parseErr.message === "REFRESH_TOKEN_REVOKED") {
          throw parseErr;
        }
      }
    }

    throw new Error(`Cloudflare token refresh failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return data;
}

// Module-level cache works because workers reuse isolates across requests.
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;
let refreshPromise: Promise<string | null> | null = null;

export function setCachedAccessToken(accessToken: string, expiresInSec: number): void {
  cachedAccessToken = accessToken;
  tokenExpiresAt = Date.now() + expiresInSec * 1000;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export async function getCloudflareAccessToken(c: AppContext): Promise<string | null> {
  const env = c.env as {
    CLOUDFLARE_OAUTH_CLIENT_ID: string;
    CLOUDFLARE_OAUTH_CLIENT_SECRET: string;
  };

  // Refresh 1 minute before expiry.
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  if (refreshPromise) {
    return await refreshPromise;
  }

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const setting = await getSetting(c, SETTING_NAMES.CLOUDFLARE_OAUTH_TOKEN);
      if (!setting) {
        return null;
      }

      try {
        const tokenData = await exchangeRefreshToken({
          refreshToken: setting.value,
          clientId: env.CLOUDFLARE_OAUTH_CLIENT_ID,
          clientSecret: env.CLOUDFLARE_OAUTH_CLIENT_SECRET
        });

        setCachedAccessToken(tokenData.access_token, tokenData.expires_in);

        return cachedAccessToken;
      } catch (err) {
        if (err instanceof Error && err.message === "REFRESH_TOKEN_REVOKED") {
          await deleteSetting(c, SETTING_NAMES.CLOUDFLARE_OAUTH_TOKEN);
          clearCachedAccessToken();
          return null;
        }

        throw err;
      }
    } finally {
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
}
