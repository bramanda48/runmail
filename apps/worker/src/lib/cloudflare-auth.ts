import { toBase64Url } from "@/lib/encoding";
import type { AppContext } from "@/lib/env";
import { ensureKeypair, fromBase64Url, publicKeyOnly } from "@/modules/auth/keypair";
import { clearCloudflareToken, getSettings, updateSettings } from "@/modules/settings/service";

type CloudflareStatePayload = {
  type: "cloudflare_state";
  nonce: string;
  redirectUri: string;
  exp: number;
};

export async function generateCloudflareState(c: AppContext, redirectUri: string): Promise<string> {
  const { privateKey } = await ensureKeypair(c);
  const nonce = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const headerB64 = toBase64Url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payload: CloudflareStatePayload = {
    type: "cloudflare_state",
    nonce,
    redirectUri,
    exp,
  };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  return `${headerB64}.${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyCloudflareState(
  c: AppContext,
  state: string,
): Promise<{ valid: true; nonce: string; redirectUri: string } | { valid: false }> {
  try {
    const publicKey = await publicKeyOnly(c);
    const parts = state.split(".");
    if (parts.length !== 3) return { valid: false };
    const stateHeader = parts[0] as string;
    const statePayload = parts[1] as string;
    const stateSig = parts[2] as string;
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      fromBase64Url(stateSig),
      new TextEncoder().encode(`${stateHeader}.${statePayload}`),
    );
    if (!ok) return { valid: false };
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(statePayload))) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("type" in payload) ||
      !("nonce" in payload) ||
      !("redirectUri" in payload) ||
      !("exp" in payload) ||
      payload.type !== "cloudflare_state" ||
      typeof payload.nonce !== "string" ||
      typeof payload.redirectUri !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return { valid: false };
    }
    if (payload.exp <= Math.floor(Date.now() / 1000)) return { valid: false };

    return { valid: true, nonce: payload.nonce, redirectUri: payload.redirectUri };
  } catch {
    return { valid: false };
  }
}

export type CloudflareTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
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
    client_secret: params.clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
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
}): Promise<CloudflareTokenResponse> {
  const tokenUrl = "https://dash.cloudflare.com/oauth2/token";

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
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

  return (await response.json()) as CloudflareTokenResponse;
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
      const row = await getSettings(c);
      if (!row?.cloudflare_oauth_token) {
        return null;
      }

      try {
        const tokenData = await exchangeRefreshToken({
          refreshToken: row.cloudflare_oauth_token,
          clientId: env.CLOUDFLARE_OAUTH_CLIENT_ID,
          clientSecret: env.CLOUDFLARE_OAUTH_CLIENT_SECRET,
        });

        await updateSettings(c, {
          cloudflare_oauth_token: tokenData.refresh_token,
        });

        setCachedAccessToken(tokenData.access_token, tokenData.expires_in);
        return cachedAccessToken;
      } catch (err) {
        if (err instanceof Error && err.message === "REFRESH_TOKEN_REVOKED") {
          await clearCloudflareToken(c);
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
