export const PAGINATION_DEFAULT_LIMIT = 10;
export const PAGINATION_MAX_LIMIT = 100;

const CURSOR_VERSION = "v1";
const CURSOR_PREFIX = `${CURSOR_VERSION}_`;

export interface MessageCursorPayload {
  email_date: number;
  message_id: string;
}

export interface IdCursorPayload {
  id: string;
}

export interface PageMeta {
  next_cursor: string | null;
  has_more: boolean;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = base64.length % 4;
    if (padding === 1) return null;
    if (padding > 0) base64 += "=".repeat(4 - padding);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return `${CURSOR_PREFIX}${bytesToBase64Url(bytes)}`;
}

export function decodeCursor<T>(cursor: string): T | null {
  if (!cursor.startsWith(CURSOR_PREFIX)) return null;
  const bytes = base64UrlToBytes(cursor.slice(CURSOR_PREFIX.length));
  if (!bytes) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Builds page metadata using the limit+1 fetch trick.
 *
 * Pass the raw fetched rows (up to `limit + 1`). If more rows were returned
 * than `limit`, `has_more` is true and the cursor encodes the sort key of the
 * last row that is actually included on this page (the extra row is dropped).
 */
export function buildPageMeta<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => Record<string, unknown>
): PageMeta {
  const hasMore = rows.length > limit;
  const included = hasMore ? rows.slice(0, limit) : rows;
  let next_cursor: string | null = null;
  if (hasMore && included.length > 0) {
    next_cursor = encodeCursor(toCursor(included[included.length - 1]));
  }
  return { next_cursor, has_more: hasMore };
}

export function buildMessageCursor(row: {
  email_date: number;
  message_id: string;
}): MessageCursorPayload {
  return { email_date: row.email_date, message_id: row.message_id };
}

export function buildIdCursor<T extends { id: string }>(row: T): IdCursorPayload {
  return { id: row.id };
}
