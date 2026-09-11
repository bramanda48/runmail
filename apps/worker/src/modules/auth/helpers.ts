import { argon2id, argon2Verify } from "hash-wasm";
import { jwtVerify, SignJWT } from "jose";
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
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(
  secret: string,
  token: string
): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"]
    });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }
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
