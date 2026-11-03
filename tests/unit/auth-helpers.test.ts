import { describe, expect, it } from "bun:test";
import { createId } from "../../apps/worker/src/lib/ids";
import {
  generateRefreshToken,
  hashPassword,
  issueAccessToken,
  verifyAccessToken,
  verifyPassword,
} from "../../apps/worker/src/modules/auth/helpers";

const CUID2_RE = /^[a-z0-9]{32}$/;

describe("hashPassword / verifyPassword", () => {
  it("roundtrips a password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash).toBeTruthy();
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("right-password");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces distinct hashes for the same password (unique salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });
});

describe("generateRefreshToken", () => {
  it("returns distinct tokens on consecutive calls", async () => {
    const a = await generateRefreshToken();
    const b = await generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token_hash).not.toBe(b.token_hash);
  });

  it("token_hash is a 64-char hex string", async () => {
    const { token_hash } = await generateRefreshToken();
    expect(token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("createId", () => {
  it("returns a 32-char lowercase alphanumeric string", () => {
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id).toHaveLength(32);
    expect(id).toMatch(CUID2_RE);
  });

  it("produces 100 unique values", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(createId());
    expect(seen.size).toBe(100);
  });
});

describe("issueAccessToken / verifyAccessToken", () => {
  const SECRET = "test-secret";

  it("roundtrips a token", async () => {
    const token = await issueAccessToken(SECRET, 3600, {
      id: "user-1",
      role: "member",
    });
    const payload = await verifyAccessToken(SECRET, token);
    expect(payload).toEqual({ sub: "user-1", role: "member" });
  });

  it("returns null for a tampered token", async () => {
    const token = await issueAccessToken(SECRET, 3600, {
      id: "user-1",
      role: "member",
    });
    const parts = token.split(".");
    const flipped = parts[2][0] === "a" ? `b${parts[2].slice(1)}` : `a${parts[2].slice(1)}`;
    const tampered = [parts[0], parts[1], flipped].join(".");
    expect(tampered).not.toBe(token);
    expect(await verifyAccessToken(SECRET, tampered)).toBe(null);
  });

  it("returns null when ttl is 0 (already expired)", async () => {
    const token = await issueAccessToken(SECRET, 0, {
      id: "user-1",
      role: "member",
    });
    expect(await verifyAccessToken(SECRET, token)).toBe(null);
  });

  it("returns null for a wrong secret", async () => {
    const token = await issueAccessToken(SECRET, 3600, {
      id: "user-1",
      role: "member",
    });
    expect(await verifyAccessToken("other-secret", token)).toBe(null);
  });
});
