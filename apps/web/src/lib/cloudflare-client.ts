import Cloudflare from "cloudflare";

/**
 * Cloudflare SDK wired through the worker OAuth proxy.
 *
 * The real Cloudflare API token lives in the worker (OAuth vault). The web
 * app only holds the Runmail JWT, so this client must never send a
 * Cloudflare `Authorization` header of its own. Instead every request is
 * transported through `/api/v1/integrations/cloudflare/proxy/*`, where
 * `request()` attaches the Runmail JWT and the worker swaps in the
 * Cloudflare token before forwarding upstream.
 *
 * The official SDK requires some credential before it builds requests
 * (otherwise `authHeaders` throws). A dummy token is supplied so request
 * construction succeeds, then the custom `fetch` below strips any
 * Cloudflare `Authorization` header, rewrites the URL to the proxy prefix,
 * and attaches the Runmail JWT from the provider hook below (wired by the
 * auth store callsite).
 */

export const CLOUDFLARE_PROXY_PREFIX = "/api/v1/integrations/cloudflare/proxy";

type AccessTokenProvider = () => string | null;
type RefreshHandler = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider = () => null;
let refreshHandler: RefreshHandler = async () => null;

export function setCloudflareAccessTokenProvider(fn: AccessTokenProvider): void {
  accessTokenProvider = fn;
}
export function setCloudflareRefreshHandler(fn: RefreshHandler): void {
  refreshHandler = fn;
}

function stripCloudflareAuthHeaders(headers: Headers): void {
  headers.delete("authorization");
  headers.delete("X-Auth-Key");
  headers.delete("X-Auth-Email");
  headers.delete("X-Auth-User-Service-Key");
}

/**
 * `fetch` implementation for the Cloudflare SDK. Rewrites absolute
 * `https://api.cloudflare.com/client/v4/...` URLs to the same-origin proxy
 * prefix, drops SDK auth headers, and attaches the Runmail JWT.
 * On 401 with a stored token, refreshes once and retries (mirrors api.ts).
 */
function buildProxyRequest(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  token: string,
): { url: string; init: RequestInit } {
  const url = new URL(typeof input === "string" ? input : input.toString());
  const upstreamPath = `${url.pathname.replace(/^\/client\/v4\/?/, "")}${url.search}`;
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  stripCloudflareAuthHeaders(headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return {
    url: `${CLOUDFLARE_PROXY_PREFIX}/${upstreamPath}`,
    init: {
      method: init?.method ?? (input instanceof Request ? input.method : "GET"),
      headers,
      body: init?.body ?? (input instanceof Request ? input.body : undefined),
    },
  };
}

async function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = accessTokenProvider();
  if (!token) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }
  const { url, init: reqInit } = buildProxyRequest(input, init, token);
  const res = await fetch(url, reqInit);
  if (res.status !== 401) return res;
  const refreshed = await refreshHandler();
  if (!refreshed) return res;
  const retried = buildProxyRequest(input, init, refreshed);
  return fetch(retried.url, retried.init);
}

export const cloudflareClient = new Cloudflare({
  fetch: proxyFetch,
});
