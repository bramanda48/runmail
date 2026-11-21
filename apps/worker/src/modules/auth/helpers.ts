import { bytesToHex, toBase64Url } from "@/lib/encoding";
import { compare as bcryptCompare, hash as bcryptHash } from "bcrypt-ts";

// bcrypt cost factor - OWASP recommends 12+ for 2024+
const BCRYPT_COST = 12;

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(buf));
}

export async function hashPassword(password: string): Promise<string> {
  return bcryptHash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptCompare(password, hash);
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
