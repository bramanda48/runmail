import { refreshTokens, users } from "@runmail/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../lib/db";
import type { AppContext } from "../../lib/env";
import { uuidv7 } from "../../lib/ids";
import {
  generateRefreshToken,
  hashPassword,
  issueAccessToken,
  sha256Hex,
  verifyPassword,
} from "./helpers";

export type TokenErrorCode = "TOKEN_EXPIRED" | "TOKEN_REUSED" | "UNAUTHORIZED";

export type AuthResult = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; username: string; role: string };
};

export type AuthError = { error: TokenErrorCode | "INVALID_CREDENTIALS" };

let dummyHashPromise: Promise<string> | null = null;
const getDummyHash = () => (dummyHashPromise ??= hashPassword("timing-equalizer"));

export async function login(
  c: AppContext,
  username: string,
  password: string,
): Promise<AuthResult | null> {
  const db = getDb(c);

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return null;
  }

  if (!user.is_active || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  const { token: refresh_token, token_hash } = await generateRefreshToken();
  const ttlMs = parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) * 1000;
  const now = Date.now();

  await db.insert(refreshTokens).values({
    id: uuidv7(),
    user_id: user.id,
    token_hash,
    expires_at: now + ttlMs,
    created_at: now,
  });

  const access_token = await issueAccessToken(
    c.env.JWT_SIGNING_SECRET,
    parseInt(c.env.JWT_ACCESS_TTL_SECONDS, 10),
    { id: user.id, role: user.role },
  );

  return {
    access_token,
    refresh_token,
    expires_in: parseInt(c.env.JWT_ACCESS_TTL_SECONDS, 10),
    user: { id: user.id, username: user.username, role: user.role },
  };
}

export async function refresh(
  c: AppContext,
  refreshToken: string,
): Promise<AuthResult | AuthError> {
  const db = getDb(c);
  const tokenHash = await sha256Hex(refreshToken);
  const now = Date.now();

  // Atomic claim: exactly one concurrent caller wins the rotation.
  const [claimed] = await db
    .update(refreshTokens)
    .set({ revoked_at: now })
    .where(
      and(
        eq(refreshTokens.token_hash, tokenHash),
        isNull(refreshTokens.revoked_at),
        gt(refreshTokens.expires_at, now),
      ),
    )
    .returning({ id: refreshTokens.id, user_id: refreshTokens.user_id });

  if (!claimed) {
    // Classify: expired-or-missing vs already-revoked (reuse).
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token_hash, tokenHash))
      .limit(1);
    if (!row) return { error: "TOKEN_EXPIRED" as const };
    if (row.revoked_at !== null) return { error: "TOKEN_REUSED" as const };
    return { error: "TOKEN_EXPIRED" as const };
  }

  const [user] = await db.select().from(users).where(eq(users.id, claimed.user_id)).limit(1);

  if (!user?.is_active) {
    return { error: "UNAUTHORIZED" as const };
  }

  const { token: refresh_token, token_hash: newHash } = await generateRefreshToken();
  const ttlMs = parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) * 1000;
  const issuedAt = Date.now();

  await db.insert(refreshTokens).values({
    id: uuidv7(),
    user_id: user.id,
    token_hash: newHash,
    expires_at: issuedAt + ttlMs,
    created_at: issuedAt,
  });

  const access_token = await issueAccessToken(
    c.env.JWT_SIGNING_SECRET,
    parseInt(c.env.JWT_ACCESS_TTL_SECONDS, 10),
    { id: user.id, role: user.role },
  );

  return {
    access_token,
    refresh_token,
    expires_in: parseInt(c.env.JWT_ACCESS_TTL_SECONDS, 10),
    user: { id: user.id, username: user.username, role: user.role },
  };
}

export async function logout(c: AppContext, userId: string, refreshToken: string): Promise<void> {
  const db = getDb(c);
  const token_hash = await sha256Hex(refreshToken);
  await db
    .update(refreshTokens)
    .set({ revoked_at: Date.now() })
    .where(
      and(
        eq(refreshTokens.token_hash, token_hash),
        eq(refreshTokens.user_id, userId),
        isNull(refreshTokens.revoked_at),
      ),
    );
}

export async function changePassword(
  c: AppContext,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | AuthError> {
  const db = getDb(c);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return { error: "INVALID_CREDENTIALS" };
  }

  const password_hash = await hashPassword(newPassword);
  const now = Date.now();

  await db.batch([
    db.update(users).set({ password_hash, updated_at: now }).where(eq(users.id, userId)),
    db
      .update(refreshTokens)
      .set({ revoked_at: now })
      .where(and(eq(refreshTokens.user_id, userId), isNull(refreshTokens.revoked_at))),
  ]);

  return { ok: true };
}
