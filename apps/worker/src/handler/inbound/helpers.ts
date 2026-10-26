export const MAX_EMAIL_BYTES = 25 * 1024 * 1024;

export function parseEmailAddress(addr: string): { local_part: string; domain: string } | null {
  const at = addr.lastIndexOf("@");
  if (at === -1) return null;
  const localPart = addr.slice(0, at).toLowerCase();
  const domain = addr.slice(at + 1).toLowerCase();
  if (localPart === "" || domain === "") return null;
  return { local_part: localPart, domain };
}

export function serializeHeaders(headers: { key: string; value: string }[]): string {
  return headers.map((h) => `${h.key}: ${h.value}`).join("\n");
}

export function normalizeSnippet(text: string | null, max = 200): string {
  if (text === null || text === "") return "";
  // avoids regex-replacing multi-MB text bodies for a 200-char snippet
  return text.slice(0, 10_000).replace(/\s+/g, " ").trim().slice(0, max);
}

export function resolveEmailDate(
  dateHeader: string | null | undefined,
  receivedAt: number,
): number {
  if (dateHeader === null || dateHeader === undefined) return receivedAt;
  const parsed = Date.parse(dateHeader);
  return Number.isNaN(parsed) ? receivedAt : parsed;
}

export function findHeader(headers: { key: string; value: string }[], name: string): string | null {
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (h.key.toLowerCase() === lower) return h.value;
  }
  return null;
}

export const MAX_RECIPIENT_ROWS = 90;

export type ParsedRecipient = { address?: string; name?: string };

// Bounds the ingest db.batch under D1's 100-statement cap; recipients beyond
// the cap are dropped from the metadata index only (raw RFC-822 in R2 remains complete).
export function buildRecipientRows(
  to: ParsedRecipient[],
  cc: ParsedRecipient[],
  bcc: ParsedRecipient[],
): {
  recipient_type: "to" | "cc" | "bcc";
  address: string;
  name: string | null;
}[] {
  const tag = (
    list: ParsedRecipient[],
    recipient_type: "to" | "cc" | "bcc",
  ): {
    recipient_type: "to" | "cc" | "bcc";
    address: string;
    name: string | null;
  }[] =>
    list.flatMap((r) => {
      if (typeof r.address !== "string" || r.address === "") return [];
      return [
        {
          recipient_type,
          address: r.address,
          name: typeof r.name === "string" && r.name !== "" ? r.name : null,
        },
      ];
    });
  return [...tag(to, "to"), ...tag(cc, "cc"), ...tag(bcc, "bcc")].slice(0, MAX_RECIPIENT_ROWS);
}
