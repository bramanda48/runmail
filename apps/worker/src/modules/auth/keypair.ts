import { toBase64Url } from "@/lib/encoding";
import type { AppContext } from "@/lib/env";
import { getSettings, updateSettings } from "@/modules/settings/service";

export const JWT_KID = "runmail-2026-11";
export const ACCESS_TOKEN_ALG = "RS256";

const RSA_ALG = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
} as const;

const RSA_GEN_PARAMS = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;

export function fromBase64Url(input: string): Uint8Array {
  const std = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Raw PEM: strip header/footer/whitespace, decode the remaining base64.
function pemToArrayBuffer(pem: string, label: string): ArrayBuffer {
  const b64 = pem
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // .slice(0) copies into a fresh buffer, so the cast only narrows the
  // resizable-ArrayBuffer typing — the bytes themselves are unchanged.
  const owned: ArrayBuffer = bytes.buffer.slice(0) as ArrayBuffer;
  return owned;
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("pkcs8", pemToArrayBuffer(pem, "PRIVATE KEY"), RSA_ALG, true, [
    "sign",
  ]);
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", pemToArrayBuffer(pem, "PUBLIC KEY"), RSA_ALG, true, [
    "verify",
  ]);
}

function pemWrap(b64: string, label: string): string {
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

export async function exportPrivatePem(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("pkcs8", key);
  if (!(raw instanceof ArrayBuffer)) throw new Error("Unexpected key export");
  const bytes = new Uint8Array(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return pemWrap(btoa(binary), "PRIVATE KEY");
}

export async function exportPublicPem(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("spki", key);
  if (!(raw instanceof ArrayBuffer)) throw new Error("Unexpected key export");
  const bytes = new Uint8Array(raw);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return pemWrap(btoa(binary), "PUBLIC KEY");
}

export type Keypair = {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

// If two setups run at the same time, both generate a key and the last write
// wins. Tokens signed with the losing key fail verification, so that admin
// simply logs in again. Acceptable: setup runs once per deployment.
export async function ensureKeypair(c: AppContext): Promise<Keypair> {
  const row = await getSettings(c);
  if (row?.jwt_private_key && row.jwt_public_key) {
    return {
      privateKey: await importPrivateKey(row.jwt_private_key),
      publicKey: await importPublicKey(row.jwt_public_key),
    };
  }
  const pair = await crypto.subtle.generateKey(RSA_GEN_PARAMS, true, ["sign", "verify"]);
  // generateKey returns CryptoKey | CryptoKeyPair by default; RSA parameters
  // always produce a pair, so this narrows the type without runtime risk.
  const rsaPair = pair as CryptoKeyPair;
  const jwt_private_key = await exportPrivatePem(rsaPair.privateKey);
  const jwt_public_key = await exportPublicPem(rsaPair.publicKey);
  await updateSettings(c, { jwt_private_key, jwt_public_key });
  return { privateKey: rsaPair.privateKey, publicKey: rsaPair.publicKey };
}

// Read-only: verify never generates a key from unauthenticated input.
export async function publicKeyOnly(c: AppContext): Promise<CryptoKey> {
  const row = await getSettings(c);
  if (!row?.jwt_public_key) throw new Error("JWT keypair unavailable");
  return importPublicKey(row.jwt_public_key);
}

function signingInput(headerB64: string, payloadB64: string): Uint8Array {
  return new TextEncoder().encode(`${headerB64}.${payloadB64}`);
}

function encodeSegment(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Pure: sign with an explicit key, no DB. Used by issueAccessToken + unit tests. */
export async function signTokenWithKey(
  privateKey: CryptoKey,
  user: { id: string; role: string },
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = encodeSegment({ alg: ACCESS_TOKEN_ALG, typ: "JWT", kid: JWT_KID });
  const payloadB64 = encodeSegment({
    sub: user.id,
    role: user.role,
    iat: now,
    exp: now + ttlSeconds,
  });
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    signingInput(headerB64, payloadB64),
  );
  return `${headerB64}.${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

/** Pure: verify with an explicit key, no DB. Used by verifyAccessToken + unit tests. */
export async function verifyTokenWithKey(
  publicKey: CryptoKey,
  token: string,
): Promise<{ sub: string; role: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const headerB64 = parts[0] as string;
    const payloadB64 = parts[1] as string;
    const sigB64 = parts[2] as string;
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      fromBase64Url(sigB64),
      signingInput(headerB64, payloadB64),
    );
    if (!ok) return null;
    const payload: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (typeof payload !== "object" || payload === null) return null;
    if (!("sub" in payload) || !("role" in payload) || !("exp" in payload)) return null;
    const sub: unknown = payload.sub;
    const role: unknown = payload.role;
    const exp: unknown = payload.exp;
    if (typeof sub !== "string" || typeof role !== "string" || typeof exp !== "number") return null;
    if (exp <= Math.floor(Date.now() / 1000)) return null;
    return { sub, role };
  } catch {
    return null;
  }
}

export async function issueAccessToken(
  c: AppContext,
  user: { id: string; role: string },
  ttlSeconds: number,
): Promise<string> {
  const { privateKey } = await ensureKeypair(c);
  return signTokenWithKey(privateKey, user, ttlSeconds);
}

export async function verifyAccessToken(
  c: AppContext,
  token: string,
): Promise<{ sub: string; role: string } | null> {
  try {
    const publicKey = await publicKeyOnly(c);
    return verifyTokenWithKey(publicKey, token);
  } catch {
    return null;
  }
}

// ensureKeypair failure (totally empty DB) → throw; routes map it to 500.
export async function publicJwk(c: AppContext): Promise<Record<string, unknown>> {
  const { publicKey } = await ensureKeypair(c);
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return { ...jwk, kid: JWT_KID, alg: ACCESS_TOKEN_ALG, use: "sig" };
}
