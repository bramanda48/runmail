import { wipeLocalData } from "@/db/cleanup";
import {
  ApiError,
  fetchJwks,
  getMe,
  loginRequest,
  logoutRequest,
  refreshRequest,
  setAccessTokenProvider,
  setRefreshHandler,
  setupRequest,
  type AuthPayload,
  type JwksKey,
  type SessionUser,
} from "@/lib/api";
import {
  setCloudflareAccessTokenProvider,
  setCloudflareRefreshHandler,
} from "@/lib/cloudflare-client";
import { useMailboxStore } from "@/stores/mailbox";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const REFRESH_TOKEN_KEY = "runmail_refresh_token";
export const ACCESS_TOKEN_KEY = "runmail_access_token";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export function getStoredRefreshToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearStoredRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredAccessToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessToken(token: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // Best-effort: private mode quota errors must not break login.
  }
}

export function clearStoredAccessToken(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Best-effort cleanup.
  }
}

type CachedJwks = { keys: Map<string, CryptoKey>; fetchedAt: number };

let jwksCache: CachedJwks | null = null;
let lastFetchFail = 0;
const JWKS_FAIL_COOLDOWN_MS = 60000;

function base64UrlToBytes(segment: string): Uint8Array | null {
  try {
    let base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad === 2) base64 += "==";
    else if (pad === 3) base64 += "=";
    else if (pad !== 0) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

type JwkEntry = { kty: "RSA"; n: string; e: string; kid: string };

function isJwkEntry(value: unknown): value is JwkEntry {
  if (typeof value !== "object" || value === null) return false;
  if (!("kty" in value) || !("n" in value) || !("e" in value) || !("kid" in value)) return false;
  if (value.kty !== "RSA") return false;
  if (typeof value.n !== "string") return false;
  if (typeof value.e !== "string") return false;
  if (typeof value.kid !== "string") return false;
  return true;
}

async function getKeyForKid(kid: string): Promise<CryptoKey | null> {
  if (jwksCache) {
    const cached = jwksCache.keys.get(kid);
    if (cached) return cached;
    // Unknown kid: fall through to refetch once (key rotation support).
  } else if (Date.now() - lastFetchFail < JWKS_FAIL_COOLDOWN_MS) {
    return null;
  }
  let keys: JwksKey[];
  try {
    const getJwks = await fetchJwks();
    keys = getJwks.keys;
  } catch {
    lastFetchFail = Date.now();
    return jwksCache?.keys.get(kid) ?? null;
  }
  if (!Array.isArray(keys)) {
    lastFetchFail = Date.now();
    return jwksCache?.keys.get(kid) ?? null;
  }
  try {
    const next = new Map<string, CryptoKey>();
    for (const entry of keys) {
      if (!isJwkEntry(entry)) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "RSA", n: entry.n, e: entry.e, alg: "RS256", ext: true },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      next.set(entry.kid, key);
    }
    jwksCache = { keys: next, fetchedAt: Date.now() };
    return next.get(kid) ?? null;
  } catch {
    lastFetchFail = Date.now();
    return jwksCache?.keys.get(kid) ?? null;
  }
}

type DecodedJwt = { header: Record<string, unknown>; payload: Record<string, unknown> };

