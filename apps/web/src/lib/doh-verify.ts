export interface DohCheckResult {
  found: boolean;
  answers: string[];
}

interface DohJsonResponse {
  Answer?: Array<{ data?: string }>;
}

export function normalizeDnsValue(value: string): string {
  // DoH splits long TXT into 255-char chunks joined as `"..." "..."`.
  const unchunked = value.toLowerCase().replace(/"\s+"/g, "");
  return unchunked.replace(/^"|"$/g, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");
}

/**
 * Join DoH TXT chunk splits for display (`"aaa" "bbb"` → `"aaabbb"`).
 * Case and outer quotes preserved — only the split boundary is removed.
 */
export function unchunkDnsValue(value: string): string {
  return value.replace(/"\s+"/g, "");
}

/**
 * MX answers carry a priority prefix (`30 route2.mx.cloudflare.net`).
 * Priorities legitimately differ from the proxy expectation, so compare
 * the hostname only. Non-MX values pass through unchanged.
 */
export function normalizeMxValue(value: string): string {
  const normalized = normalizeDnsValue(value);
  const withoutPriority = normalized.replace(/^\d+\s+/, "");
  return withoutPriority.includes(" ") ? normalized : withoutPriority;
}

export async function checkDnsViaDoh(
  name: string,
  type: string,
  expected: string,
  fetchFn: typeof fetch = fetch,
): Promise<DohCheckResult> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetchFn(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) {
    throw new Error(`DoH request failed: ${res.status}`);
  }
  const json = (await res.json()) as DohJsonResponse;
  const answers = Array.isArray(json.Answer) ? json.Answer : [];
  const raw = answers.filter((a) => typeof a.data === "string").map((a) => a.data as string);
  const want = normalizeDnsValue(expected);
  const found = raw.some((data) => normalizeDnsValue(data) === want);
  return { found, answers: raw };
}

export async function checkDnsGroupViaDoh(
  names: string[],
  type: string,
  expectedParts: string[],
  fetchFn: typeof fetch = fetch,
): Promise<DohCheckResult> {
  if (expectedParts.length === 0) return { found: false, answers: [] };
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(names[0])}&type=${encodeURIComponent(type)}`;
  const res = await fetchFn(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) {
    throw new Error(`DoH request failed: ${res.status}`);
  }
  const json = (await res.json()) as DohJsonResponse;
  const answers = Array.isArray(json.Answer) ? json.Answer : [];
  const normalize = type.toUpperCase() === "MX" ? normalizeMxValue : normalizeDnsValue;
  const raws = answers.filter((a) => typeof a.data === "string").map((a) => a.data as string);
  const normalized = raws.map((data) => normalize(data));
  const found = expectedParts.every((part) => normalized.includes(normalize(part)));
  return { found, answers: raws };
}
