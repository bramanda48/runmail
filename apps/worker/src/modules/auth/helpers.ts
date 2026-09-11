import { argon2id, argon2Verify } from "hash-wasm";
import { sign, verify } from "hono/jwt";
import { bytesToHex, toBase64Url } from "../../lib/encoding";
import { uuidv7 } from "../../lib/ids";

export { uuidv7 };

// Argon2id cost parameters
const ARGON2_MEMORY_KIB = 4096;
const ARGON2_ITERATIONS = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(buf));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return argon2id({
    password,
    salt,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: "encoded"
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2Verify({ password, hash });
}

export async function issueAccessToken(
  secret: string,
  ttlSeconds: number,
  user: { id: string; role: string }
) {
  const now = Math.floor(Date.now() / 1000);
  return await sign(
    { role: user.role, sub: user.id, iat: now, exp: now + ttlSeconds },
    secret,
    "HS256"
  );
}

// hono/jwt: claims (exp/nbf/iat) are validated before the signature, unlike jose.
// The secret must be a raw string — a "PRIVATE"/"PUBLIC" substring would make
// hono/jwt treat it as an asymmetric PEM key and fail. All errors map to null.
export async function verifyAccessToken(secret: string, token: string) {
  try {
    const payload = (await verify(token, secret, "HS256")) as { sub?: unknown; role?: unknown };
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export async function generateRefreshToken(): Promise<{
  token: string;
  token_hash: string;
}> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(bytes);
  const token_hash = await sha256Hex(token);
  return { token, token_hash };
}
