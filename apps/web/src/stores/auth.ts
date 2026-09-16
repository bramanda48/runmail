import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { wipeLocalData } from "@/db/cleanup";
import {
  ApiError,
  loginRequest,
  logoutRequest,
  refreshRequest,
  type SessionUser,
  setAccessTokenProvider,
  setRefreshHandler
} from "@/lib/api";
import { useMailboxStore } from "@/stores/mailbox";

export const REFRESH_TOKEN_KEY = "runmail_refresh_token";

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

export const useAuthStore = defineStore("auth", () => {
  const accessToken = ref<string | null>(null);
  const user = ref<SessionUser | null>(null);
  const status = ref<AuthStatus>("idle");

  /** Single-flight refresh promise shared by restoreSession() and the api client. */
  let inflightRefresh: Promise<string | null> | null = null;

  function applySession(
    payload: { access_token: string; user: SessionUser },
    refreshToken: string
  ): void {
    accessToken.value = payload.access_token;
    user.value = payload.user;
    status.value = "authenticated";
    setStoredRefreshToken(refreshToken);
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
    status.value = "unauthenticated";
    clearStoredRefreshToken();
  }

  function performRefresh(): Promise<string | null> {
    const stored = getStoredRefreshToken();
    if (!stored) {
      status.value = "unauthenticated";
      return Promise.resolve(null);
    }
    return refreshRequest(stored).then(
      (payload) => {
        applySession(payload, payload.refresh_token);
        return accessToken.value;
      },
      (err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          // Multi-tab rotation tolerance: another tab may have rotated the
          // refresh token after this refresh started, so `stored` is stale and
          // the 401/403 may not apply to the token currently in storage.
          // Retry once with the new stored token before giving up.
          const nowStored = getStoredRefreshToken();
          if (nowStored && nowStored !== stored) {
            return refreshRequest(nowStored).then(
              (payload) => {
                applySession(payload, payload.refresh_token);
                return accessToken.value;
              },
              () => {
                clearSession(); // the rotated token was definitively rejected
                return null;
              }
            );
          }
          clearSession(); // definitive auth rejection: token is dead/revoked
        } else {
          // transient failure (network/server): keep the stored refresh token so
          // the next reload can restore the session; only update runtime state.
          accessToken.value = null;
          user.value = null;
          status.value = "unauthenticated";
        }
        return null;
      }
    );
  }

  /**
   * Single-flight refresh. Concurrent callers share one in-flight promise.
   * Returns the new access token, or null when the session could not be refreshed.
   */
  function refresh(): Promise<string | null> {
    if (!inflightRefresh) {
      inflightRefresh = performRefresh().finally(() => {
        inflightRefresh = null;
      });
    }
    return inflightRefresh;
  }

  async function login(username: string, password: string): Promise<SessionUser> {
    status.value = "loading";
    try {
      const payload = await loginRequest(username, password);
      applySession(payload, payload.refresh_token);
      return payload.user;
    } catch (err) {
      status.value = "unauthenticated";
      throw err;
    }
  }

  async function restoreSession(): Promise<boolean> {
    if (status.value === "authenticated" && accessToken.value) return true;
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
    useMailboxStore().closeMailbox();
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
    useMailboxStore().closeMailbox();
    try {
      await wipeLocalData();
    } catch {
      // Local cleanup must never throw.
    }
  }

  const isAuthenticated = computed(
    () => status.value === "authenticated" && accessToken.value !== null
  );
  const isAdmin = computed(() => user.value?.role === "admin");

  // Register this store as the token provider for the api client.
  // api.ts never imports the store, so there is no import cycle.
  setAccessTokenProvider(() => accessToken.value);
  setRefreshHandler(() => refresh());

  return {
    accessToken,
    user,
    status,
    login,
    restoreSession,
    logout,
    endSessionLocally,
    refresh,
    isAuthenticated,
    isAdmin
  };
});
