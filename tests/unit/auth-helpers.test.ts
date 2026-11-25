import { describe, expect, it } from "bun:test";
import { createId } from "../../apps/worker/src/lib/ids";
import {
  generateRefreshToken,
  hashPassword,
  verifyPassword,
} from "../../apps/worker/src/modules/auth/helpers";
import {
  JWT_KID,
  signTokenWithKey,
  verifyTokenWithKey,
} from "../../apps/worker/src/modules/auth/keypair";

const CUID2_RE = /^[a-z0-9]{32}$/;

describe("hashPassword / verifyPassword", () => {
  it("roundtrips a password", async () => {
    const hash = await hashPassword("correct-horse-123");
    expect(await verifyPassword("correct-horse-123", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-123");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces distinct hashes for the same password (unique salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("generateRefreshToken", () => {
  it("returns distinct tokens on consecutive calls", async () => {
    const a = await generateRefreshToken();
    const b = await generateRefreshToken();
    expect(a.token).not.toBe(b.token);
  });

  it("token_hash is a 64-char hex string", async () => {
    const { token_hash } = await generateRefreshToken();
    expect(token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createId", () => {
  it("returns a 32-char lowercase alphanumeric string", () => {
    expect(createId()).toMatch(CUID2_RE);
  });

  it("produces 100 unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId()));
    expect(ids.size).toBe(100);
  });
});

async function generateTestKeypair(): Promise<CryptoKeyPair> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  // generateKey is typed as CryptoKey | CryptoKeyPair; RSA parameters always
  // produce a pair, so this narrows the type without runtime risk.
  return pair as CryptoKeyPair;
}

describe("signTokenWithKey / verifyTokenWithKey (RS256)", () => {
  it("roundtrips a token", async () => {
    const { privateKey, publicKey } = await generateTestKeypair();
    const token = await signTokenWithKey(privateKey, { id: "user-1", role: "member" }, 3600);
    expect(await verifyTokenWithKey(publicKey, token)).toEqual({
      sub: "user-1",
      role: "member",
    });
  });

  it("embeds kid + RS256 header", async () => {
    const { privateKey } = await generateTestKeypair();
    const token = await signTokenWithKey(privateKey, { id: "user-1", role: "member" }, 3600);
    const header = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0),
        ),
      ),
    );
    expect(header).toMatchObject({ alg: "RS256", kid: JWT_KID });
  });

  it("returns null for a tampered token", async () => {
    const { privateKey, publicKey } = await generateTestKeypair();
    const token = await signTokenWithKey(privateKey, { id: "user-1", role: "member" }, 3600);
    const parts = token.split(".");
    const flipped = parts[2][0] === "a" ? `b${parts[2].slice(1)}` : `a${parts[2].slice(1)}`;
    const tampered = [parts[0], parts[1], flipped].join(".");
    expect(tampered).not.toBe(token);
    expect(await verifyTokenWithKey(publicKey, tampered)).toBe(null);
  });

  it("returns null when ttl is 0 (already expired)", async () => {
    const { privateKey, publicKey } = await generateTestKeypair();
    const token = await signTokenWithKey(privateKey, { id: "user-1", role: "member" }, 0);
    expect(await verifyTokenWithKey(publicKey, token)).toBe(null);
  });

  it("returns null for a token signed by a different key", async () => {
    const a = await generateTestKeypair();
    const b = await generateTestKeypair();
    const token = await signTokenWithKey(a.privateKey, { id: "user-1", role: "member" }, 3600);
    expect(await verifyTokenWithKey(b.publicKey, token)).toBe(null);
  });

  it("returns null for malformed tokens", async () => {
    const { publicKey } = await generateTestKeypair();
    expect(await verifyTokenWithKey(publicKey, "not-a-jwt")).toBe(null);
    expect(await verifyTokenWithKey(publicKey, "a.b")).toBe(null);
  });
});