function decodeSegment(segment: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(segment);
  if (!bytes) return null;
  try {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const parsed: unknown = JSON.parse(binary);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodeSegment(parts[0] ?? "");
  const payload = decodeSegment(parts[1] ?? "");
  if (!header || !payload) return null;
  return { header, payload };
}

async function verifyAccessTokenLocal(token: string): Promise<boolean> {
  try {
    const decoded = decodeJwt(token);
    if (!decoded) return false;
    const { header, payload } = decoded;

    if (!("alg" in header) || !("kid" in header) || !("exp" in payload)) return false;
    if (header.alg !== "RS256") return false;

    const kid: unknown = header.kid;
    if (typeof kid !== "string") return false;

    const nowDate: Date = new Date();
    const expDate: Date = new Date(Number(payload.exp) * 1000);
    if (nowDate > expDate) return false;

    const key = await getKeyForKid(kid);
    if (!key) return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const signature = base64UrlToBytes(parts[2] ?? "");
    if (!signature) return false;
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const ok = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      signature.buffer.slice(
        signature.byteOffset,
        signature.byteOffset + signature.byteLength,
      ) as ArrayBuffer,
      signingInput,
    );
    return ok;
  } catch {
    return false;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const mailboxStore = useMailboxStore();

  const accessToken = ref<string | null>(null);
  const user = ref<SessionUser | null>(null);
  const status = ref<AuthStatus>("idle");

  /** Single-flight refresh promise shared by restoreSession() and the api client. */
  let inflightRefresh: Promise<string | null> | null = null;

  // Stores tokens, then hydrates the user from GET /auth/me. The user is never
  // cached in storage; every reload re-fetches it from the server.
  async function applySession(
    payload: { access_token: string },
    refreshToken: string,
  ): Promise<SessionUser> {
    accessToken.value = payload.access_token;
    status.value = "authenticated";
    setStoredRefreshToken(refreshToken);
    setStoredAccessToken(payload.access_token);
    try {
      const { user: me } = await getMe();
      user.value = me;
      return me;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Token rejected by the server: drop everything like a failed login.
        clearSession();
        throw err;
      }
      // Transient failure (network/server): keep the stored tokens so the next
      // reload can restore the session; only clear runtime state.
      accessToken.value = null;
      user.value = null;
      status.value = "unauthenticated";
      throw err;
    }
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
    status.value = "unauthenticated";
    clearStoredRefreshToken();
    clearStoredAccessToken();
  }

  async function performRefresh(): Promise<string | null> {
    const stored = getStoredRefreshToken();
    if (!stored) {
      status.value = "unauthenticated";
      return null;
    }
    try {
      const payload = await refreshRequest(stored);
      await applySession(payload, payload.refresh_token);
      return accessToken.value;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        // Multi-tab rotation tolerance: another tab may have rotated the
        // refresh token after this refresh started, so `stored` is stale and
        // the 401/403 may not apply to the token currently in storage.
        // Retry once with the new stored token before giving up.
        const nowStored = getStoredRefreshToken();
        if (nowStored && nowStored !== stored) {
          let retryPayload: AuthPayload | null;
          try {
            retryPayload = await refreshRequest(nowStored);
          } catch {
            retryPayload = null;
          }
          if (!retryPayload) {
            clearSession(); // the rotated token was definitively rejected
            return null;
          }
          // applySession sets the correct state on success or /me failure.
          try {
            await applySession(retryPayload, retryPayload.refresh_token);
            return accessToken.value;
          } catch {
            return null;
          }
        }
        clearSession(); // definitive auth rejection: token is dead/revoked
      } else {
        // Transient failure (network/server): keep the stored refresh token so
        // the next reload can restore the session; only update runtime state.
        accessToken.value = null;
        user.value = null;
        status.value = "unauthenticated";
      }
      return null;
    }
  }

  /**
   * Single-flight refresh. Concurrent callers share one in-flight promise.
   * Returns the new access token, or null when the session could not be refreshed.
   */
  function refresh(): Promise<string | null> {
    if (!inflightRefresh) {
      inflightRefresh = performRefresh().finally(() => {
        inflightRefresh = null;
        fetchJwks("reload");
      });
    }
    return inflightRefresh;
  }

  async function login(username: string, password: string): Promise<SessionUser> {
    status.value = "loading";
    try {
      const payload = await loginRequest(username, password);
      const user = await applySession(payload, payload.refresh_token);
      return user;
    } catch (err) {
      status.value = "unauthenticated";
      throw err;
    }
  }

  async function setup(username: string, password: string): Promise<SessionUser> {
    status.value = "loading";
    try {
      const payload = await setupRequest(username, password);
      const user = await applySession(payload, payload.refresh_token);
      return user;
    } catch (err) {
      status.value = "unauthenticated";
      throw err;
    }
  }

  async function restoreSession(): Promise<boolean> {
    if (status.value === "authenticated" && accessToken.value) return true;
    const storedToken = getStoredAccessToken();
    if (storedToken) {
      const valid = await verifyAccessTokenLocal(storedToken);
      if (valid) {
        accessToken.value = storedToken;
        status.value = "authenticated";
        try {
          // Single GET /me hydrates the user on every reload.
          const { user: me } = await getMe();
          user.value = me;
          return true;
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            // Stored token rejected by the server: drop it and try refresh.
            clearSession();
          } else {
            // Transient failure: clear runtime state but keep the stored refresh
            // token; refresh() below retries or fails with stored tokens intact.
            accessToken.value = null;
            user.value = null;
            status.value = "unauthenticated";
          }
        }
      } else {
        clearStoredAccessToken();
      }
    }
    const token = await refresh();
    return token !== null;
  }

  async function logout(): Promise<void> {
    const stored = getStoredRefreshToken();
    if (stored) {
      try {
        await logoutRequest(stored);
      } catch {
        // Best-effort: server logout failure must not block local cleanup.
      }
    }
    clearSession();
    mailboxStore.closeMailbox();
    try {
      // R6: logout wipes all per-mailbox Dexie DBs + cached raws on this device.
      await wipeLocalData();
    } catch {
      // Local cleanup must never block logout.
    }
  }

  /**
   * Clears the local session + all on-device data without contacting the
   * server. Used after a successful password change (SCR-8): the server has
   * revoked all refresh tokens, so the client just drops everything and goes
   * back to login.
   */
  async function endSessionLocally(): Promise<void> {
    clearSession();
    mailboxStore.closeMailbox();
    try {
      await wipeLocalData();
    } catch {
      // Local cleanup must never throw.
    }
  }

  const isAuthenticated = computed(
    () => status.value === "authenticated" && accessToken.value !== null,
  );
  const isAdmin = computed(() => user.value?.role === "admin");

  // Register this store as the token provider for the api client.
  // api.ts never imports the store, so there is no import cycle.
  setAccessTokenProvider(() => accessToken.value);
  setRefreshHandler(() => refresh());
  setCloudflareAccessTokenProvider(() => accessToken.value);
  setCloudflareRefreshHandler(() => refresh());

  return {
    accessToken,
    user,
    status,
    login,
    setup,
    restoreSession,
    logout,
    endSessionLocally,
    refresh,
    isAuthenticated,
    isAdmin,
  };
});
