export function rawObjectKey(mailboxId: string, messageId: string): string {
  return `mailboxes/${mailboxId}/messages/${messageId}.eml`;
}

export async function putRawEmail(
  env: { R2: R2Bucket },
  objectKey: string,
  value: ReadableStream | ArrayBuffer | string | Blob,
): Promise<R2Object> {
  return env.R2.put(objectKey, value).then((object) => {
    if (!object) throw new Error("R2_PUT_FAILED");
    return object;
  });
}

export async function getRawEmail(
  env: { R2: R2Bucket },
  objectKey: string,
): Promise<R2ObjectBody | null> {
  return env.R2.get(objectKey);
}

/**
 * Best-effort raw cleanup: D1 deletion already succeeded, R2 orphans
 * are acceptable.
 */
export async function deleteRawEmail(env: { R2: R2Bucket }, objectKey: string): Promise<void> {
  try {
    await env.R2.delete(objectKey);
  } catch {
    // best-effort cleanup: D1 deletion already succeeded, R2 orphans acceptable
  }
}
