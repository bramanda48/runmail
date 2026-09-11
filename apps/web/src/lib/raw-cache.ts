const RAW_CACHE = "runmail-raw-v1";

/**
 * Raw .eml storage uses the Browser Cache API (best-effort, no app TTL).
 * Keys are synthetic URLs — never fetched over the network; the Cache API
 * just needs Request keys. Moves do NOT invalidate; tombstone/permanent
 * delete and logout clean the relevant entries.
 */
export function rawCacheKey(mailboxId: string, messageId: string): Request {
  return new Request(`/api/v1/_raw/${mailboxId}/${messageId}.eml`);
}

async function openRawCache(): Promise<Cache> {
  return caches.open(RAW_CACHE);
}

export async function getCachedRaw(
  mailboxId: string,
  messageId: string
): Promise<Response | undefined> {
  const cache = await openRawCache();
  return cache.match(rawCacheKey(mailboxId, messageId));
}

export async function putCachedRaw(
  mailboxId: string,
  messageId: string,
  blob: Blob
): Promise<void> {
  try {
    const cache = await openRawCache();
    await cache.put(
      rawCacheKey(mailboxId, messageId),
      new Response(blob, {
        headers: { "Content-Type": "message/rfc822" }
      })
    );
  } catch {
    // Best-effort: quota errors must never break the surrounding flow.
  }
}

export async function deleteCachedRaw(mailboxId: string, messageId: string): Promise<void> {
  try {
    const cache = await openRawCache();
    await cache.delete(rawCacheKey(mailboxId, messageId));
  } catch {
    // Best-effort cleanup.
  }
}

export async function clearMailboxRawCache(mailboxId: string): Promise<void> {
  try {
    const cache = await openRawCache();
    const keys = await cache.keys();
    const prefix = `/api/v1/_raw/${mailboxId}/`;
    await Promise.all(keys.filter((k) => k.url.includes(prefix)).map((k) => cache.delete(k)));
  } catch {
    // Best-effort cleanup.
  }
}

export async function clearAllRawCaches(): Promise<void> {
  try {
    await caches.delete(RAW_CACHE);
  } catch {
    // Best-effort cleanup.
  }
}
